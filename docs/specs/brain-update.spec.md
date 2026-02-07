# Spec: `brain.update()`

**Date:** 2026-02-05
**Status:** Draft
**Branch:** `feature/living-brain-spec`

---

## Overview

Redesign `brain.update()` to follow the same pattern as `learner.update()` — accept a partial of the constructor config, categorize each field by its downstream effect, and propagate changes accordingly.

---

## Signature

```typescript
async update(updates: Partial<BrainConfig>): Promise<BrainUpdateResult>
```

Where `BrainConfig` is the existing constructor input type:

```typescript
interface BrainConfig extends CascadableConfig {
  prompt: string
  model: LanguageModel
  blueprintModel?: LanguageModel
  init?: InitPhaseConfig
  query?: BrainQueryConfig
  ingest?: IngestConfig
  learning?: LearningConfig
  evolution?: EvolutionConfig
}
```

---

## Return Type

```typescript
interface BrainUpdateResult {
  changedFields: string[]
  config: ResolvedBrainConfig
  learnerResults: Array<{
    learnerId: string
    changedFields: string[]
  }>
  evolutionResults?: {
    decisions: EvolutionDecision[]
    created: string[]
    updated: string[]
    deleted: string[]
    merged: string[]
    split: string[]
  }
}
```

- `changedFields` — brain-level fields that changed
- `config` — current resolved brain config after update
- `learnerResults` — per-learner summary of what changed (from `learner.update()` calls)
- `evolutionResults` — present only when signal-driven evaluation was triggered (prompt or semantic learning changes)

---

## Field Categories

### 1. Brain-only (no downstream effect)

These update `this.config` and nothing else:

| Field | Notes |
|-------|-------|
| `init.model` | Decomposition model, only used during init |
| `query.model` | Brain-level ask synthesis model |
| `ingest.batchSize` | Batch size for inject operations |
| `evolution.enabled` | Enables/disables evolution system |
| `evolution.evaluatorSignalThreshold` | Signal count before auto-evaluation |
| `evolution.autoEvaluate` | Whether to auto-evaluate on threshold |

**Behavior:** Store on `this.config`. Emit `brain:config:updated`. For evolution config, handle evaluator/orchestrator lifecycle as current code does (create evaluator on enable, recreate on threshold change).

### 2. Mechanical cascade (direct to learners)

These are forwarded to every existing learner via a single `learner.update()` call per learner:

| Field | Forwarded as |
|-------|-------------|
| `model` | `learner.update({ model })` |
| `blueprintModel` | `learner.update({ blueprintModel })` |
| `learning.model` | `learner.update({ model })` |
| `learning.blueprintModel` | `learner.update({ blueprintModel })` |
| `learning.observe.model` | `learner.update({ observe: { model } })` |
| `learning.observe.blueprintModel` | `learner.update({ observe: { blueprintModel } })` |
| `learning.synthesize.model` | `learner.update({ synthesize: { model } })` |
| `learning.synthesize.blueprintModel` | `learner.update({ synthesize: { blueprintModel } })` |
| `learning.synthesize.thresholds.*` | `learner.update({ synthesize: { thresholds: {...} } })` |
| `learning.query.model` | `learner.update({ query: { model } })` |
| `learning.query.method` | `learner.update({ query: { method } })` |
| `learning.maintenance.strategy` | `learner.update({ maintenance: { strategy } })` |
| `learning.maintenance.maxTokens` | `learner.update({ maintenance: { maxTokens } })` |

**Behavior:** Build a single partial `TextLearnerConfig` from all mechanical fields, call `learner.update(partial)` on each learner. Learner handles its own internal cascade and decides what to do with each field. Collect `learnerResults` from each call.

Also update `this.config.model` / `this.config.blueprintModel` for brain-level usage.

### 3. Signal-driven (evaluator decides)

These are semantic changes that affect learner purpose/identity. Brain does not forward them directly — instead it generates a bypass signal to the evaluator:

| Field | Notes |
|-------|-------|
| `prompt` | Brain's purpose changed |
| `learning.instructions` | Learner instructions change request |
| `learning.name` | Learner name change request |
| `learning.description` | Learner description change request |

