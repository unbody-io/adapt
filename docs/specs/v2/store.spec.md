# Store Layer Specification

> **Effort A**: Types, Collection interface, in-memory adapter, SQLite adapter, and tests.
> Self-contained — no external spec dependencies.

---

## Record Types

### ObservationRecord

```typescript
interface ObservationRecord {
  id: string
  data: unknown                         // validated against observation_schema
  metadata_importance: number
  metadata_tokens: number
  metadata_status: 'pending' | 'processed'
  metadata_created_at: string           // ISO 8601
}
```

Observations are **never deleted** — they're the permanent raw record. After understand, they're marked `metadata_status: 'processed'`, not cleared.

### UnderstandingRecord

Universal across all learner types — only `data` shape varies (text = string, list = object per item). LLM-specific fields (e.g. list item `signals`) live inside `data`, not as metadata.

```typescript
interface UnderstandingRecord {
  id: string
  data: unknown                         // validated against understanding_schema
  metadata_confidence: number           // 0-1
  metadata_created_at: string           // ISO 8601
  metadata_updated_at: string           // ISO 8601
}
```

### EvolutionRecord

Fully flat — no `data` wrapper, no `metadata_***` prefix. Fixed known shape. No snapshots of understanding — evolution is a lightweight changelog.

```typescript
interface EvolutionRecord {
  id: string
  summary: string
  reasoning?: string
  significance: Significance            // 'routine' | 'notable' | 'critical'
  createdAt: string                     // ISO 8601
}
```

### StateRecord

Key-value store for both config and runtime state. The learner knows the semantics, the store doesn't.

```typescript
interface StateRecord {
  id: string                            // acts as key (e.g. "identity", "observe_prompt")
  value: unknown
  updatedAt: string                     // ISO 8601
}
```

### Metadata Naming Convention

- `metadata_***` prefix for all bookkeeping fields on observation and understanding records
- Makes metadata columns immediately recognizable, distinguishes them from `id` and `data`
- Standard across all learner types
- **Exempt**: EvolutionRecord and StateRecord — fixed self-documenting shapes

---

## Collection Interface

```typescript
interface Collection<T extends { id: string }> {
  add(item: T): Promise<void>
  get(id: string): Promise<T | undefined>
  list(filter?: Record<string, unknown>): Promise<T[]>
  update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void>
  delete(id: string): Promise<void>     // throws if not found
  clear(): Promise<void>
  count(filter?: Record<string, unknown>): Promise<number>
  search(query: string): Promise<T[]>
  addBatch(items: T[]): Promise<void>
}
```

**Design decisions:**

| Decision | Rationale |
|----------|-----------|
| All methods async (return Promises) | In-memory returns resolved promises. Zero impact today, clean adapter swap later. |
| `delete()` not `remove()` | Matches SQL DELETE and JS `Map.delete()` |
| `delete()` throws on not-found | Void return, Error if record doesn't exist |
| `list(filter?)` — key-value equality | `list({ metadata_status: 'pending' })`. In-memory: `Object.entries(filter).every(...)`. SQLite: `WHERE key = value`. No complex query DSL — YAGNI. |
| `count(filter?)` — same filter as `list()` | SQLite: `SELECT COUNT(*) WHERE ...` — avoids loading all records |
| `addBatch()` | SQLite wraps in transaction. In-memory loops `add()`. |
| Keep `search()` | Useful for queries, uses recursive string extraction |

---

## Store Interface

```typescript
interface Store {
  observations: Collection<ObservationRecord>
  understanding: Collection<UnderstandingRecord>
  evolution: Collection<EvolutionRecord>
  state: Collection<StateRecord>
  dispose(): Promise<void>
}
```

**No type parameter.** UnderstandingRecord is universal — Store is uniform across all learner types. `TextStore`, `ListStore`, `TextUnderstandingRecord`, `ListItemRecord` are all eliminated.

**`dispose()` on Store**, not Collection. Collections don't own resources. Store owns the connection (SQLite) or data structure (in-memory).

**Injected into learner.** Caller decides the adapter:

```typescript
new MemoryStore()
new SQLiteStore({ dbPath: './data/learner-1.db' })
```

---

## In-Memory Adapter

**Files**: `src/learners/stores/types.ts`, `src/learners/stores/memory.ts`

### Migration from Current Implementation

