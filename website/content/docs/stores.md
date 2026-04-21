---
title: Stores
description: Memory and SQLite storage layers, persistence across sessions, and custom stores.
---

Brain has two independent storage layers:

| Layer | Interface | Purpose |
|---|---|---|
| **Brain Store** | `BrainStore` | Brain state, neuron registry, evolution history, dismissed batches |
| **Neuron Store** | `NeuronStore` | Per-neuron observations, understanding, evolution, state |

## Memory Stores (default)

```typescript
import { Brain, MemoryBrainStore, MemoryNeuronStore } from '@unbody-io/adapt'

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

Adapt ships runtime-specific SQLite adapters. Core Adapt remains runtime-agnostic; only the adapter import changes.

| Adapter | Runtime | Driver |
|---|---|---|
| `@unbody-io/adapt/sqlite` | Node.js | `better-sqlite3` |
| `@unbody-io/adapt/sqlite/bun` | Bun | `bun:sqlite` |

### Node.js

**Install:**

```bash
npm install better-sqlite3
```

```typescript
import { Brain } from '@unbody-io/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody-io/adapt/sqlite'

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

### Bun

```typescript
import { Brain } from '@unbody-io/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody-io/adapt/sqlite/bun'

const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: {
    store: (neuronId) => new SQLiteNeuronStore(`./neuron-${neuronId}.db`),
  },
})
```

Persistent via Bun's built-in `bun:sqlite`. The restore behavior is the same as Node: restarting and calling `initialize()` with the same paths restores all state with no LLM calls.

The same guarantee applies to standalone neurons: constructing a `TextNeuron` or `ListNeuron` over a `SQLiteNeuronStore` whose DB already holds prior state (observations, buffer, understanding, evolution, prompts, schemas) restores everything via DB reads alone. Construction itself does no I/O; the restore runs when `init()` is called — either explicitly, or auto-called on the first `learn()`/`query()`. See [Neuron API → Lifecycle](./reference/neuron-api#lifecycle) for the cold-start vs. restore modes.

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

If you need a backend other than in-memory or SQLite (e.g., PostgreSQL, Redis, a cloud database), you can implement your own stores. Both interfaces follow a simple collection-based pattern — each namespace is a CRUD collection for a specific type of record.

**NeuronStore** — one per neuron, holds that neuron's observations, understanding, evolution history, and state:

```typescript
interface NeuronStore {
  observations: NeuronCollection<ObservationRecord>
  understanding: NeuronCollection<UnderstandingRecord>
  evolution: NeuronCollection<EvolutionRecord>
  state: NeuronCollection<StateRecord>
  dispose(): Promise<void>
}
```

### Observation lifecycle

Observations are persistent, not ephemeral buffered input. Each `ObservationRecord` carries a `metadata_status` field that moves through two states:

- **`pending`** — written during the observe phase of `learn()`. These are the only rows `getBufferedObservations()` and `getBufferState()` return, and they're what synthesis will consume on the next understand pass.
- **`processed`** — set after synthesis completes. The record stays in the collection; it's *not* deleted. With `SQLiteNeuronStore`, both pending and processed observations survive process restarts.

This means the full history of what a neuron has seen remains queryable via `neuron.store.observations.list(...)`. If you need only processed history, filter by `{ metadata_status: 'processed' }`. The neuron class itself only exposes the pending buffer today — for anything else, go through the store collection directly.

**BrainStore** — one per brain, holds the brain's state, neuron registry, internal neuron registry, evolution history, and dismissed batches:

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

Both `NeuronCollection` and `BrainCollection` implement the same CRUD interface. Each method does what you'd expect — the important one to note is `search()`, which should support full-text search (used by ListNeuron's deduplication during synthesis):

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

### Complete custom neuron store example

```typescript
class MapNeuronCollection<T extends { id: string }> implements NeuronCollection<T> {
  private items = new Map<string, T>()

  async add(item: T): Promise<void> {
    if (this.items.has(item.id)) throw new Error(`Record with id "${item.id}" already exists`)
    this.items.set(item.id, item)
  }

  async get(id: string): Promise<T | undefined> {
    return this.items.get(id)
  }

  async list(filter?: Record<string, unknown>): Promise<T[]> {
    const values = [...this.items.values()]
    if (!filter) return values
    return values.filter((item) =>
      Object.entries(filter).every(([key, value]) => (item as Record<string, unknown>)[key] === value)
    )
  }

  async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void> {
    const existing = this.items.get(id)
    if (!existing) throw new Error(`Record with id "${id}" not found`)
    this.items.set(id, { ...existing, ...changes })
  }

  async delete(id: string): Promise<void> {
    if (!this.items.delete(id)) throw new Error(`Record with id "${id}" not found`)
  }

  async clear(): Promise<void> {
    this.items.clear()
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    return (await this.list(filter)).length
  }

  async search(query: string): Promise<T[]> {
    const normalized = query.toLowerCase()
    return (await this.list()).filter((item) =>
      JSON.stringify(item).toLowerCase().includes(normalized)
    )
  }

  async addBatch(items: T[]): Promise<void> {
    for (const item of items) await this.add(item)
  }
}

class MapNeuronStore implements NeuronStore {
  observations = new MapNeuronCollection<ObservationRecord>()
  understanding = new MapNeuronCollection<UnderstandingRecord>()
  evolution = new MapNeuronCollection<EvolutionRecord>()
  state = new MapNeuronCollection<StateRecord>()

  async dispose(): Promise<void> {
    // no-op
  }
}
```
