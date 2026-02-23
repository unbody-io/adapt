# Fix: Evolution Pipeline Resilience

## Problem

During ingestion stress testing, three bugs crashed the server:

1. **Evolution handlers throw on failure** — A single LLM parse error in any evolution action (create, update, merge, split, delete) propagates up via `throw` and crashes the process.
2. **No concurrency guard on evaluator** — Multiple evaluation + execution cycles run simultaneously when signals accumulate faster than evaluation completes, causing race conditions (concurrent updates to the same learner).
3. **Stagnation signal storm** — The stagnation check fires on *every* batch once the threshold is crossed (31, 32, 33... observations), flooding the evaluator with redundant signals.

## Fix 1: Evolution Handlers — Catch and Continue

### Current Behavior

All 5 handlers (`create.ts`, `update.ts`, `delete.ts`, `merge.ts`, `split.ts`) in `src/brain/evolution/handlers/` follow the same pattern:

```typescript
// update.ts:72-76 (same pattern in all handlers)
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.emitActionFailed(decision, err)
    throw new Error(`Update action failed: ${err.message}`)  // ← CRASHES
}
```

The `emitActionFailed` fires correctly, but then `throw` propagates up through the orchestrator → brain → event listener → unhandled → process crash.

### Fix

In every handler's catch block, **remove the `throw`** and **continue** to the next decision. The `emitActionFailed` event already communicates the failure — the orchestrator and brain can observe it. A single failed action should not block the remaining actions.

**Files to change:**

- `src/brain/evolution/handlers/update.ts:75` — remove `throw`, add `continue`
- `src/brain/evolution/handlers/create.ts:52` — same
- `src/brain/evolution/handlers/delete.ts:49` — same
- `src/brain/evolution/handlers/merge.ts:78` — same
- `src/brain/evolution/handlers/split.ts:84` — same

**Pattern:**
```typescript
// BEFORE (all handlers)
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.emitActionFailed(decision, err)
    throw new Error(`... action failed: ${err.message}`)
}

// AFTER (all handlers)
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.emitActionFailed(decision, err)
    continue  // Skip this decision, proceed with the rest
}
```

Also wrap the orchestrator's `executeDecisions` loop in `src/brain/evolution/orchestrator.ts:58-67` so a failing handler group doesn't block other groups:

```typescript
// BEFORE (orchestrator.ts:58-67)
for (const [action, group] of grouped) {
    const handler = this.handlers.get(action)
    if (!handler) {
        throw new Error(`No handler found for action: ${action}`)
    }
    const result: EvolutionActionResult = await handler.execute(group)
    this.aggregateResult(aggregated, action, result)
}

// AFTER
for (const [action, group] of grouped) {
    const handler = this.handlers.get(action)
    if (!handler) continue

    try {
        const result: EvolutionActionResult = await handler.execute(group)
        this.aggregateResult(aggregated, action, result)
    } catch {
        // Individual handler failures are already emitted via emitActionFailed
        // Continue with remaining action groups
    }
}
```

## Fix 2: Evaluator Concurrency Guard

### Current Behavior

In `src/brain/evaluator/class.ts:43-58`, `signal()` calls `evaluate('auto')` as fire-and-forget:

```typescript
signal(signal: Signal): void {
    this.signals.push(signal)
    if (signal.bypass || (this.signals.length >= this.threshold && ...)) {
        this.evaluate('auto').catch(...)  // ← No lock, runs every time
    }
}
```

During bulk ingestion, 3 learners emit stagnation signals every batch → signals accumulate past threshold → multiple `evaluate('auto')` calls overlap → multiple execution cycles target the same learners simultaneously.

### Fix

Add an `isEvaluating` lock to the Evaluator class:

```typescript
export class Evaluator extends TypedEmitter<EvaluatorEventMap> {
    private signals: Signal[] = []
    private isEvaluating = false  // ← ADD THIS
    private readonly threshold: number
    private readonly brain: Brain
    includeUnderstanding = true

    signal(signal: Signal): void {
        this.signals.push(signal)

        if (this.isEvaluating) return  // ← ADD: skip if already running

        if (
            signal.bypass ||
            (this.signals.length >= this.threshold &&
            this.brain.config.evolution.autoEvaluate)
        ) {
            this.isEvaluating = true  // ← ADD: acquire lock
            this.evaluate('auto')
                .catch((error) => {
                    this.emit('evaluator:evaluation:failed', {
                        error: error instanceof Error ? error.message : String(error),
                    })
                })
                .finally(() => {
                    this.isEvaluating = false  // ← ADD: release lock
                })
        }
    }
}
```

This ensures only one evaluation + execution cycle runs at a time. Signals that arrive during an ongoing evaluation are still buffered (line 44) and will be picked up on the *next* evaluation cycle when new signals push past the threshold again.

**File:** `src/brain/evaluator/class.ts`

## Fix 3: Stagnation Signal — Fire Once, Then Cooldown

### Current Behavior

In `src/learners/text-learner/class.ts:924-934`:

```typescript
if (
    ingestion.observationsSinceLastSynthesis >
    signalThresholds.maxObservationsWithoutSynthesis
) {
    this.emit('learner:signal', {
        learnerId: this.id,
        description: `Stagnation: no synthesis in ${ingestion.observationsSinceLastSynthesis} observations`,
        timestamp: new Date(),
    })
}
```

This fires on every `checkAndEmitSignals()` call once the threshold is crossed: batch 31, 32, 33, 34... Each batch produces a stagnation signal per learner, rapidly flooding the evaluator.

### Fix

Add a `stagnationSignalFired` flag that resets when synthesis occurs:

```typescript
// Add to class fields (near other metrics):
private stagnationSignalFired = false

// In checkAndEmitSignals(), replace stagnation check:
if (
    !this.stagnationSignalFired &&
    ingestion.observationsSinceLastSynthesis >
    signalThresholds.maxObservationsWithoutSynthesis
) {
    this.stagnationSignalFired = true  // ← Fire once
    this.emit('learner:signal', {
        learnerId: this.id,
        description: `Stagnation: no synthesis in ${ingestion.observationsSinceLastSynthesis} observations`,
        timestamp: new Date(),
    })
}

// Reset the flag when synthesis occurs.
// In the synthesis success path (around line 660-674 where status === 'synthesized'),
// add:
this.stagnationSignalFired = false
```

Apply the same fire-once pattern to the **dismissal rate signal** — it should also fire once and reset when the rate drops below threshold (or after a cooldown). Currently it fires every `checkAndEmitSignals()` call while the rate is above 80%.

**File:** `src/learners/text-learner/class.ts`

## Verification

After applying all 3 fixes:
1. Inject bulk irrelevant data — server should NOT crash
2. Check that stagnation signal fires once per learner (not per batch)
3. Check that only one evaluator cycle runs at a time (signal counts in `evaluator:evaluation:started` events should not overlap)
4. If an evolution action fails (e.g. LLM parse error), remaining actions in the batch should still execute
