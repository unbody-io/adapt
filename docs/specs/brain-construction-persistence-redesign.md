# Brain & Neuron Construction/Persistence Redesign + LLM Seam Hygiene

**Issues**: closes [#8](https://github.com/.../issues/8), partial [#9](https://github.com/.../issues/9) (parts 1 & 2; part 3 deferred).

**Supersedes**: [`docs/issue-8-fix-checklist.md`](../issue-8-fix-checklist.md) (delete on merge — written against the original "merge config on load" framing of #8, which was rewritten because it patched a symptom rather than the root API).

---

## Problem

`new Brain({...}) + brain.initialize()` is one path that does two unrelated jobs:

1. **Fresh creation** — first run, generate state, persist to store.
2. **Restore** — subsequent runs, load state from store.

`initialize()` decides which by peeking at the store. That single overloaded path causes:

- **Constructor config silently ignored on restore.** `loadState()` overwrites the constructor's values with what's on disk. Pass `evolution: { enabled: false }` on a restored brain → does nothing. Same class of bug at neuron level for user-provided `observationSchema` / `understandingSchema`.
- **Constructor must accept full config every run** even though most of it lives on disk.
- **Mental-model mismatch.** Users picking up where they left off don't think they're "re-constructing" the brain.

Same bug applies to standalone neurons (`new TextNeuron({...}) + neuron.init()` does the same overloaded thing) and to in-memory stores (`MemoryBrainStore` is hit by the same `loadState`-overwrites-constructor path within a single process).

The repo already persists model refs as `{ provider, modelId }` ([src/brain/state.ts:101–110](../../src/brain/state.ts#L101-L110)) but never rehydrates them — `deserialize: () => this.state.models` returns the constructor's instances ([src/brain/class.ts:73](../../src/brain/class.ts#L73)). The plumbing is half done.

---

## Goals

- Split construction and restore into two unambiguous static methods, at both Brain and Neuron level.
- Persist everything that is data; resolve the small set of runtime closures (the LLM call surface, hooks/listeners) through clear, code-grounded mechanisms.
- Make the constructor / overrides path always win over what's on disk — no silent overwrites.
- Fix #9's cheap hygiene (centralize `streamText`, route builder imports through `src/llm`) — these stand on their own and leave the LLM seam in a better shape if/when the BYO contract is revisited.

## Non-goals

- **BYO `generate` / `generateStream` injection** (issue #9 part 3). Cost is large (neutral contract design, two-path maintenance, locked-in public API designed without a real user). Benefit is speculative — no concrete user blocked today, and AI SDK is the boring-tech choice for an LLM library. Revisit when an actual BYO user appears.
- **Migration from older Adapt versions.** Old stores are incompatible. Users on prior versions wipe and restart, or write their own migration.
- **Behavioral changes** to neuron/synthesis/evolution beyond what construction & restore demand.

---

## Design

### 1. Public API

#### Brain

```ts
// Fresh — required: store + prompt + model. Throws if store is populated.
const brain = await Brain.create({
  store,                       // BrainStore instance — caller picks SQLite / Memory / custom
  prompt,
  model,                       // LanguageModel (live AI SDK model, or string "provider:modelId")
  // ...all current BrainConfig fields except `learning.store` (see §3)
})

// Restore — accepts either a path string (sugar for SQLiteBrainStore) or a store instance.
// Throws if no brain exists in the store.
const brain = await Brain.restore("brain.db")
const brain = await Brain.restore(memoryBrainStoreInstance)

// Override config post-restore via the existing API.
await brain.update({ evolution: { enabled: false } })
```

#### Standalone neurons

Neurons are first-class objects with their own lifecycle — they can be used independently of any Brain ([src/neurons/index.ts](../../src/neurons/index.ts) exports them; standalone usage is a supported path, not a side effect). They get the same construction split as Brain so the restore bug is fixed at both layers, not just inside Brain:

```ts
const neuron = await TextNeuron.create({ store, instructions, model, ... })
const neuron = await TextNeuron.restore("neuron.db" | storeInstance)
await neuron.update({ thresholds: { maxObservations: 50 } })

// Same for ListNeuron.
```

Inside Brain: `Brain.create` calls `TextNeuron.create` / `ListNeuron.create` per declared neuron; `Brain.restore` calls `TextNeuron.restore` / `ListNeuron.restore` per neuron in the registry.

#### Removed (no shims, per project convention)

- `new Brain({...})` constructor (public). Becomes private/internal.
- `brain.initialize()` overloaded entry point.
- `new TextNeuron({...})` and `new ListNeuron({...})` constructors (public). Become private/internal.
- `neuron.init()` overloaded entry point.
- `BrainConfig.autoSetup` stays — it's a create-time-only flag (LLM decomposition on first init). Not present in the restore path because it's meaningless there.
- `BrainConfig.learning.store` (factory) — eliminated, see §3.

All callers in `src/`, `tests/`, and `evals/` updated.

### 2. Error semantics

- `Brain.create(...)` on a store that already contains a brain → throws with: `Brain already exists in this store. Use Brain.restore() to load it, or use a fresh store.`
- `Brain.restore(...)` on a store with no brain → throws with: `No brain found in this store. Use Brain.create() to create one.`
- Same pattern for `TextNeuron.create` / `TextNeuron.restore` / `ListNeuron.create` / `ListNeuron.restore`.

A populated store is detected by checking the brain state row (or equivalent for neurons). No `force: true` escape hatch — destructive operations stay explicit and out-of-band (caller deletes file / disposes store).

### 3. Per-neuron store derivation (eliminate the factory)

Today: `BrainConfig.learning.store: (neuronId) => NeuronStore` is a closure passed at create time ([src/brain/types.ts:69](../../src/brain/types.ts#L69), called at [src/brain/class.ts:364, 413, 453, 626](../../src/brain/class.ts#L364)). The closure decides *where on disk* each neuron's data lives.

That closure is gone after the process restarts. Single-arg `Brain.restore("brain.db")` rules out asking the user to re-supply it. So restore needs another way to find each neuron's store. The natural alternative — a hardcoded "convention" used only on restore — has a hidden contradiction: the user's create-time factory and the restore-time convention can produce different paths. User wrote files under `/data/neurons/<id>.db`; restore looks for `brain.<id>.db` siblings; finds nothing; restores empty. Two mechanisms for the same job is exactly the bug class #8 is closing.

Resolution: **one mechanism for both directions, owned by the `BrainStore` impl.** Add a method:

```ts
interface BrainStore {
  // ...existing collections...
  getNeuronStore(neuronId: string): NeuronStore
  dispose?(): Promise<void>
}
```

Same code path on create and restore, so the two cannot disagree. Customization is by store impl (subclass / config knob on the store's constructor), not by handing the brain a closure.

Each `BrainStore` impl owns its convention:

- `SQLiteBrainStore("brain.db").getNeuronStore("coding")` → `new SQLiteNeuronStore("brain.coding.db")` (sibling file with the brain DB's stem as prefix). Path derivation lives inside the SQLite store; the same call produces the same path every run.
- `MemoryBrainStore().getNeuronStore(id)` → `new MemoryNeuronStore()`, **cached per id** (repeat calls return the same instance). Required for correctness: in-process `Brain.create` → `dispose` → `Brain.restore(sameMemBrain)` would otherwise see empty neuron stores on restore. The cache *is* the persistence layer for memory.
- Custom `BrainStore` impls own their own convention.

Effects:
- `BrainConfig.learning.store` field deleted.
- `Brain.create` and `Brain.restore` ask `store.getNeuronStore(id)` whenever they need a neuron's store.
- Standalone neurons unaffected — they take a `NeuronStore` directly. The factory was only ever a Brain-level concern.

### 4. Runtime resolution at restore

The single-arg `Brain.restore("brain.db")` resolves runtime-shaped things as follows:

| Runtime piece | Resolution |
|---|---|
| `BrainStore` | Path string → `new SQLiteBrainStore(path)`. Store instance → use as-is. |
| `NeuronStore` per neuron | `brainStore.getNeuronStore(neuronId)` (see §3). |
| `LanguageModel` (all model slots) | Persisted as `{ provider, modelId }`. Rehydrated as the string form `"provider:modelId"` and passed to AI SDK's call functions. AI SDK routes through Vercel AI Gateway by default ([ai/index.d.ts:96](../../node_modules/ai/dist/index.d.ts#L96), `LanguageModel = GlobalProviderModelId \| LanguageModelV3 \| LanguageModelV2`). User who wants a direct provider (no gateway) calls `await brain.update({ model: openai("gpt-4o") })` post-restore. No global registry. No `Adapt.configure(...)`. |
| Hooks / event listeners | Not persisted — they're observers, not state. Re-attached post-restore via the existing `brain.on(event, handler)` API. |

### 5. What's persisted

Everything that is data round-trips through the store. The boundary between data and runtime is:

- **Persisted (data)**: prompt, all model refs, ingest config, evolution config + counters, neuron registry (id + type + per-neuron config), internal neuron registry, evolution history, dismissed batches, neuron-level: instructions/name/description/focus/origin/observation_schema/understanding_schema/thresholds/prompts/identities/health/metrics/signals/observations/understanding/evolution. Schemas are already JSON-Schema (`Record<string, unknown>`), already serializable.
- **Not persisted (runtime closures)**: live `LanguageModel` instances, hooks/listeners. Rehydrated per §4.

Concretely on the bug's surface: the existing serialize side ([src/brain/state.ts](../../src/brain/state.ts), [src/neurons/base/state.ts](../../src/neurons/base/state.ts)) is correct. The deserialize side stops returning `this.state.models` ([src/brain/class.ts:73](../../src/brain/class.ts#L73)) and instead returns rehydrated string-form models from the persisted refs.

The constructor-config-overwritten-by-load bug disappears entirely — `loadState()` is only called from `Brain.restore` / `Neuron.restore`, and that's exactly when it should win. From `Brain.create` / `Neuron.create` the constructor is canonical and gets persisted; nothing reads back over it.

### 6. LLM seam hygiene (#9 parts 1 & 2)

Three small refactors, no public API change:

**6.1 Wrap `streamText`** ([src/llm/index.ts:24](../../src/llm/index.ts#L24)). Today re-exported from `'ai'` as-is. Replace with a thin wrapper:

```ts
export function generateStream(params: Parameters<typeof streamText>[0]): ReturnType<typeof streamText> {
  return streamText(params)
}
```

Passthrough today. Future-friendly seam — same shape as `generate()`. All call sites already import `streamText` from `src/llm`, so this is a one-file change plus rename at call sites (or keep export named `streamText` to skip the rename — implementer's call).

**6.2 Re-export `tool` from `src/llm`**. Currently not re-exported; ~10 call sites import directly from `'ai'`. Add to [src/llm/index.ts](../../src/llm/index.ts):

```ts
export { Output, stepCountIs, hasToolCall, streamText, tool } from 'ai'
```

Update all `import { tool } from 'ai'` to `from <relative-path-to-llm>`. Affected files (approximate, verify with grep at implementation time):
- `src/neurons/text/query-tools.ts`
- `src/neurons/list/query-tools.ts`
- `src/neurons/list/understand/index.ts`
- `src/neurons/text/understand/index.ts`
- `src/neurons/text/_tools/dismiss/tool.ts`
- `src/neurons/text/_tools/synthesize/tool.ts`
- `src/neurons/base/query/tool-based.ts`

**6.3 Replace direct `generateText` imports in two strategy files**:
- `src/neurons/text/strategies/decay/fn.ts`
- `src/neurons/text/strategies/cumulative/fn.ts`

Both use `import { generateText } from 'ai'`. Switch to `import { generate } from '<relative-path-to-llm>'` and use `generate()` (gets the JSON repair fallback for free).

After 6.1–6.3: `'ai'` is imported only from `src/llm/index.ts` for runtime values; `LanguageModel` and other types still come from `'ai'` directly (types are fine, they don't need the seam).

### 7. `dispose()` lifecycle

`SQLiteBrainStore` and `SQLiteNeuronStore` already implement `dispose()` ([src/stores/sqlite/node/brain.ts:61](../../src/stores/sqlite/node/brain.ts#L61), [src/stores/sqlite/node/neuron.ts:57](../../src/stores/sqlite/node/neuron.ts#L57)). `MemoryBrainStore` / `MemoryNeuronStore` have no-op `dispose()`. Add to Brain and standalone Neuron:

```ts
async dispose(): Promise<void> {
  await this.store.dispose?.()
  // For Brain: also dispose each neuron's store via brainStore.getNeuronStore(id)?.dispose
}
```

Avoids leaking SQLite handles; standardizes the close pattern across both API levels.

---

## Acceptance criteria

From issue #8, all of:

- `Brain.create({...})` and `Brain.restore({...})` exist with single, unambiguous purposes.
- After a brain has been used once, restoring it requires only the store (path or instance). Documented and justified for each runtime piece per §4.
- Caller-provided values via `brain.update(...)` post-restore override loaded values without surprises (already true of the existing `update()` implementation).
- Same property holds at the neuron level: `TextNeuron.create` / `TextNeuron.restore` / `neuron.update()` round-trip per-neuron config (instructions, schemas, thresholds, models).
- Existing eval and test suites pass after the redesign.
- Regression test (`tests/brain-restore-config.test.ts`) covers brain-level config knobs (`evolution`, `ingest`, thresholds), neuron-level user-provided schemas, and the no-overrides-on-restore behavior across multiple runs against the same store, against both `MemoryBrainStore` and `SQLiteBrainStore`.

Plus, from this spec:

- `Brain.create` on a populated store throws; `Brain.restore` on an empty store throws.
- Same on neurons.
- Old `new Brain(...)` / `new TextNeuron(...)` / `new ListNeuron(...)` removed; all callers in `src/`, `tests/`, `evals/` updated.
- `BrainConfig.learning.store` field removed; `BrainStore.getNeuronStore` method added; all impls (Memory, SQLite-Node, SQLite-Bun) provide it.
- `streamText` wrapped in `src/llm/index.ts`; `tool` re-exported; two strategy files use `generate()` instead of `generateText`.
- Direct `'ai'` imports of runtime values exist only inside `src/llm/index.ts` (types remain free to import from `'ai'`).
- `Brain.dispose()` / `Neuron.dispose()` exist and close the underlying store(s).

---

## Test coverage

**Convert** [`tests/brain-restore-config.test.ts`](../../tests/brain-restore-config.test.ts) to the new API. Two parametrized runs:
1. `MemoryBrainStore` — same scenario as today.
2. `SQLiteBrainStore` (temp file) — adds the disk round-trip.

Scenarios per run:
- `Brain.create` then `Brain.restore`: persisted runtime knobs (`ingest.batchSize`, `evolution.enabled`, neuron `thresholds.maxObservations`) survive the round-trip with their original values.
- `Brain.restore` followed by `brain.update({...})`: overrides apply and persist for the next run.
- `Brain.create` on a populated store throws.
- `Brain.restore` on an empty store throws.
- User-provided `observationSchema` / `understandingSchema` survive a `create → restore` round-trip and respect post-restore `update()` overrides.

**Add** `tests/neuron-restore-config.test.ts` covering the same shape against standalone `TextNeuron.create` / `TextNeuron.restore` / `neuron.update()` (no Brain in the loop).

**Remove**: any test that exercised the overloaded `new Brain(...) + initialize()` shape (after porting to `Brain.create` / `Brain.restore`).

---

## Implementation order

1. **#9.1 + #9.2 hygiene first** — small, isolated, no API change, gets the LLM seam clean before the bigger refactor.
   - Wrap `streamText` in `src/llm/index.ts`.
   - Re-export `tool` from `src/llm`.
   - Switch the two strategy files to `generate()`.
2. **`BrainStore.getNeuronStore` method** — add to interface + all impls. Wire `Brain` to call it instead of `learning.store` factory. Delete `BrainConfig.learning.store`.
3. **Standalone neuron split** — add `TextNeuron.create` / `TextNeuron.restore` / `ListNeuron.create` / `ListNeuron.restore` static factories. Move construction logic out of the public constructor; keep constructor private/internal. Implement throws for create-on-populated / restore-on-empty.
4. **Brain split** — add `Brain.create` / `Brain.restore` static factories on top of (3). Move construction logic out of `initialize()`; remove the overloaded entry point.
5. **Model rehydration** — change `stateTransforms.models.deserialize` at brain and neuron level to return string-form models from persisted refs (instead of `this.state.models`). Add the gateway-string conversion.
6. **`dispose()` lifecycle** — add to Brain and standalone Neuron, proxy to store.
7. **Update all callers** — `src/` (internal usages of removed APIs), `tests/`, `evals/`, any docs/examples.
8. **Tests** — convert `brain-restore-config.test.ts`; add `neuron-restore-config.test.ts`.
9. **Doc cleanup** — delete [docs/issue-8-fix-checklist.md](../issue-8-fix-checklist.md), update [src/index.ts](../../src/index.ts) example to new API, update CLAUDE.md memory references in the project.

Each step ends in a green test run before the next begins.

---

## Files affected (non-exhaustive)

**New/modified core**:
- [src/brain/class.ts](../../src/brain/class.ts) — add static `create`/`restore`, remove overloaded `initialize`, remove old constructor from public API.
- [src/brain/types.ts](../../src/brain/types.ts) — drop `BrainConfig.learning.store`, possibly split `BrainConfig` into `BrainCreateInput` and what `restore` accepts (likely none beyond store).
- [src/brain/state.ts](../../src/brain/state.ts) — model deserialize changes.
- [src/neurons/base/class.ts](../../src/neurons/base/class.ts) — same shape as Brain at the neuron layer.
- [src/neurons/base/state.ts](../../src/neurons/base/state.ts) — model deserialize changes.
- [src/neurons/text/class.ts](../../src/neurons/text/class.ts), [src/neurons/list/class.ts](../../src/neurons/list/class.ts) — add static `create`/`restore`.

**Stores**:
- [src/stores/types.ts](../../src/stores/types.ts) (or wherever `BrainStore` is declared) — add `getNeuronStore` method.
- [src/stores/memory/brain.ts](../../src/stores/memory/brain.ts), [src/stores/sqlite/node/brain.ts](../../src/stores/sqlite/node/brain.ts), [src/stores/sqlite/bun/brain.ts](../../src/stores/sqlite/bun/brain.ts) — implement `getNeuronStore`.

**LLM seam**:
- [src/llm/index.ts](../../src/llm/index.ts) — wrap `streamText`, re-export `tool`.
- ~10 files importing `tool` from `'ai'` — switch to `src/llm`.
- [src/neurons/text/strategies/decay/fn.ts](../../src/neurons/text/strategies/decay/fn.ts), [src/neurons/text/strategies/cumulative/fn.ts](../../src/neurons/text/strategies/cumulative/fn.ts) — switch from `generateText` to `generate`.

**Tests**:
- [tests/brain-restore-config.test.ts](../../tests/brain-restore-config.test.ts) — convert.
- `tests/neuron-restore-config.test.ts` — new file.

**Docs**:
- [docs/issue-8-fix-checklist.md](../issue-8-fix-checklist.md) — delete (superseded).
- [src/index.ts](../../src/index.ts) — update top-of-file example.

---

## Open implementation choices (left to the implementer)

- Whether the `streamText` wrapper keeps the export name `streamText` (no call-site renames) or `generateStream` (parallels `generate()` more cleanly). Either is fine — the seam is what matters.
- Whether `Brain.dispose` walks the live neuron map and disposes each neuron's store, or relies on the brain store knowing all its neuron stores. Either is fine; pick whichever leaks no handles.
