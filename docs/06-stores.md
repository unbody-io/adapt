# Stores

Brain has two independent storage layers:

| Layer | Interface | Purpose |
|---|---|---|
| **Brain Store** | `BrainStore` | Brain state, neuron registry, evolution history, dismissed batches |
| **Neuron Store** | `NeuronStore` | Per-neuron observations, understanding, evolution, state |

## Memory Stores (default)

```typescript
import { Brain, MemoryBrainStore, MemoryNeuronStore } from '@unbody/adapt'

const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new MemoryBrainStore(),
  learning: {
    store: () => new MemoryNeuronStore(),
  },
})
```

Ephemeral — data lost on process exit. Good for development and testing.

## SQLite Stores

```typescript
import { Brain } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'

const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: {
    store: (neuronId) => new SQLiteNeuronStore(`./neuron-${neuronId}.db`),
  },
})
```

Persistent via `better-sqlite3`. Restarting and calling `initialize()` with the same paths restores all state — neurons, understanding, evolution history. No LLM calls on restore.

**Install:**

```bash
npm install better-sqlite3
```

### Hierarchical Persistence

For apps with multiple entities, use the neuron store factory to organize files per entity:

```typescript
const brain = new Brain({
  prompt: '...',
  model,
  store: new SQLiteBrainStore(`./${entityId}/brain.db`),
  learning: {
    store: (neuronId) => new SQLiteNeuronStore(`./${entityId}/neuron-${neuronId}.db`),
  },
})
```

This lets you cleanly delete all data for a single entity by removing its directory.

## Persistence Across Sessions

```typescript
// Session 1: create and learn
const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: { store: (id) => new SQLiteNeuronStore(`./neuron-${id}.db`) },
})
await brain.initialize()
await brain.inject(data)

// Session 2: restore and continue
const brain2 = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: { store: (id) => new SQLiteNeuronStore(`./neuron-${id}.db`) },
})
await brain2.initialize() // Restores from SQLite — no LLM calls
await brain2.ask('What do you know?') // Has full knowledge from session 1
```

## Custom Stores

Implement the `NeuronStore` interface (4 namespaces) and `BrainStore` interface (5 namespaces) to use any backend.

**NeuronStore:**

```typescript
interface NeuronStore {
  observations: NeuronCollection<ObservationRecord>
  understanding: NeuronCollection<UnderstandingRecord>
  evolution: NeuronCollection<EvolutionRecord>
  state: NeuronCollection<StateRecord>
  dispose(): Promise<void>
}
```

**BrainStore:**

```typescript
interface BrainStore {
  state: BrainCollection<BrainStateRecord>
  neurons: BrainCollection<BrainNeuronRecord>
  internalNeurons: BrainCollection<BrainNeuronRecord>
  evolution: BrainCollection<BrainEvolutionRecord>
  dismissedBatches: BrainCollection<DismissedBatchRecord>
  dispose(): Promise<void>
}
```

Both `NeuronCollection` and `BrainCollection` implement the same CRUD interface:

```typescript
interface NeuronCollection<T extends { id: string }> {
  add(item: T): Promise<void>
  get(id: string): Promise<T | undefined>
  list(filter?: Record<string, unknown>): Promise<T[]>
  update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void>
  delete(id: string): Promise<void>
  clear(): Promise<void>
  count(filter?: Record<string, unknown>): Promise<number>
  search(query: string): Promise<T[]>
  addBatch(items: T[]): Promise<void>
}
```