**Behavior:**
1. Update `this.prompt` / `this.config.prompt` if prompt changed
2. Combine all semantic changes into one signal description
3. Call `this.signal({ source: 'brain', description: '...', bypass: true })`
4. The bypass flag triggers immediate evaluation (skips threshold)
5. `await` the full evaluation + execution cycle
6. Collect `evolutionResults` from the decisions and execution

---

## Signal Bypass

`signal()` gains a `bypass` property:

```typescript
signal(signal: { source: string; description: string; bypass?: boolean }): void
```

When `bypass: true`:
- Signal is still added to the evaluator's buffer
- Evaluation is triggered immediately regardless of threshold
- This is for explicit user-initiated structural changes (prompt, semantic learning fields)

The evaluator's `signal()` method needs a corresponding change:

```typescript
signal(signal: Signal): void {
  this.signals.push(signal)

  if (
    signal.bypass ||
    (this.signals.length >= this.threshold && this.brain.config.evolution.autoEvaluate)
  ) {
    // trigger evaluation
  }
}
```

However, since `brain.update()` needs to `await` the evaluation result, the fire-and-forget pattern in evaluator won't work for bypass signals. Instead, `brain.update()` should call `this.evaluateEvolution()` directly after sending the bypass signal, and await the result.

---

## Remove `learning` from `this.config`

### Current state

`this.config` is `ResolvedBrainConfig` which includes a `learning: ResolvedLearningConfig` field. This creates a duplicate source of truth — each learner already owns its config.

### New state

- **Constructor** still accepts `learning` in `BrainConfig` — used at init time to create learners with those defaults.
- **`this.config`** (`ResolvedBrainConfig`) no longer includes `learning`. Remove the field from the type.
- **Source of truth** for learner configs is `this.learners` — iterate and read from them when needed.
- **`createLearnerFromConfig()`** uses `this.config.model` / `this.config.blueprintModel` as model defaults, and `BRAIN_DEFAULTS` for everything else (thresholds, strategy, etc.).

### Migration

- Remove `learning` from `ResolvedBrainConfig` type
- Remove `resolveLearningConfig()` from `config.resolver.ts` (or keep it only for init-time use)
- Update `createLearnerFromConfig()` to read from `this.config.model`/`this.config.blueprintModel` + `BRAIN_DEFAULTS` instead of `this.config.learning`
- Update `brain.update()` — no more `this.config.learning.*` mutations
- Update any code that reads `brain.config.learning` (server logging, etc.)

---

## Update Flow (pseudocode)

