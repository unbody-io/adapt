# Audit Feedback — Round 2

## Fixes Verified

- **Fix #1 (Understanding in store)**: ✅ Both learners write-through to `store.understanding` and restore on init.
- **Fix #3 (update() throws)**: ✅ `MemoryCollection.update()` now throws on not-found, consistent with `delete()`.
- **Fix #5 (query-method → query)**: ✅ Directory moved, all imports updated. Zero references to `query-method` remain.

---

## Remaining Issues

### 1. Backward compat methods still exist — delete them all

We do not need any backward compatibility. If something doesn't match our current naming, it gets deleted. If external callers (Brain, evals) reference old names, those callers get updated now — not shimmed.

**Delete these methods:**

- `base/class.ts:300-303` — `getSynthesizeSystemPrompt()` → callers should use `getUnderstandSystemPrompt()`
- `text-learner/class.ts:175-177` — `getSynthesizeIdentity()` → callers should use `getUnderstandIdentity()`
- `text-learner/class.ts:191-193` — `getSynthesizeThresholds()` → callers should use `getUnderstandThresholds()`
- `list-learner/class.ts:165-167` — `getSynthesizeThresholds()` → callers should use `getUnderstandThresholds()`

**And fix the one caller that uses them:**

- `src/brain/evolution/prompt.template.update.ts:22-25` — uses `getSynthesizeThresholds` with `as any` cast. Change to `getUnderstandThresholds`. This also eliminates the only `any` cast in production code.

**Also delete:**

- `text-learner/types.ts:13-17` — re-exports marked "backward compat" (`TokenUsage`, `UnderstandThresholds`, `QueryResult`, `EventUsage`). If anything imports these from `text-learner/types`, update the import to the canonical source.

---

### 2. `getEvolution()` returns empty array — wire it or delete it

`base/class.ts:778-780`:
```typescript
getEvolution(): EvolutionEntry[] {
    // TODO: read from store.evolution when fully migrated
    return []
}
```

Evolution records ARE being written to `store.evolution.add()` in `handleLearnResult()` (line 862). But `getEvolution()` ignores the store and returns `[]`. This is broken — data goes in but never comes out.

**Action**: Read from `store.evolution.list()` and map to `EvolutionEntry[]`. Or if the `EvolutionEntry` type from `types.ts` doesn't match `EvolutionRecord` from the store, reconcile them (the shapes are slightly different — `EvolutionEntry` has `timestamp`, `EvolutionRecord` has `createdAt` + `reasoning`).

---

### 3. `EvolutionEntry` vs `EvolutionRecord` — two types for the same thing

- `src/learners/types.ts` defines `EvolutionEntry` (with `timestamp`, no `reasoning`, no `id`)
- `src/learners/stores/types.ts` defines `EvolutionRecord` (with `createdAt`, `reasoning`, `id`)

The spec says `EvolutionEntry → EvolutionRecord` (PLAN.md Decision Log). `EvolutionEntry` should be removed and all references updated to `EvolutionRecord`. Currently `BaseLearner` imports `EvolutionEntry` for `getEvolution()` return type.

---

### 4. `store.state` is never used — init always burns LLM calls

The `state` collection exists in the Store interface but no learner ever reads or writes to it. Per the spec (store.spec.md "State Collection Contents"), state should store:
- `observation_schema`, `understanding_schema`
- `observe_identity`, `understand_identity`
- `observe_prompt`, `understand_prompt`

Currently all of these live as class properties (`this.observeSystemPrompt`, `this._observeIdentity`, etc.).

**The concrete problem**: When a learner is restored from an existing store (e.g. a SQLite DB that already has observations, understanding, and evolution), `init()` still makes 2+ LLM calls to regenerate identities and prompts from scratch — even though the store has all the data needed to skip this. If identities/prompts were persisted to `store.state` during the first init, subsequent inits could restore them without LLM calls.

The schemas (`observation_schema`, `understanding_schema`) are clearly Effort C. But identity and prompt caching in `store.state` is an Effort B concern — it's part of "store is single source of truth."

**Action**:
1. `init()`: check `store.state` for cached identities/prompts → if found, restore them, skip LLM calls → if not found, generate via LLM, save to `store.state`
2. `update()` changes instructions: existing regen logic already runs → after regeneration, overwrite `store.state` with new values

No hashing, no invalidation logic needed. The learner already knows when to regenerate (the `needsObserveRegen`/`needsUnderstandRegen` flags in `update()`). The store is dumb storage — it holds data, the learner holds logic. Don't conflate loading state from storage with the decision of when to regenerate.

---

### 5. `BaseLearner<any>` in Brain code

`src/brain/evolution/prompt.template.update.ts:15`:
```typescript
learner: BaseLearner<any>
```

Rule 2: "No `any` escape hatches." This should be `BaseLearner<unknown>`.

---

## Summary

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | Backward compat methods | **High** | Delete all `getSynthesize*` methods + backward compat re-exports. Fix callers. |
| 2 | `getEvolution()` returns `[]` | **Medium** | Wire to `store.evolution.list()` |
| 3 | `EvolutionEntry` vs `EvolutionRecord` | **Medium** | Remove `EvolutionEntry`, use `EvolutionRecord` everywhere |
| 4 | `store.state` unused — init wastes LLM calls | **Medium** | Persist identities/prompts to `store.state`, restore on init. Or defer explicitly with TODO + spec note. |
| 5 | `BaseLearner<any>` | **Low** | Change to `BaseLearner<unknown>` |

**Rule reminder**: We do not need any backward compatibility. Old names get deleted and callers get updated. If something needs to be addressed later, write it down in specs — don't leave shim code in the codebase.
