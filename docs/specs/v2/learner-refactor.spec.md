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

Same renames.

**Important**: ListLearner understand must be redesigned as an **agentic tool-based flow**, not a single-shot structured LLM call. See "B8: ListLearner Agentic Understand" below.

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

## B8: ListLearner Agentic Understand

### Why agentic

Per architecture-v2.spec.md (Section 6): ListLearner understanding is potentially large and won't fit in the LLM context window. The whole point of the store layer is to decouple understanding from context limits. Dumping all items into a prompt defeats that purpose.

The understand operation must be an agentic tool-based flow where the LLM uses store methods as tools to read, search, add, update, and remove items iteratively.

### How it works

The LLM agent receives:
- The learner's understand identity (who it is, what it tracks)
- The buffered observations to integrate
- Tools that wrap `store.understanding.*` methods

The agent processes observations by using tools — checking for existing items, updating them, adding new ones, removing stale ones. Each tool call is an individual operation against the store.

### Tools

These wrap the store's understanding collection CRUD:

| Tool | Store method | Purpose |
|------|-------------|---------|
| `list_items` | `store.understanding.list()` | Browse current items |
| `search_items` | `store.understanding.list(filter)` | Find items matching criteria |
| `get_item` | `store.understanding.get(id)` | Get a specific item by ID |
| `add_item` | `store.understanding.add(record)` | Add a new item |
| `update_item` | `store.understanding.update(id, changes)` | Update an existing item |
| `remove_item` | `store.understanding.delete(id)` | Remove an item |
| `done` | — | Terminal tool: signals agent is finished, returns evolution/significance |

Read tools (`list_items`, `search_items`, `get_item`) can be shared with query — they already exist in `list-learner/query-tools.ts`. Write tools are new.

### Schema validation in write tools

`add_item` and `update_item` validate item data against the understanding schema before writing to the store. If validation fails, the tool returns an error message (not an exception) to the agent:

```
"Validation failed: field 'calories' expected number, got string"
```

The agent sees this in the tool result and can self-correct on the next step. This is the Layer 2 validation — it moves from `setUnderstanding()` into the tools themselves.

### Deduplication

Two layers, same as current design:

1. **Agent-level** (smart): The system prompt instructs the agent to search for existing items before adding. The agent uses `search_items`/`list_items` to check, then calls `update_item` instead of `add_item` when a match is found.
2. **Governance post-pass** (mechanical safety net): `postProcessUnderstanding()` → `applyListGovernance()` runs after the agent completes. Catches anything the agent missed — strict dedup, maxItems enforcement, pruning. Already exists, unchanged.

### System prompt

The current system prompt dumps all items into the prompt. The new prompt removes that entirely:

- **Understand identity** — already generated by `initUnderstand()`. Describes who you are, what you track, matching criteria, when to add vs update vs remove, significance levels. Unchanged.
- **Observations** — passed as user prompt (same as current).
- **Tool usage instructions** — similar pattern to query's prompt: "Use tools to browse your collection, check for existing items before adding, then add/update/remove as needed."
- **No items in the prompt** — the agent reads them via tools when it needs to.

`initUnderstand()` and the identity generation stay the same. The identity already contains the matching criteria and decision logic the agent needs.

### Blueprint self-questioning

The blueprint LLM calls — `initObserve()`, `initUnderstand()`, `generateSchemas()` — should reason about what dimensions matter for this specific domain before producing their output. The prompts for these calls should instruct the LLM to ask itself questions like:

- Does time/date of events matter? Should observations include timestamps?
- Are there quantities, amounts, or measurements to track?
- Are there categories or enums (e.g., meal types, status values)?
- Do relationships between items matter (e.g., "related to item X")?
- What makes two observations refer to the same thing? (matching criteria)
- Is ordering/sequence important?
- Are there confidence-affecting factors (source reliability, recency)?

This self-questioning improves the quality of generated observer prompts (what to extract), observation schemas (what shape), understand identities (how to process), and understanding schemas (what to store). Getting these right is critical for the agentic understand — the agent makes per-item decisions based on what the observer extracted and what the schema expects.

### Implementation pattern

Uses the same `generate()` + `tool()` from Vercel AI SDK, same agentic loop as query (`ToolBasedMethod`):

```typescript
const result = await generate({
  model,
  system: buildUnderstandPrompt(identity),
  prompt: formatObservations(observations),
  tools: { ...readTools, ...writeTools, done: doneTool },
  toolChoice: 'required',
  stopWhen: stepCountIs(MAX_STEPS),
  onStepFinish: handleStep,
})
```

No new infrastructure needed — identical pattern to `src/learners/base/query/tool-based.ts`.

### Integration with BaseLearner pipeline

`callUnderstand()` runs the agent loop internally. The agent writes directly to the store via tools. After the agent completes:

1. Read back final items from store
2. Return as `newUnderstanding` in `UnderstandCallResult`
3. `postProcessUnderstanding()` applies governance (dedup, maxItems, pruning)
4. `setUnderstanding()` writes the governed result back and syncs in-memory cache

`setUnderstanding()` becomes a pure setter — no validation, no filtering. Just store + cache sync + event emission.

### What changes from current implementation

| Current | New |
|---------|-----|
| Single `generate()` call with all items in prompt | Agentic loop with store-backed tools |
| `applyOperations()` mechanical helper | Agent uses tools directly |
| All items must fit in context | Only items the agent reads via tools are in context |
| No self-correction on bad output | Agent gets validation errors from tools, can retry |
| Validation in `setUnderstanding()` | Validation in write tools |
| Dedup only in governance post-pass | Agent checks for dupes first, governance as safety net |
| System prompt includes all items | System prompt has no items — agent reads via tools |

### Reference

architecture-v2.spec.md Section 6:
> List: LLM uses store methods as tools to add/update/remove items (agentic)
> List: potentially large → agentic (tools)

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
