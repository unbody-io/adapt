# Audit Feedback — Round 7 (SQLite Adapter)

## Context

Round 6 closed the understand-phase issues (dedup fix). The implementor then shipped A4 (SQLite adapter) along with the type rename recommended in the plan review (`createdAt`→`created_at`, `updatedAt`→`updated_at`).

---

## What's Working

- **300/300 tests pass** — same suite, both adapters (MemoryStore + SQLiteStore `:memory:`). Clean.
- **Type rename applied correctly** — `EvolutionRecord.created_at`, `StateRecord.updated_at`. All callers updated (base/class.ts, list-learner/class.ts, text-learner/class.ts, both eval scripts). Zero stale references.
- **Single generic `SQLiteCollection`** — spec called for a separate `SQLiteStateCollection`, but the implementor correctly realized the rename eliminates the need. Column names match TS properties everywhere. Simpler.
- **`ColumnDef` approach** — `{ name, json: boolean }` drives serialize/deserialize. Clean, minimal abstraction.
- **WAL mode** — Enabled for concurrent reads. Correct.
- **`addBatch` uses transaction** — Prepared statement reused inside `db.transaction()`. Good pattern.
- **`extractStrings` shared** — Exported from memory.ts, reused by SQLite's `search()`. No duplication.
- **Error messages consistent** — Both adapters throw `Record with id "X" not found` for update and delete.
- **`parseRow` handles NULL → undefined** — `raw ?? undefined` correctly converts SQL NULLs back for optional fields like `reasoning`.
- **Test suite properly refactored** — `CreateStore` factory pattern, `dispose()` called after each test, `runSuite()` runs both adapters. Well structured.

---

## Issues

### 1. Missing NOT NULL constraints (Low)

**Observed**: SQL schema has no NOT NULL constraints on any column except the implicit PRIMARY KEY.

**Spec says**:
```sql
data TEXT NOT NULL,
metadata_importance REAL NOT NULL,
metadata_status TEXT NOT NULL DEFAULT 'pending',
-- etc.
```

**Implementation has**:
```sql
data TEXT,
metadata_importance REAL,
metadata_status TEXT,
```

Not a runtime bug — TypeScript types prevent null values in practice. But the database schema is weaker than specified. NOT NULL constraints are a defense-in-depth layer that catches bugs at the storage boundary.

**Fix**: Add NOT NULL to all columns that are required in the TS types. `reasoning` in evolution should stay nullable (it's `reasoning?: string`).

### 2. Missing indexes (Low)

**Spec defines 4 indexes**, implementation has 1.

| Index | Spec | Implemented |
|-------|------|-------------|
| `idx_observations_status` | Yes | Yes |
| `idx_observations_created` | Yes | No |
| `idx_understanding_updated` | Yes | No |
| `idx_evolution_created` | Yes | No |

Only `idx_observations_status` is used today (for `list({ metadata_status: 'pending' })`). The others are forward-looking and not blocking. But they're cheap to add.

**Fix**: Add the 3 missing indexes from the spec.

### 3. Duplicate ID contract undefined (Low)

MemoryCollection.add() silently allows duplicate IDs (pushes to array). SQLiteCollection.add() throws UNIQUE constraint violation. The two adapters behave differently on this edge case.

In practice IDs are nanoid-generated, so this never surfaces. But the `Collection` interface doesn't specify the contract.

**Fix**: Either add a JSDoc note on `Collection.add()` that duplicate IDs are undefined behavior, or make MemoryCollection throw on duplicate IDs to match SQLite. The latter is simpler and makes the adapters truly interchangeable.

---

## Summary

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Missing NOT NULL constraints | **Low** | Add NOT NULL to required columns |
| 2 | Missing 3 of 4 indexes | **Low** | Add from spec |
| 3 | Duplicate ID contract undefined | **Low** | Throw on duplicate in MemoryCollection or document as UB |

This is a clean implementation. All issues are low severity. The core design (generic SQLiteCollection, ColumnDef, shared test suite) is solid.
