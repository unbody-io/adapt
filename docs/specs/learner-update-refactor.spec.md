# Learner Update Refactor Spec

**Date:** 2026-02-05
**Scope:** TextLearner, TwoPhaseMethod, QueryMethod — internal refactor only
**Out of scope:** Brain orchestration, evolution handlers, evaluator, UI, signal system

---

## Problem

The learner's `update()` method is too restrictive. It blocks model changes via an immutability guard, and even if that guard were removed, the internal components (`TwoPhaseMethod`, `QueryMethod`) have no mechanism to swap models or re-derive prompts at runtime. This makes the entire evolution system ineffective — the brain can decide to update a learner, but the learner can't actually apply the change.

Related issues: [living-brain-architecture-issues.md](../issues/living-brain-architecture-issues.md) — Issues 1 and 2.

---

## Design Principles

### Config vs State

Every field on a learner is either **config** or **state**. `update()` touches config only. Never state.

**Config** — how the learner is set up:
- `model`, `blueprintModel`
- `instructions`, `name`, `description`
- `observe.model`, `observe.blueprintModel`
- `synthesize.model`, `synthesize.blueprintModel`, `synthesize.thresholds`
- `query.model`, `query.method`
- `governance.threshold`, `governance.signalThresholds`
- `maintenance.strategy`, `maintenance.maxTokens`

**State** — what the learner has accumulated (never touched by `update()`):
- `understanding`
- `evolution` history
- Observation buffer contents
- Governance runtime metrics: `activation`, `status`, `lastAccessed`, `retrievalCount`, `successRate`
- Signal counters: `dismissalCount`, `observationCount`, `queryConfidences[]`, `lastSynthesisObservationCount`

### Same Shape In

`update()` accepts the same config shape as the constructor, but partial:

```ts
constructor(config: TextLearnerConfig)
update(changes: Partial<TextLearnerConfig>): Promise<UpdateResult>
```

This applies at every level:
- `Learner.update(Partial<TextLearnerConfig>)`
- `TwoPhaseMethod.update(Partial<TwoPhaseConfig>)`
- `QueryMethod.update(Partial<QueryConfig>)`

### Dependency-Driven Re-derivation

Some config fields are **raw constants** (just store them). Others are **inputs to derivation chains** (changing them triggers regeneration). `update()` inspects what changed and runs only the necessary chains.

### Apply Immediately

Updates take effect immediately. If a `learn()` or `ask()` call is in progress, the current LLM call finishes with the old values. The next LLM call uses the new values. No queuing, no locking.

---

## `update()` Contract

### Signature

```ts
interface UpdateResult {
  changedFields: string[]  // dot-notation paths, e.g. ["observe.model", "instructions"]
  config: ResolvedTextLearnerConfig
}

// On Learner:
async update(changes: Partial<TextLearnerConfig>): Promise<UpdateResult>

// On TwoPhaseMethod:
async update(changes: Partial<TwoPhaseConfig>): Promise<void>

// On QueryMethod:
async update(changes: Partial<QueryMethodConfig>): Promise<void>
```

### Return Value

Returns `{ changedFields, config }` — the list of dot-notation paths that changed and the full resolved config after the update.

### Event

Emits `learner:config:updated` with the same payload:

```ts
'learner:config:updated': {
  learnerId: string
  changedFields: string[]
  config: ResolvedTextLearnerConfig
}
```

### Immutability

Remove the current `validateImmutability()` guard entirely. The only truly immutable field is `id` (changing identity makes no sense). Everything else is updatable.

---

## Dependency Graph

When a config field changes, `update()` must re-derive everything that depends on it.

```
instructions ──────────┐
observe.blueprintModel ─┤──→ re-init observe prompts (observe phase of init())
                        │
instructions ──────────┐│
synthesize.blueprintModel ┤──→ re-init synthesize prompts (synthesize phase of init())
                           │
model ─────────────────────→ swap default model on TwoPhaseMethod + QueryMethod
observe.model ─────────────→ swap observe phase model on TwoPhaseMethod
synthesize.model ──────────→ swap synthesize phase model on TwoPhaseMethod
query.model ───────────────→ swap model on QueryMethod

name, description ─────────→ store only (no derivation)
thresholds ────────────────→ store only (immediate effect on next synthesis decision)
governance settings ───────→ store only (immediate effect on signal checks)
maintenance ───────────────→ store only (immediate effect on next synthesis)
```

