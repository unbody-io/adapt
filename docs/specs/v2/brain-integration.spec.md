# Brain Integration Spec (v2)

> Covers Brain-level changes required after the v2 learner refactor (storage layer, list learners, `adjust()`).

## Context

The v2 refactor introduced:
- **Storage layer** — each learner persists its own state via a `Store`
- **List learner** — new type alongside text learner
- **`learner.adjust(directive)`** — incremental behavioral evolution (vs `update()` which rewrites)

Both learner types work in isolation. This spec addresses how Brain orchestrates them and what needs to change at the Brain level.

---

## 1. Bug Fixes

### 1.1 Evolution update handler: `synthesize` → `understand`

**File:** `src/brain/evolution/handlers/update.ts` (line 53)

The handler adapts thresholds to `{ synthesize: { thresholds } }` but learner `update()` expects `{ understand: { thresholds } }`. Threshold updates from evolution are silently ignored.

**Fix:** Change `synthesize` → `understand`.

### 1.2 Event type mismatch: `adjust` vs `update`

**File:** `src/brain/types.ts` (line 399)

`BrainOwnEventMap` declares action as `'create' | 'merge' | 'split' | 'adjust' | 'delete'` but `EVOLUTION_ACTIONS` defines `update: 'update'`.

**Fix:** Change event type to `'update'` to match `EVOLUTION_ACTIONS`.

### 1.3 Store not disposed on learner removal

**File:** `src/brain/class.ts` — `__removeLearner()`

Deletes from the map but never calls `store.dispose()`. Resource leak.

**Fix:** Call `learner.dispose()` (or equivalent) before removing. Learner should expose a `dispose()` method that calls `store.dispose()`.

### 1.4 `as any` casts in Brain

**File:** `src/brain/class.ts` — lines 190, 879

Bypass type safety in TextLearner construction and `learner.update()` calls.

**Fix:** Properly type the config objects and update inputs.

---

## 2. Evolution System: Type Awareness

### 2.1 Problem

The evolution system was built when only text learners existed. It cannot:
- Reason about learner types in evaluator decisions
- Create list learners from evolution actions
- Merge or split list learners (always produces text learners)
- Pass list governance config through evolution

### 2.2 Learner Type Descriptors

Each learner type exports a **descriptor** — static metadata that Brain's evolution system uses for dispatch and LLM prompts.

**Interface** (lives in `src/learners/base/` or `src/learners/types.ts`):

```ts
interface LearnerTypeDescriptor {
  type: string                        // 'text' | 'list' | future types
  description: string                 // when to use this type (for evaluator/decomposition prompts)
  factory(config, store): BaseLearner // instantiate the right class
  mergeUnderstandingSchema: ZodSchema // output schema for merge LLM (e.g., z.string() for text, z.array(itemSchema) for list)
  splitUnderstandingSchema: ZodSchema // output schema for split LLM
}
```

**Location:** distributed, per learner type:
- `src/learners/text-learner/descriptor.ts` → exports `textLearnerDescriptor`
- `src/learners/list-learner/descriptor.ts` → exports `listLearnerDescriptor`

**What stays where it is** (not duplicated in descriptor):
- Config schemas — remain in `schema.config.ts`
- Governance defaults — remain in `{type}-learner/config.defaults.ts`
- Understanding get/set/summary — remain as instance methods on learner
- Runtime understanding schemas — remain as learner state (generated at init)

### 2.3 Evaluator: Type-Aware Context

**`LearnerContext`** (`src/brain/evaluator/types.ts`) gains a `type` field:

```ts
interface LearnerContext {
  id: string
  name: string
  type: string           // ← new
  purpose: string
  understandingSize: number
  health: { ... }
  metrics: { ... }
}
```

The evaluator prompt is updated to include available learner types and their descriptions (sourced from descriptors). The evaluator can then make type-informed decisions: "this should be a list learner, not text."

### 2.4 Learner Generation Prompt: Dynamic

`src/brain/prompts/prompt.fragment.learner-generation.ts` currently hardcodes type descriptions. This becomes dynamic — built from registered descriptors so adding a new learner type doesn't require editing prompt files.

### 2.5 Merge/Split Handlers: Type-Aware

**Constraint:** merge/split operate on same-type learners only. Cross-type merge/split is not supported (the types have fundamentally different understanding formats).

**Merge handler changes:**
- Determine type from source learners (all must be same type)
- Use descriptor's `mergeUnderstandingSchema` for LLM output
- Use `learner.getUnderstanding()` + `learner.getSummary()` for prompt building
- Create new learner via descriptor's factory
- Call `setUnderstanding()` with typed result