| Current | Target |
|---------|--------|
| `ObservationRecord.content` | `ObservationRecord.data` |
| `ObservationRecord.importance` (flat) | `ObservationRecord.metadata_importance` |
| `ObservationRecord.createdAt` | `ObservationRecord.metadata_created_at` |
| (missing) | `ObservationRecord.metadata_tokens` |
| (missing) | `ObservationRecord.metadata_status` |
| `TextUnderstandingRecord` | `UnderstandingRecord` (universal) |
| `ListItemRecord` | `UnderstandingRecord` (universal) |
| `Collection.remove(): boolean` | `Collection.delete(): void` (throws) |
| Sync returns | Async returns (Promise) |
| `Store<TUnderstanding>` | `Store` (no type param) |
| (missing) | `dispose()`, `list(filter?)`, `count(filter?)`, `addBatch()` |

### Breaking Changes

1. `ObservationRecord` — completely restructured with `metadata_***` fields
2. `TextUnderstandingRecord` — replaced by universal `UnderstandingRecord`
3. `ListItemRecord` — replaced by universal `UnderstandingRecord`
4. `EvolutionRecord` — keeps flat shape but field changes (no `data` wrapper)
5. `Collection.remove()` → `Collection.delete()` (throws on not-found)
6. All methods now async
7. `Store<T>` → `Store` (no type param), `TextStore`/`ListStore` removed

Since this is in-memory with no persistent data: no data migration needed, breaking changes applied directly.

### MemoryCollection Updates

1. Rename `remove()` to `delete()`
2. `delete()` throws Error if item not found
3. Wrap all returns in `Promise.resolve()`
4. Add `list(filter?)`:
   ```typescript
   async list(filter?: Record<string, unknown>): Promise<T[]> {
     if (!filter) return [...this.items]
     return this.items.filter(item =>
       Object.entries(filter).every(([k, v]) => (item as any)[k] === v)
     )
   }
   ```
5. Add `count(filter?)` — same filter, returns length
6. Add `addBatch()` — loops `add()`
7. `search()` — already works with nested objects via `extractStrings()`
8. Add `dispose()` as no-op on `MemoryStore`

### MemoryStore

```typescript
class MemoryStore implements Store {
  observations = new MemoryCollection<ObservationRecord>()
  understanding = new MemoryCollection<UnderstandingRecord>()
  evolution = new MemoryCollection<EvolutionRecord>()
  state = new MemoryCollection<StateRecord>()

  async dispose(): Promise<void> { /* no-op */ }
}
```

**Validation**: TypeScript compilation passes

---

## SQLite Adapter

**New file**: `src/learners/stores/sqlite.ts`
**Dependency**: `better-sqlite3`

### Per-Learner Database Files

```
brain/
└── learners/
    ├── <learner-id-1>.db
    ├── <learner-id-2>.db
    └── <learner-id-3>.db
```

