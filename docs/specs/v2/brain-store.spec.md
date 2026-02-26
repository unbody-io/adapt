# Brain Store Spec (v2)

> Brain-level persistence layer. Follows the same architectural patterns as the learner store but is fully isolated — no shared code between brain stores and learner stores.

## Context

Brain currently keeps all state in memory: prompt, config, learner registry, evolution history, coverage gap counters. Each learner persists its own state via its own store, but on restart Brain has no way to know which learners existed or what its purpose was.

This spec makes Brain a fully restorable entity.

---

## 1. BrainStore Interface

Fixed interface with 3 named collections:

```ts
interface BrainStore {
  state: BrainCollection<BrainStateRecord>
  registry: BrainCollection<BrainRegistryRecord>
  evolution: BrainCollection<BrainEvolutionRecord>
  dispose(): Promise<void>
}
```

### 1.1 BrainCollection Interface

Same CRUD pattern as learner collections, but independently defined:

```ts
interface BrainCollection<T extends { id: string }> {
  add(item: T): Promise<void>
  get(id: string): Promise<T | undefined>
  list(filter?: Record<string, unknown>): Promise<T[]>
  update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void>
  delete(id: string): Promise<void>
  clear(): Promise<void>
  count(filter?: Record<string, unknown>): Promise<number>
  addBatch(items: T[]): Promise<void>
  dispose(): Promise<void>
}
```

### 1.2 Record Types

**BrainStateRecord** — key-value pairs for Brain config and runtime state:

```ts
interface BrainStateRecord {
  id: string        // key name: 'prompt', 'config', 'coverage_gap_state', etc.
  value: unknown    // serialized value
  updated_at: string
}
```

**BrainRegistryRecord** — one record per learner:

```ts
interface BrainRegistryRecord {
  id: string          // learner ID
  type: string        // 'text' | 'list' | future types
  name: string
  description: string
  instructions: string
  config: unknown     // serialized learner config snapshot (governance, thresholds, etc.)
  created_at: string
  updated_at: string
}
```

**BrainEvolutionRecord** — evaluator decisions history:

```ts
interface BrainEvolutionRecord {
  id: string
  decisions: unknown    // serialized EvolutionDecision[]
  source: string        // 'auto' | 'manual'
  created_at: string
}
```

---

## 2. Implementations

### 2.1 MemoryBrainStore

In-memory implementation. Same behavioral pattern as `MemoryStore` for learners but independently implemented.

```ts
class MemoryBrainStore implements BrainStore {
  state = new MemoryBrainCollection<BrainStateRecord>()
  registry = new MemoryBrainCollection<BrainRegistryRecord>()
  evolution = new MemoryBrainCollection<BrainEvolutionRecord>()
  async dispose(): Promise<void> { /* no-op */ }
}
```

### 2.2 SQLiteBrainStore

SQLite implementation using better-sqlite3. Same behavioral pattern as `SQLiteStore` for learners but independently implemented.

- Creates 3 tables: `state`, `registry`, `evolution`
- Indexes on `updated_at`, `created_at`, `type`
- WAL journal mode
- `dispose()` closes the database connection

```ts
class SQLiteBrainStore implements BrainStore {
  constructor(path: string = ':memory:')
  // Creates tables, initializes collections
}
```

---

## 3. File Structure

```
src/brain/stores/
  types.ts              ← BrainStore, BrainCollection interfaces, record types
  memory.ts             ← MemoryBrainCollection, MemoryBrainStore
  sqlite.ts             ← SQLiteBrainCollection, SQLiteBrainStore
  index.ts              ← exports
```

Fully isolated from `src/learners/stores/`. No imports between the two.

---

## 4. Brain State Management

### 4.1 In-Memory Cache

Brain maintains a `BrainState` cache, same pattern as learner's `this.state`:

```ts
interface BrainState {
  prompt: string
  config: ResolvedBrainConfig     // models are live instances in cache
  coverageGapCount: number
  recentQueryCount: number
}
```

### 4.2 setState() / loadState()

Same dual-layer pattern as learners:

