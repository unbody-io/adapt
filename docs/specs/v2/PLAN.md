# Implementation Plan: Storage + Learner Integration

> Master plan — references focused specs for implementation details.

---

## Implementation Requirements

Rules for anyone (human or agent) implementing these specs:

1. **Write code only when needed.** Less code is better. Code is expensive — every line is a liability to maintain. Before adding, ask: "Can we solve this by removing something instead?"

2. **TypeScript is the first-class citizen.** Strong types, no `any` escape hatches, no shortcuts. Type safety is velocity.

3. **Follow existing patterns.** Match the codebase's file naming, code structure, and file organization conventions. Read what exists before writing anything new.

4. **Make things modular and reusable.** Every component must work in isolation and standalone — learners, storage, observer, etc. No hidden coupling. If you can't test it independently, it's not modular.

5. **Test at three levels for every phase/milestone:**
   - **Build test** — `npx tsc --noEmit` passes, zero compilation errors
   - **Programmatic test** — unit/integration tests that verify behavior automatically
   - **Real-world evals** — scripts that exercise the system as a developer would use it. Run the scripts, read the logs, verify the output makes semantic sense. This is the most important layer — it catches what automated tests miss. Eval scripts should do semantic analysis and validation of actual LLM outputs, not just check that functions return without errors.

6. **Don't over-engineer.** Solve the immediate problem with the simplest approach. Add complexity only when the current solution breaks down. No premature abstractions, no hypothetical future requirements.

---

## Design Principles

1. **"Understand actively curates"** — NOT a 1:1 copy from observations to understanding. It deduplicates, filters, merges, and updates.

2. **"Schema is for LLM guidance, NOT storage constraints"** — Schemas are extraction templates and validation contracts. Soft contracts, not hard database constraints.

3. **Why text understanding is a Collection** — Cumulative strategy does cycle resets. Collection lets the text learner keep previous cycle records. Uniform design.

4. **State doesn't distinguish config from runtime** — Both are key-value records in `store.state`. The learner knows the semantics, the store doesn't.

5. **Cardinality differs by learner type** — Text: one understanding record. List: multiple understanding records. Same universal `UnderstandingRecord` shape, different cardinality.

6. **Why JSON Schema format** — Standard, LLMs know it, Zod 4 native support, rich validation, serializable.

7. **"synthesize" → "understand"** — Semantically clearer. Event names and status strings stay as-is for backward compat.

---

## Current Reality

- **TextLearner** — working, understanding as `this.understanding: string`
- **ListLearner** — working, understanding as `this.items: ListItem[]`
- **BaseLearner** — evolution in `this.evolution: EvolutionEntry[]`, health/metrics as properties
- **BaseLearningMethod** — owns the observe → ObservationBuffer → synthesize pipeline
- **Store types + MemoryCollection** — implemented but **not used by any learner**

The store layer works in isolation but isn't wired to learners. The connection point is this refactor.

---

## Three Efforts

```
EFFORT A: Fix the Store Layer (standalone)
  → See store.spec.md
  → Get types, in-memory adapter, and SQLite adapter correct
  → Independent of learners — can be tested in isolation

EFFORT B: Wire Learners to Store (architecture refactor)
  → See learner-refactor.spec.md
  → Learners use Store instead of raw instance properties
  → BaseLearningMethod eliminated, pipeline absorbed into BaseLearner
  → ObservationBuffer replaced by store.observations
  → Synthesize renamed to understand, observer becomes shared module

EFFORT C: Schema Generation & Validation (follow-up, not blocking)
  → See schema.spec.md
  → LLM-generated JSON Schemas for observation/understanding
  → Two-layer validation (generation + storage write)
  → Can be layered onto Effort B incrementally
```

---

## Implementation Order

```
A1. Update record types        ─┐
A2. Update MemoryCollection    ─┤ Effort A: Store Layer
A3. Update store eval script   ─┤ (standalone, no learner changes)
A4. SQLite adapter             ─┤
A5. Shared test suite          ─┘
         │
         ▼
B1. Shared observer module     ─┐
B2. Move synthesize→understand ─┤
B3. Rewrite BaseLearner        ─┤ Effort B: Learner Integration
B4. Rewrite subclasses         ─┤ (architecture refactor)
B5. Update config types        ─┤
B6. Update exports + Brain     ─┤
B7. Delete old files + evals   ─┘
         │
         ▼
C1. Schema generation          ─┐
C2. Two-layer validation       ─┤ Effort C: Schema (follow-up)
C3. Schema evolution (deferred)─┘
```