Why per-learner DBs: isolation (one can't corrupt another), portability (delete learner = delete file), no contention (no write conflicts), clean mental model (learner = self-contained unit).

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS state (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  metadata_importance REAL NOT NULL,
  metadata_tokens INTEGER NOT NULL,
  metadata_status TEXT NOT NULL DEFAULT 'pending',
  metadata_created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS understanding (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  metadata_confidence REAL NOT NULL,
  metadata_created_at TEXT NOT NULL,
  metadata_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evolution (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  reasoning TEXT,
  significance TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(metadata_created_at);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(metadata_status);
CREATE INDEX IF NOT EXISTS idx_understanding_updated ON understanding(metadata_updated_at);
CREATE INDEX IF NOT EXISTS idx_evolution_created ON evolution(created_at);
```

Note: `metadata_***` fields are real SQL columns (not JSON) — enables efficient `WHERE metadata_status = 'pending'` queries. Only `data` and `value` are JSON-serialized TEXT columns.

### SQLiteCollection

Implements `Collection<T>`. Key implementation patterns:

```typescript
class SQLiteCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private db: Database.Database,
    private tableName: string,
    private columnDefs: ColumnDef[],  // { name, json: boolean }
  ) {}

  async add(record: T): Promise<void> {
    // INSERT with JSON.stringify for json columns, raw for others
  }

  async get(id: string): Promise<T | undefined> {
    // SELECT + JSON.parse for json columns
  }

  async list(filter?: Record<string, unknown>): Promise<T[]> {
    // SELECT * WHERE key = value (for each filter entry) ORDER BY rowid ASC
    // JSON.parse for json columns
  }

  async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void> {
    // Read-merge-write: get existing, merge changes, UPDATE
  }

  async delete(id: string): Promise<void> {
    // DELETE WHERE id = ?, throw if changes === 0
  }

  async clear(): Promise<void> {
    // DELETE FROM table
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    // SELECT COUNT(*) with same WHERE logic as list()
  }

  async search(query: string): Promise<T[]> {
    // Load all + extractStrings filter (same as in-memory for now)
  }

  async addBatch(records: T[]): Promise<void> {
    // Transaction wrapper for bulk inserts
    const insertMany = this.db.transaction((records: T[]) => {
      for (const record of records) {
        // reuse add() insert logic
      }
    })
    insertMany(records)
  }
}
```

### SQLiteStateCollection

State has a simpler structure (no `data`/`metadata_***` split — just `id`/`value`/`updated_at`):

```typescript
class SQLiteStateCollection implements Collection<StateRecord> {
  async add(record: StateRecord): Promise<void> {
    // INSERT (id, JSON.stringify(value), updated_at)
  }

  async get(id: string): Promise<StateRecord | undefined> {
    // SELECT, JSON.parse(value)
  }

  async update(id: string, updates: Partial<StateRecord>): Promise<void> {
    // UPDATE value = JSON.stringify(updates.value), updated_at
  }

  // ... other methods follow same pattern
}
```

### SQLiteStore

```typescript
class SQLiteStore implements Store {
  private db: Database.Database

  observations: Collection<ObservationRecord>
  understanding: Collection<UnderstandingRecord>
  evolution: Collection<EvolutionRecord>
  state: Collection<StateRecord>

  constructor(config: { dbPath: string }) {
    this.db = new Database(config.dbPath)
    this.initSchema()

    this.state = new SQLiteStateCollection(this.db)
    this.observations = new SQLiteCollection(this.db, 'observations', observationColumns)
    this.understanding = new SQLiteCollection(this.db, 'understanding', understandingColumns)
    this.evolution = new SQLiteCollection(this.db, 'evolution', evolutionColumns)
  }

  private initSchema(): void {
    this.db.exec(/* SQL schema above */)
  }

  async dispose(): Promise<void> {
    this.db.close()
  }
}
```

### Connection Management

```typescript
// Open on construction
const store = new SQLiteStore({ dbPath: './data/learner-1.db' })

// Close via dispose
await store.dispose()

// For tests, use in-memory
const store = new SQLiteStore({ dbPath: ':memory:' })
```

**Validation**: Same test suite runs against both adapters (SQLite uses `:memory:`)

---

## Store Eval Script

**File**: `evals/scripts/store-01-standalone.ts`

Update all record creation and assertions to match new types:
- `content` → `data`
- `importance` → `metadata_importance`
- `.remove()` → `.delete()`
- Add tests for `delete()` throws on not-found
- Add tests for `list(filter)` and `count(filter)`
- Add tests for `addBatch()`
- Add tests for new `metadata_***` fields

**Validation**: `npx tsx evals/scripts/store-01-standalone.ts` passes

---

## Shared Test Suite

Both adapters must pass the same tests:

```typescript
describe('Store implementations', () => {
  const testCases = [
    { name: 'MemoryStore', factory: () => new MemoryStore() },
    { name: 'SQLiteStore', factory: () => new SQLiteStore({ dbPath: ':memory:' }) }
  ]

  for (const { name, factory } of testCases) {
    describe(name, () => {
      // All Collection methods (add, get, list, update, delete, clear, count, search, addBatch)
      // Filtering: list({ metadata_status: 'pending' }), count({ metadata_status: 'pending' })
      // Error cases: delete non-existent, add duplicate
      // Edge cases: empty lists, special characters, large data
      // Pipeline simulation: observe → buffer → understand → evolution
    })
  }
})
```

**Test coverage**: All Collection methods, error cases, edge cases, pipeline simulation.

---

## Implementation Steps

```
A1. Update record types in types.ts
A2. Update MemoryCollection + MemoryStore in memory.ts
A3. Update store eval script
A4. Implement SQLiteCollection + SQLiteStore in sqlite.ts
A5. Shared test suite (both adapters)
```

A4 (SQLite) can happen in parallel with Effort B if desired — it only depends on A1-A2 being done.

---

## State Collection Contents

The `state` table stores everything the learner needs to reconstruct itself:

```typescript
state.observation_schema    → JSONSchema object
state.understanding_schema  → JSONSchema object
state.observe_identity      → { identity: string, domain?: string }
state.understand_identity   → { identity: string }
state.observe_prompt        → string (system prompt)
state.understand_prompt     → string (system prompt)
```

---

## Why `better-sqlite3` (not Turso)

Browser support is a goal but not the first release focus. `better-sqlite3` is proven, synchronous, zero-config for Node.js. The architecture (async Collection interface, Store with `dispose()`) accommodates future browser-compatible adapters (Turso, sql.js) that slot into the same interface.