```typescript
async update(updates: Partial<BrainConfig>): Promise<BrainUpdateResult> {
  const changedFields: string[] = []
  const learnerResults: BrainUpdateResult['learnerResults'] = []
  let evolutionResults: BrainUpdateResult['evolutionResults'] | undefined

  // ── 1. Brain-only fields ──

  if (updates.init?.model !== undefined) {
    this.config.init.model = updates.init.model
    changedFields.push('init.model')
  }
  if (updates.query?.model !== undefined) {
    this.config.query.model = updates.query.model
    changedFields.push('query.model')
  }
  if (updates.ingest?.batchSize !== undefined) {
    this.config.ingest.batchSize = updates.ingest.batchSize
    changedFields.push('ingest.batchSize')
  }
  // evolution fields ... (same as current logic)

  // ── 2. Mechanical cascade to learners ──

  const learnerUpdate: Partial<TextLearnerConfig> = {}

  if (updates.model !== undefined) {
    this.config.model = updates.model
    changedFields.push('model')
    learnerUpdate.model = updates.model
  }
  if (updates.blueprintModel !== undefined) {
    this.config.blueprintModel = updates.blueprintModel
    changedFields.push('blueprintModel')
    learnerUpdate.blueprintModel = updates.blueprintModel
  }
  // Map learning.* fields to learnerUpdate shape
  if (updates.learning?.model) learnerUpdate.model ??= updates.learning.model
  if (updates.learning?.blueprintModel) learnerUpdate.blueprintModel ??= updates.learning.blueprintModel
  if (updates.learning?.observe) learnerUpdate.observe = updates.learning.observe
  if (updates.learning?.synthesize) {
    // Only mechanical fields (model, blueprintModel, thresholds)
    learnerUpdate.synthesize = {
      ...(updates.learning.synthesize.model ? { model: updates.learning.synthesize.model } : {}),
      ...(updates.learning.synthesize.blueprintModel ? { blueprintModel: updates.learning.synthesize.blueprintModel } : {}),
      ...(updates.learning.synthesize.thresholds ? { thresholds: updates.learning.synthesize.thresholds } : {}),
    }
  }
  if (updates.learning?.query) learnerUpdate.query = updates.learning.query
  if (updates.learning?.maintenance) learnerUpdate.maintenance = updates.learning.maintenance

  // Forward to all learners
  if (Object.keys(learnerUpdate).length > 0) {
    for (const learner of this.learners.values()) {
      const result = await learner.update(learnerUpdate)
      learnerResults.push({ learnerId: learner.id, changedFields: result.changedFields })
    }
  }

  // ── 3. Signal-driven (semantic changes) ──

  const semanticChanges: string[] = []

  if (updates.prompt !== undefined && updates.prompt !== this.prompt) {
    const oldPrompt = this.prompt
    this.prompt = updates.prompt
    this.config.prompt = updates.prompt
    changedFields.push('prompt')
    semanticChanges.push(`Brain purpose changed.\nOld: ${oldPrompt}\nNew: ${updates.prompt}`)
  }
  if (updates.learning?.instructions) {
    semanticChanges.push(`Learner instructions update requested: ${updates.learning.instructions}`)
  }
  if (updates.learning?.name) {
    semanticChanges.push(`Learner name update requested: ${updates.learning.name}`)
  }
  if (updates.learning?.description) {
    semanticChanges.push(`Learner description update requested: ${updates.learning.description}`)
  }

  if (semanticChanges.length > 0) {
    this.signal({
      source: 'brain',
      description: `SYSTEM DIRECTIVE: ${semanticChanges.join('\n\n')}`,
      bypass: true,
    })
    // Await full evaluation + execution
    const decisions = await this.evaluateEvolution()
    evolutionResults = summarizeEvolutionResults(decisions)
  }

  // ── 4. Emit event ──

  if (changedFields.length > 0) {
    this.emit('brain:config:updated', { updates, changedFields })
  }

  return {
    changedFields,
    config: { ...this.config },
    learnerResults,
    evolutionResults,
  }
}
```

---

## Files to modify

| File | Change |
|------|--------|
| `src/brain/class.ts` | Rewrite `update()`, update `createLearnerFromConfig()` |
| `src/brain/types.ts` | Remove `learning` from `ResolvedBrainConfig`, add `BrainUpdateResult`, update `brain:config:updated` event type |
| `src/brain/config.resolver.ts` | Keep `resolveLearningConfig` for init-time use only, remove from resolved output |
| `src/brain/evaluator/class.ts` | Add `bypass` support to `Signal` type and `signal()` method |
| `src/brain/evaluator/types.ts` | Add `bypass?: boolean` to `Signal` interface |
| `server/index.ts` | Update `/brain/update` endpoint, update any `brain.config.learning` reads |
| `server/public/index.html` | Wire model dropdowns to `/brain/update` (separate task) |
| `evals/scripts/brain-08-brain-update.ts` | Update eval to verify new behavior |

---

## Out of scope (separate tasks)

- **Fix `createLearner()` duplicating existing learners** — add existing learner context to create prompt template
- **Wire UI model dropdowns to `/brain/update`** — add change handlers on dropdowns
- **`LearningConfig` fields on `BrainConfig`** — `name`, `instructions`, `description` are not currently on `LearningConfig` type. Need to add them or create a separate semantic update type.

---

## Resolved questions

1. **`LearningConfig` needs `instructions`, `name`, `description`.** All learners have these essential fields. Add them to `LearningConfig` so `brain.update({ learning: { instructions: "..." } })` type-checks. These are semantic fields — they go through the evaluator, not direct to learners.

2. **Evaluator should use `brain.config.blueprintModel`** for its LLM calls, not `brain.config.model`. The evaluator is a one-off decision-making step (like prompt generation), not a runtime operation. Update `Evaluator.evaluate()` to use `this.brain.config.blueprintModel`.