**Split handler changes:**
- Determine type from source learner
- Use descriptor's `splitUnderstandingSchema` for LLM output
- Create new learners via descriptor's factory
- Call `setUnderstanding()` with typed results per split learner

**Create handler changes:**
- LLM decomposition already outputs `type` field in config
- Use descriptor's factory instead of hardcoded if/else
- `createCompleteConfig()` uses descriptor for proper governance defaults

### 2.6 Brain Factory: Descriptor-Driven

`createLearnerFromConfig()` replaces its if/else dispatch with descriptor lookup:

```ts
// Before
if (config.type === 'list') { new ListLearner(...) } else { new TextLearner(...) }

// After
const descriptor = this.learnerTypes.get(config.type)
descriptor.factory(config, this.storeFactory())
```

Brain receives descriptors at construction (or uses a default set).

---

## 3. Evolution Update Action: `adjust()` + `update()`

### 3.1 Problem

The evolution update handler (`src/brain/evolution/handlers/update.ts`) currently:
1. Calls its own LLM to generate specific config changes (name, description, instructions, thresholds)
2. Applies everything via `learner.update()`

This duplicates what `adjust()` does for behavioral changes, and does it worse — `update()` rewrites instructions and regenerates prompts from scratch, while `adjust()` evolves them incrementally by showing the LLM the current state.

### 3.2 Solution

The evolution update handler uses **both methods** for what each is designed for:

- **`learner.adjust(guidance)`** for behavioral evolution — instructions, identity, prompts, schemas. This is the incremental/adaptive path.
- **`learner.update({...})`** for mechanical config — name, description, thresholds. These are specific field values.

### 3.3 Handler Flow

```
1. LLM generates update plan from guidance:
   - mechanical: { name?, description?, thresholds? }
   - behavioral: string (directive for adjust, or empty if no behavioral change needed)

2. If behavioral directive exists:
   → learner.adjust(directive)

3. If mechanical fields exist:
   → learner.update({ name, description, understand: { thresholds } })
```

The handler's LLM call remains but its job changes — instead of generating full config replacements, it **decomposes the guidance** into a behavioral directive (for `adjust`) and mechanical values (for `update`).

### 3.4 Action Name

The evolution action stays named `update`. It maps to `EVOLUTION_ACTIONS.update = 'update'`. The event types are fixed to match (see bug fix 1.2).

---

## 4. Learner Management: Two Tiers

### 4.1 Problem

All manual learner operations (`createLearner`, `deleteLearner`, `updateLearner`, `mergeLearners`, `splitLearner`) require `evolution.enabled = true` because they route through the `EvolutionOrchestrator`. Basic operations like removing a learner or adjusting its behavior shouldn't need the evolution system.

### 4.2 Basic Tier (always available)

These work regardless of `evolution.enabled`:

```ts
brain.addLearner(config: GeneratedLearnerConfig): Promise<BaseLearner>
// Already exists. Creates learner from explicit config.

brain.removeLearner(id: string): Promise<void>
// New. Disposes store, removes from map, emits event.

brain.adjustLearner(id: string, directive: string): Promise<{ changedFields: string[] }>
// New. Pass-through to learner.adjust(directive).
```

### 4.3 Evolution Tier (requires `evolution.enabled`)

These need LLM orchestration and remain behind evolution:

```ts
brain.createLearner(guidance: string): Promise<BaseLearner>
// LLM generates config from natural language.

brain.updateLearner(id: string, guidance: string): Promise<BaseLearner>
// LLM decomposes guidance → adjust() + update().

brain.deleteLearner(id: string): Promise<void>
// Routes through evolution for audit trail.

brain.mergeLearners(ids: string[], guidance: string): Promise<BaseLearner>
// LLM-orchestrated merge.

brain.splitLearner(id: string, guidance: string): Promise<BaseLearner[]>
// LLM-orchestrated split.
```

### 4.4 `removeLearner` vs `deleteLearner`

- **`removeLearner(id)`** — basic. Immediate removal + store dispose. No LLM. No evolution record.
- **`deleteLearner(id)`** — evolution. Goes through orchestrator. Creates audit trail. Requires evolution enabled.

---

## 5. Governance Cascade Fix

### 5.1 Problem

`brain.update()` governance cascade (lines 868-874) only handles text governance fields (`strategy`, `maxTokens`). List governance fields (`deduplication`, `maxItems`, `pruning`) are not cascaded.

### 5.2 Fix

Pass governance config through to learners without type-specific assumptions. Each learner's `applyTypeSpecificUpdates()` already handles its own governance fields — Brain just needs to forward the full governance object, not cherry-pick fields.

---

## 6. File Changes Summary