**Key rule:** If a field is an input to a derivation chain, changing it re-triggers that chain. If multiple inputs to the same chain change in one `update()` call, the chain runs once with all new values.

---

## `init()` Refactor

Refactor `init()` to use `update()` internally. This ensures a single derivation engine:

```
constructor(config) → stores raw config
init() → calls update(fullConfig) → triggers all derivation chains
```

This applies at every level:
- `Learner.init()` → `this.update(this.config)`
- `TwoPhaseMethod.init(instructions)` → `this.update(fullConfig)`
- QueryMethod follows the same pattern if it has initialization logic

After this refactor, there is one code path for derivation, whether the learner is being born or being updated.

---

## Propagation Chain

When `learner.update()` is called, it delegates relevant changes downward:

```
learner.update({ observe: { model: X }, instructions: "..." })
  │
  ├─ stores new instructions in own config
  ├─ calls this._learningMethod.update({ observe: { model: X } })
  │     └─ TwoPhaseMethod stores new observe model
  │
  ├─ detects instructions changed → triggers re-init
  │     └─ calls this._learningMethod.init(newInstructions)
  │           which internally uses update() with blueprintModels + instructions
  │           └─ regenerates observe + synthesize prompts
  │
  └─ emits 'learner:config:updated' with changedFields + full config
```

For model-only changes (no derivation needed):

```
learner.update({ observe: { model: X } })
  │
  ├─ calls this._learningMethod.update({ observe: { model: X } })
  │     └─ TwoPhaseMethod swaps observe model (raw constant)
  │
  └─ emits 'learner:config:updated'
```

---

## Files to Modify

### `src/learners/text-learner/class.ts` (TextLearner)
- Rewrite `update()`: remove `validateImmutability()`, accept full `Partial<TextLearnerConfig>`, implement dependency detection, delegate to sub-components
- Refactor `init()` to use `update()` internally
- Update event payload for `learner:config:updated`

### `src/learners/text-learner/learning-methods/two-phase/index.ts` (TwoPhaseMethod)
- Add `update(Partial<TwoPhaseConfig>)` method
- Support swapping models (observe, synthesize, default) at runtime
- Support re-deriving prompts when blueprintModel or instructions change
- Refactor `init()` to use `update()` internally

### `src/learners/text-learner/query-methods/` (QueryMethod)
- Add `update()` to the `QueryMethod` interface
- Implement in `direct/index.ts` and `tool-based/index.ts`
- Support swapping model at runtime

### `src/learners/text-learner/types.ts`
- Update `TextLearnerEventMap` for the new `learner:config:updated` payload shape
- Add `UpdateResult` type

### `src/learners/text-learner/config.resolver.ts`
- May need adjustment to support partial re-resolution (merging partial changes into existing resolved config)

---

## What Does NOT Change

- **Brain class** — still calls `learner.update(config)` the same way, just with more fields available
- **Evolution handlers** — still produce config changes, feed them to `learner.update()`
- **Signal system** — untouched, still learner-internal state
- **`setUnderstanding()`** — stays as-is, it's a state operation not a config operation
- **Event system** — same architecture, just updated payload shape for `config:updated`
- **Observe/synthesize/query runtime logic** — unchanged, they just read from (now-mutable) model references

---

## Testing Strategy

### Unit Tests
1. **Raw constant updates**: `update({ model: X })` → verify model is swapped, next operation uses it
2. **Derived updates**: `update({ instructions: "..." })` → verify prompts are regenerated
3. **Mixed updates**: `update({ model: X, instructions: "..." })` → verify both apply, derivation runs once
4. **Propagation**: `update({ observe: { model: X } })` → verify TwoPhaseMethod receives the change
5. **No-op updates**: `update({ name: sameName })` → verify no unnecessary re-derivation
6. **Return value**: verify `changedFields` and `config` are correct
7. **Event emission**: verify `learner:config:updated` fires with correct payload
8. **State untouched**: verify understanding, buffer, governance metrics unchanged after update
9. **init() via update()**: verify fresh learner `init()` produces same result as before refactor

### Integration Tests
1. Full flow: create learner → learn some data → update model → learn more data → verify new model is used
2. Full flow: create learner → update instructions → verify new prompts → query → verify behavior reflects new instructions
