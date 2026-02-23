# Learner Refactor Specification

> **Effort B**: Wire learners to Store. Eliminate BaseLearningMethod. Rename synthesize to understand.
> Self-contained — no external spec dependencies.
> **Prerequisite**: Effort A complete (store layer working and tested).

---

## Overview

The refactor reorganizes ownership:
- **Learner** becomes the sole orchestrator (all logic, governance, pipeline)
- **Store** is an injected dumb CRUD adapter (pure persistence, zero logic)
- **Observer** becomes a shared module (one implementation, type-agnostic)
- **understand** replaces synthesize (built-in per type, not pluggable)
- `BaseLearningMethod` is eliminated entirely (pipeline absorbed into Learner)

**Scope**: Only `src/learners/`. Brain factory gets minimal config field renames (~10 lines).

---

## B1: Shared Observer Module

Move text learner's observe implementation to shared module:

```
FROM: src/learners/text-learner/learning-methods/default-method/observe/
TO:   src/learners/observer/
```

**File moves** (no functional changes, just relocation + import path updates):

| From | To |
|------|----|
| `observe/index.ts` | `observer/index.ts` (functions: `initObserve`, `observe`) |
| `observe/types.ts` | `observer/types.ts` |
| `observe/schema.identity.ts` | `observer/schema.identity.ts` |
| `observe/schema.output.ts` | `observer/schema.output.ts` |
| `observe/prompt.template.identity.ts` | `observer/prompts/identity.ts` |
| `observe/prompt.template.system.ts` | `observer/prompts/system.ts` |
| `observe/prompt.template.user.ts` | `observer/prompts/user.ts` |

The text learner's observe prompts are already generic (no text-specific language). List learner's observe uses slightly different prompts — the shared observer should be type-agnostic.

**Validation**: TypeScript compilation passes, observe behavior unchanged.

---

## B2: Move Synthesize to Understand

### Text Learner

```
FROM: src/learners/text-learner/learning-methods/default-method/synthesize/
TO:   src/learners/text-learner/understand/
```

Renames:
- `initSynthesize` → `initUnderstand`
- `synthesize` → `understand`
- `SynthesizeIdentity` → `UnderstandIdentity`
- `SynthesizeOutput` → `UnderstandOutput`
- `SynthesizeContext` → `UnderstandContext`

**No prompt changes** — all LLM prompts preserved exactly as-is.

### List Learner

```
FROM: src/learners/list-learner/learning-methods/default-method/synthesize.ts
TO:   src/learners/list-learner/understand/index.ts
```