A4 (SQLite) can happen in parallel with Effort B — it only depends on A1-A2 being done.

---

## Rollback Plans

**If A1-A2 issues** (type migration):
- Revert changes to `types.ts` and `memory.ts`
- Risk: Low (mechanical changes)

**If B3-B4 issues** (learner refactor):
- Revert learner code changes
- Keep Effort A changes (store layer works standalone)
- Gradually migrate learners one at a time
- Risk: Medium (runtime behavior changes, but in-memory = no data loss)

**If A4 issues** (SQLite):
- Keep using in-memory (already aligned)
- SQLite is additive, doesn't break existing code
- Risk: Low

---

## Decision Log

**Why Generic Collection\<T\>?**
- Uniform interface maps to SQL tables, enables shared tooling, adapter swapping, one mental model

**Why `data` + flat `metadata_***` fields?**
- `data` holds schema-validated LLM output (shape varies per learner)
- `metadata_***` prefix for bookkeeping fields — flat on record, immediately recognizable
- Standard across all learner types. LLM-specific concepts (e.g. list item `signals`) live inside `data`
- Exception: EvolutionRecord and StateRecord are fully flat (fixed shapes)

**Why async from the start?**
- In-memory returns resolved promises. Zero impact today, clean adapter swap later.

**Why persistent observations with status field?**
- Observations are the permanent raw record. `metadata_status: 'pending' | 'processed'`.
- Buffer metrics computed from pending subset via `list({ metadata_status: 'pending' })`.

**Why store is single source of truth?**
- One source of truth, period. I/O is negligible vs LLM calls. Caching is easy to add later if needed.

**Why store is injected?**
- Learner has no knowledge of store types. Caller decides adapter. Clean DI, trivial to test.

**Why `better-sqlite3` (not Turso)?**
- Browser support deferred. Architecture supports pluggable adapters for later.

**Why universal UnderstandingRecord?**
- Same `metadata_***` columns for all learner types. Only `data` varies. No `Store<T>` parameterization needed.

**Why `delete()` not `remove()`?**
- Matches SQL DELETE and JS `Map.delete()`.

**Why simple equality filter?**
- `list(filter?)` covers all current use cases. No complex query DSL — YAGNI.

**Why `count(filter?)`?**
- Same filter as `list()`. SQLite: `SELECT COUNT(*) WHERE ...` — avoids loading all records.

**Why no snapshots in evolution?**
- Lightweight changelog. Keeps records small. Avoids unbounded growth.

**Why `EvolutionEntry` → `EvolutionRecord`?**
- Replaced by store layer type. Same flat shape.

**Why shared observer?**
- Text observer prompts already generic. Observe is type-agnostic. Eliminates duplication.

**Why absorb pipeline into BaseLearner?**
- BaseLearningMethod is not truly pluggable. Simpler ownership. Store access cleaner from learner.

---

## Success Metrics

### Effort A:
- 0 TypeScript compilation errors
- 100% store test pass rate
- Both memory and SQLite adapters pass same test suite
- DB files created in correct location (SQLite)
- No leaked DB connections (SQLite)

### Effort B:
- 0 TypeScript compilation errors
- TextLearner works end-to-end (init → learn → query)
- ListLearner works end-to-end (init → learn → query)
- Text strategies still apply (continuous/cumulative/decay)
- List governance still applies (dedup/pruning/maxItems)
- Brain integration works (create learners, route data)
- All events fire correctly
- All existing eval scripts pass (after updates)

### Effort C:
- Schemas generated during init
- Schemas stored in state collection
- Structured output uses schema for validation
- Invalid records caught at generation and storage layers

---

## Deferred Items

- **Graph & Vector Learner Storage** — future learner types may need specialized storage. Current `Collection<T>` may not fit. Will address when designed.
- **Brain-Level Storage (Brain.db)** — only learner-level persistence for now.
- **Schema Evolution & Migration** — no action needed now. Soft contracts, no migration required.