- **`setState(updates)`** — update in-memory cache + upsert each key into `store.state`
- **`loadState()`** — read all records from `store.state`, deserialize into cache, return `true` if found

### 4.3 State Transforms

Same registry pattern for serialization boundary:

```ts
stateTransforms: Record<string, BrainStateTransform> = {
  config: {
    serialize: (config) => {
      // Serialize model refs: LanguageModel → { provider, modelId }
      // Strip non-serializable fields
    },
    deserialize: (_stored) => {
      // Ignore stored model refs, use live instances from constructor
      return this.state.config
    },
  },
}
```

Models in config (init.model, query.model, etc.) serialize to `{ provider, modelId }` but on restore, live instances come from the constructor config — same pattern as learner model serialization.

---

## 5. Registry Management

### 5.1 Persisting Learners

When a learner is added to Brain (via `createLearnerFromConfig`, `addLearner`, or evolution create):

```ts
await this.store.registry.add({
  id: learner.id,
  type: config.type,
  name: config.name,
  description: config.description,
  instructions: config.instructions,
  config: serializeLearnerConfig(config),  // governance, thresholds, etc.
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})
```

### 5.2 Updating Registry

When a learner is adjusted or updated, the registry record is updated to reflect the current state:

```ts
await this.store.registry.update(learnerId, {
  name: learner.name,
  description: learner.description,
  instructions: learner.instructions,
  config: serializeLearnerConfig(currentConfig),
  updated_at: new Date().toISOString(),
})
```

### 5.3 Removing Learners

When a learner is removed (`removeLearner` or evolution delete):

```ts
await this.store.registry.delete(learnerId)
```

---

## 6. Restore Flow

### 6.1 Brain.initialize() — Updated

```
1. Try loadState() from store.state
2. If restored:
   a. Load registry records from store.registry
   b. For each registered learner:
      - Look up descriptor by type
      - Create store via storeFactory(learnerId)
      - Instantiate learner via descriptor factory
      - Call learner.init() → learner restores its own state from its store
      - Wire events, register in this.learners map
   c. Restore evolution orchestrator/evaluator if evolution enabled
   d. Skip LLM decomposition entirely
3. If not restored (fresh):
   a. Run LLM decomposition (current flow)
   b. Create learners, init each
   c. Persist state via setState()
   d. Persist each learner to registry
```

### 6.2 storeFactory Signature Change

```ts
// Before
storeFactory: () => Store

// After
storeFactory: (learnerId: string) => Store
```

On fresh creation, `learnerId` routes to a new store. On restore, it routes to the existing persisted store for that learner.

The consumer controls this mapping. For example with SQLite:

```ts
storeFactory: (learnerId) => new SQLiteStore(`./data/learners/${learnerId}.db`)
```

For memory (no persistence needed):

```ts
storeFactory: () => new MemoryStore()  // learnerId ignored
```

---

## 7. BrainConfig Changes

```ts
interface BrainConfig extends CascadableConfig {
  prompt: string
  model: LanguageModel
  // ... existing fields ...
  storeFactory?: (learnerId: string) => Store   // updated signature
  store?: BrainStore                             // new — Brain's own store
}
```

- `store` defaults to `new MemoryBrainStore()` if not provided
- `storeFactory` defaults to `() => new MemoryStore()` (learnerId ignored for memory)

---

## 8. Evolution History Persistence

### 8.1 Current State

The evaluator keeps an in-memory `history: EvolutionHistoryEntry[]` (capped array of past decisions). Lost on restart.

### 8.2 Change

After each evaluation, persist to `store.evolution`:

```ts
await this.store.evolution.add({
  id: `eval_${nanoid()}`,
  decisions: serializeDecisions(decisions),
  source: 'auto' | 'manual',
  created_at: new Date().toISOString(),
})
```

On restore, evaluator loads history from `store.evolution` to maintain continuity.

---

## 9. What Brain Does NOT Persist

- **Live model instances** — reconstructed from constructor config on restore (same as learners)
- **Event listeners** — consumer re-attaches after restore
- **Evaluator/EvolutionOrchestrator instances** — recreated during init based on config
- **In-flight state** — active inject/ask operations are not resumable