Same renames. `applyOperations()` helper stays with it (it's part of the understand operation).

**Validation**: TypeScript compilation passes, understand behavior unchanged.

---

## B3: Rewrite Base Learner

### What Moves In (from BaseLearningMethod)

- Observer identity + system prompt management
- Understand identity + system prompt management
- The `learn()` pipeline: observe → store → threshold check → understand → governance → set understanding
- Buffer access: `getBufferState()` and `getBufferedObservations()` now via store
- `update()` config propagation for observer/understand models and prompts
- Prompt regeneration logic (when instructions/focus change)

### What Stays (from current BaseLearner)

- Health tracking, metrics, evolution, events, signals — all unchanged
- `handleLearnResult()` — unchanged
- `query()` — unchanged (delegates to QueryMethod)
- `checkAndEmitSignals()` — unchanged

### Store Injection

```typescript
constructor(config: { store: Store, ...rest }) {
  this.store = config.store
}
```

Learner has no knowledge of store types — just uses the `Store` interface. Caller decides the adapter.

### New Config Structure

```typescript
interface BaseResolvedConfig extends ResolvedCascadableConfig {
  instructions: string
  id: string
  origin: LearnerOrigin
  observer: { model: LanguageModel; blueprintModel: LanguageModel }
  understand: {
    model: LanguageModel
    blueprintModel: LanguageModel
    thresholds: Required<UnderstandThresholds>
  }
  query: { model: LanguageModel }
}

interface UnderstandThresholds {
  maxObservations?: number
  maxTokens?: number
  minImportance?: number
}
```

Key renames: `observe` → `observer`, `synthesize` → `understand`, `SynthesizeThresholds` → `UnderstandThresholds`.

### Event Names — ALL Preserved

**Event names**: ALL preserved as-is (`learner:synthesized`, `learner:synthesize:started`, etc.) for backward compat with Brain.

**LearnOutput**: ALL status strings preserved as-is (`'synthesized'`, `'synthesize:dismissed'`, etc.).

### New Abstract Methods

Subclasses implement:

```typescript
abstract getUnderstanding(): TUnderstanding
abstract setUnderstanding(value: TUnderstanding): void
abstract getSummary(): string
abstract hasKnowledge(): boolean

protected abstract regenUnderstandPrompt(
  model: LanguageModel,
  instructions: string
): Promise<void>

protected abstract callUnderstand(
  model: LanguageModel,
  understanding: TUnderstanding,
  observations: string[],
  callbacks?: { onThinking?: (thoughts: string[]) => void },
): Promise<UnderstandCallResult>

protected abstract postProcessUnderstanding(
  raw: TUnderstanding
): TUnderstanding | Promise<TUnderstanding>

protected abstract createQueryMethod(): QueryMethod
protected abstract applyTypeSpecificUpdates(...): void
```

### The learn() Pipeline

Updated with persistent observations and `metadata_status`:

```
learn(batch):
  1. callObserve(observerModel, observeSystemPrompt, batch)     [shared observer]
  2. Filter by minImportance threshold                           [shared]
  3. store.observations.add(obs) for each                        [shared, via store]
     (obs includes metadata_status: 'pending')
  4. Check shouldUnderstand (pending count/token thresholds)     [shared]
  5. If triggered:
     a. pending = store.observations.list({ metadata_status: 'pending' })
     b. result = callUnderstand(model, understanding, pending)   [type-specific]
     c. processed = postProcessUnderstanding(result)             [type-specific]
     d. setUnderstanding(processed)                              [type-specific]
     e. Mark pending observations as metadata_status='processed' [shared, via store]
  6. handleLearnResult(result)                                   [shared bookkeeping]
```

Observations are **never deleted** — they're the permanent raw record. After understand, they're marked `processed`, not cleared.

### Buffer Metrics from Store

Replaces `ObservationBuffer` computed properties:

```typescript
protected async getBufferState() {
  const pending = await this.store.observations.list({ metadata_status: 'pending' })
  const count = pending.length
  const avgImportance = count > 0
    ? pending.reduce((sum, o) => sum + o.metadata_importance, 0) / count
    : 0
  const totalTokens = Math.ceil(
    pending.reduce((sum, o) => sum + JSON.stringify(o.data).length, 0) / 4
  )
  return { count, avgImportance, totalTokens }
}

protected async shouldUnderstand(
  thresholds: Required<UnderstandThresholds>,
  force?: boolean
): Promise<boolean> {
  if (force) return true
  const { count, totalTokens } = await this.getBufferState()
  return count >= thresholds.maxObservations || totalTokens >= thresholds.maxTokens
}
```

**Validation**: TypeScript compilation passes.

---

## B4: Rewrite TextLearner + ListLearner Subclasses

### TextLearner — Thin Subclass

```typescript
class TextLearner extends Learner<string, ResolvedTextLearnerConfig> {
  // Understanding via store
  async getUnderstanding(): Promise<string> {
    const record = await this.store.understanding.get('understanding')
    return record?.data ?? ''
  }

  async setUnderstanding(text: string): Promise<void> {
    await this.store.understanding.update('understanding', { data: text, ... })
    this.emit('learner:understanding:set', { learnerId: this.id, understanding: text })
  }

  // Understand operation
  protected async callUnderstand(model, understanding, observations, callbacks) {
    // calls understand() from text-learner/understand/
  }

  protected async postProcessUnderstanding(raw: string): Promise<string> {
    return applyStrategy(raw)  // from strategies/
  }

  // Query (unchanged)
  protected createQueryMethod(): QueryMethod {
    return new ToolBasedMethod(this.config.query.model, {
      tools: { readUnderstanding: createReadUnderstandingTool(...) },
      buildPrompt: buildTextQueryPrompt,
    })
  }
}
```

### ListLearner — Same Pattern

```typescript
class ListLearner extends Learner<ListItem[], ResolvedListLearnerConfig> {
  // Understanding via store
  async getUnderstanding(): Promise<ListItem[]> {
    const records = await this.store.understanding.list()
    return records.map(r => r.data)
  }

  async setUnderstanding(items: ListItem[]): Promise<void> {
    // Apply add/update/remove actions to store.understanding
    this.emit('learner:understanding:set', { learnerId: this.id, understanding: items })
  }

  // postProcessUnderstanding calls applyListGovernance()
}
```

### Preserved Behaviors

| Aspect | Status |
|--------|--------|
| All LLM prompts (observe identity, system, user) | Preserved exactly |
| All LLM prompts (synthesize/understand identity, system, user) | Preserved exactly |
| Event names (`learner:synthesized`, etc.) | Preserved exactly |
| LearnOutput status strings (`'synthesized'`, etc.) | Preserved exactly |
| Health/metrics/signals logic | Preserved exactly |
| Query tools + ToolBasedMethod | Preserved exactly |
| Text strategies (continuous/cumulative/decay) | Preserved exactly |
| List governance (dedup/pruning/maxItems) | Preserved exactly |
| Model cascading | Preserved exactly |
| Evolution tracking | Preserved (moved to store) |

**Validation**: TypeScript compilation + smoke test (init/learn/query).

---

## B5: Update Config Types + Resolvers

**Input config renames** (TextLearnerConfig, ListLearnerConfig):
- `observe` → `observer` (optional model overrides)
- `synthesize` → `understand` (optional model overrides + thresholds)
- Remove `method` fields (`observe.method`, `synthesize.method` — not pluggable)

**Config resolvers**: field renames, same cascade logic, same defaults.

**Config defaults**: field renames only, same values.

**schema.config.ts**: no structural changes (LLM generates `type`/`instructions`/`governance` — doesn't reference observe/synthesize).

---

## B6: Update Exports + Brain Factory

### Exports (`src/learners/index.ts`)

- **Remove**: `BaseLearningMethod`, `TextDefaultMethod`, `ListDefaultMethod`, `ObserveConfig`, `SynthesizeConfig`
- **Add**: Store types, `MemoryStore`, `ObservationRecord`
- **Rename**: `SynthesizeThresholds` → `UnderstandThresholds`
- **Keep**: all other exports

### Brain factory (`src/brain/class.ts`)

~10 line update: rename config fields in `createLearnerFromConfig()`:
- `synthesize: { thresholds: {...} }` → `understand: { thresholds: {...} }`

---

## B7: Delete Old Files + Update Eval Scripts

### Files to Delete

```
src/learners/base/learning-method/          (entire directory)
src/learners/base/query-method/             (after moving to base/query/)
src/learners/text-learner/learning-methods/ (entire directory)
src/learners/list-learner/learning-methods/ (entire directory)
```

### Eval Script Updates

Update all eval scripts that reference old types or patterns.

### Validation

1. TypeScript compilation: `npx tsc --noEmit`
2. Smoke test: TextLearner + ListLearner init/learn/query
3. Store isolation: observations buffer in store, marked processed after understand
4. Governance: text strategies and list dedup/pruning still apply
5. Brain integration: Brain creates learners and routes data

---

## Target Directory Structure

```
src/learners/
├── index.ts                          (updated exports)
├── types.ts                          (UPDATED: EvolutionEntry → EvolutionRecord)
├── schema.config.ts                  (updated: observe→observer, synthesize→understand)
│
├── base/
│   ├── class.ts                      (REWRITTEN: Learner base with observe→understand pipeline)
│   ├── types.ts                      (REWRITTEN: new config structure, event map preserved)
│   └── query/                        (MOVED from base/query-method/)
│       ├── types.ts                  (unchanged)
│       └── tool-based.ts             (unchanged)
│
├── observer/                         (NEW: shared observer module)
│   ├── index.ts                      (initObserve, observe — from text-learner observe)
│   ├── types.ts
│   ├── schema.identity.ts
│   ├── schema.output.ts
│   └── prompts/
│       ├── identity.ts
│       ├── system.ts
│       └── user.ts
│
├── stores/                           (UPDATED: see store.spec.md)
│   ├── types.ts                      (UPDATED: unified record types + Collection interface)
│   ├── memory.ts                     (UPDATED: MemoryCollection with delete())
│   ├── sqlite.ts                     (NEW: SQLiteCollection + SQLiteStore)
│   └── index.ts                      (UPDATED: exports)
│
├── text-learner/
│   ├── class.ts                      (REWRITTEN: thin subclass of Learner<string>)
│   ├── types.ts                      (UPDATED: config renames)
│   ├── config.resolver.ts            (UPDATED: field renames)
│   ├── config.defaults.ts            (UPDATED: field renames)
│   ├── understand/                   (MOVED from learning-methods/default-method/synthesize/)
│   │   ├── index.ts                  (initUnderstand, understand)
│   │   ├── types.ts
│   │   ├── schema.identity.ts
│   │   ├── schema.output.ts
│   │   └── prompts/
│   │       ├── identity.ts
│   │       ├── system.ts
│   │       └── user.ts
│   ├── query-tools.ts                (unchanged)
│   ├── strategies/                   (unchanged)
│   ├── cognitive-skills/             (unchanged)
│   └── _tools/                       (unchanged)
│
├── list-learner/
│   ├── class.ts                      (REWRITTEN: thin subclass of Learner<ListItem[]>)
│   ├── types.ts                      (UPDATED: config renames)
│   ├── config.resolver.ts            (UPDATED: field renames)
│   ├── config.defaults.ts            (UPDATED: field renames)
│   ├── understand/                   (MOVED from learning-methods/default-method/)
│   │   ├── index.ts                  (initUnderstand, understand)
│   │   └── types.ts
│   ├── query-tools.ts                (unchanged)
│   └── governance.ts                 (unchanged)
```

**Files to DELETE** (after all moves complete):

```
src/learners/base/learning-method/          (entire directory)
src/learners/base/query-method/             (after moving to base/query/)
src/learners/text-learner/learning-methods/ (entire directory)
src/learners/list-learner/learning-methods/ (entire directory)
```