| File | Change |
|------|--------|
| `src/learners/base/types.ts` or `src/learners/types.ts` | Add `LearnerTypeDescriptor` interface |
| `src/learners/text-learner/descriptor.ts` | New — text learner descriptor |
| `src/learners/list-learner/descriptor.ts` | New — list learner descriptor |
| `src/brain/class.ts` | Descriptor-driven factory, `removeLearner()`, `adjustLearner()`, fix `as any` casts, fix store dispose |
| `src/brain/types.ts` | Fix event type mismatch, add `type` to learner events |
| `src/brain/evaluator/types.ts` | Add `type` to `LearnerContext` |
| `src/brain/evaluator/prompt.system.ts` | Type-aware evaluator prompt |
| `src/brain/evaluator/prompt.template.evaluation.ts` | Include learner type in context |
| `src/brain/evolution/handlers/update.ts` | Use `adjust()` + `update()`, fix `synthesize` → `understand` |
| `src/brain/evolution/handlers/merge.ts` | Type-aware merge via descriptors |
| `src/brain/evolution/handlers/split.ts` | Type-aware split via descriptors |
| `src/brain/evolution/utils.ts` | `createCompleteConfig` uses descriptor |
| `src/brain/evolution/schemas/merge.ts` | Type-aware understanding schema |
| `src/brain/evolution/schemas/split.ts` | Type-aware understanding schema |
| `src/brain/prompts/prompt.fragment.learner-generation.ts` | Dynamic type descriptions from descriptors |
| `src/brain/config.defaults.ts` | Remove text-specific governance defaults (move to descriptor) |

---

## 7. Eval Updates

Existing brain evals need updating to reflect the changes in this spec. New evals are needed for new functionality.

### 7.1 Existing Evals — Required Updates

| Script | Current | Update |
|--------|---------|--------|
| `brain-01-initialization.ts` | Tests decomposition into learners | Verify descriptor-driven factory is used. Verify both text and list learners can be created from decomposition. |
| `brain-03-manual-create.ts` | Tests `brain.createLearner(guidance)` | Verify type-aware creation — test creating both a text learner and a list learner via guidance. |
| `brain-04-manual-merge.ts` | Tests merge of two text learners | Add scenario: merge two list learners. Verify understanding format preserved (ListItem[], not string). Verify cross-type merge is rejected. |
| `brain-05-manual-split.ts` | Tests split of a text learner | Add scenario: split a list learner. Verify resulting learners are list type with ListItem[] understanding. |
| `brain-06-manual-update.ts` | Tests `brain.updateLearner(id, guidance)` via evolution | Verify handler uses `adjust()` for behavioral changes + `update()` for mechanical changes. Verify instructions evolve incrementally (not rewritten from scratch). |
| `brain-07-manual-delete.ts` | Tests `brain.deleteLearner(id)` | Verify `store.dispose()` is called on the removed learner. |
| `brain-08-brain-update.ts` | Tests `brain.update()` 3 categories | Fix governance cascade test to include list governance fields. Verify `understand.thresholds` (not `synthesize.thresholds`) reaches learners. |
| `brain-13-multi-type-learners.ts` | End-to-end with mixed types | Verify learner types are visible in evaluator context. Verify evolution decisions reference types correctly. |

### 7.2 New Evals

| Script | Purpose | Key Scenarios |
|--------|---------|---------------|
| `brain-14-basic-learner-management.ts` | Tests basic tier (no evolution required) | • `addLearner(config)` — add text and list learners manually • `removeLearner(id)` — verify store disposed, learner gone, event emitted • `adjustLearner(id, directive)` — verify pass-through to `learner.adjust()`, instructions changed • All work with `evolution.enabled = false` |
| `brain-15-type-aware-evolution.ts` | Tests type awareness in evolution system | • Evaluator context includes `type` per learner • Evaluator prompt references available types • Evolution create decision can specify list type • Evolution update decision uses `adjust()` for behavioral + `update()` for mechanical |
| `brain-16-restore.ts` | Tests Brain persistence and restore flow | • Create brain with SQLiteBrainStore, inject data, verify learners have understanding • Dispose brain • Create new Brain with same store + same storeFactory (learnerId-based) • Call `initialize()` — should restore from store, NOT run LLM decomposition • Verify: same learners exist (same IDs, types, names), understanding intact, prompt restored • Verify: coverage gap counters restored • Inject more data post-restore — verify learners continue learning |
| `brain-17-restore-evolution.ts` | Tests evolution history persistence across restarts | • Create brain, trigger several evolution evaluations • Dispose, restore • Verify evolution history accessible • Trigger new evaluation — verify it has context of past decisions |
