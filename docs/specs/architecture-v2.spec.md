# Architecture v2: First-Principles Redesign

A specification for restructuring the Brain learner architecture based on first-principles thinking about what each component truly is, owns, and does.

---

## Background

After the recent refactor (extracting BaseLearner, BaseLearningMethod), we identified a fundamental tension: the system claims pluggable learning methods, but bakes specific method assumptions (observe/synthesize phases, their configs, their governance) into shared base types like `BaseResolvedConfig`. This spec proposes a cleaner architecture by rethinking every boundary from first principles.

---

## 1. Core Vocabulary

| Term | Definition |
|------|-----------|
| **Learner** | An agentic module that learns about something and can answer based on what it learned. The main orchestrator — all logic and wiring lives here |
| **Understanding** | The learner's stored knowledge — what it has learned |
| **Understanding shape** | The data structure of understanding — defines the learner type (string, list items, graph nodes/edges) |
| **Observer** | Extracts relevant signals from raw incoming data. Objective — blind to existing understanding. Always text in, text out. One implementation shared across all types |
| **Store** | The learner's persistence layer. A dumb CRUD adapter — stores what it's told, retrieves what's asked. No logic, no governance, no rules. Pluggable by backend (in-memory, SQLite). Fully type-owned schema |
| **Understand** | The learner's operation for shaping understanding from observations. Per-type, built-in |
| **Query** | The learner's operation for answering questions from understanding. Per-type, built-in |
| **Learning** | The full cycle: observe → understand. This is what a learner does |

### What changed from current naming

| Old | New | Why |
|-----|-----|-----|
| Learning method | Built-in observe → understand flow | Not pluggable; this is the DNA of the system |
| Synthesize | `understand` operation | "Synthesize" assumed LLM involvement; some types may write mechanically |
| Query method | `query` operation | Not pluggable currently |
| Governance | Learner concern (not store) | Logic about when/how to enforce rules belongs in the learner, not the store |
| Understanding store | Store | The store holds more than understanding — also observations, evolution, state. And it's purely dumb CRUD |

---

## 2. Architecture

```
Learner (orchestrator: all logic, governance, health, metrics, signals, lifecycle)
  ├── Observer (extracts relevant text signals from raw data)
  ├── Store (pluggable: in-memory, SQLite — pure CRUD, no logic)
  │     ├── understanding (type-specific: text, items, nodes/edges)
  │     ├── observations (buffer from observer)
  │     ├── evolution (change history)
  │     └── state (identity, config, prompts)
  ├── understand() — per-type: shapes understanding from observations using store API
  └── query() — per-type: answers questions from understanding using store API
```

### Key principles

1. **A learner writes to its understanding and reads from its understanding** — how these writes/reads happen should be independent and adjustable
2. **What ties write and read together is the understanding shape** — that's what defines the learner type
3. **The store is a dumb CRUD adapter** — it exposes raw utilities (save, get, delete). Zero logic, zero governance. The learner decides what to write and when
4. **The learner owns all logic** — governance, thresholds, orchestration, wiring. The learner is the application layer; the store is the database driver
5. **The observer stays blind** — it doesn't know about existing understanding, it only looks at incoming data objectively. Always string in, string out
6. **Understand and query use the store's API** — they can wrap store methods as LLM tools (agentic), or call them directly (mechanical)

---

## 3. The Learning Flow

The learner exposes `learn(data)` as its public API. Internally, it orchestrates observe and understand:

```
learner.learn(data):
    │
    ▼
  observe(data): "Is this relevant? What do I extract?"
    │
    ▼
  Save observation to store (text + importance)
    │
    ▼
  Check threshold (count, token size, importance, etc.)
    │
    ▼ (threshold met)
  Read buffered observations from store
    │
    ▼
  understand(observations): shape understanding using store API
    │
    ▼
  Clear observation buffer in store
```

The full cycle — observe then understand — is what we call **learning**. The learner orchestrates the entire flow: when to save, when to trigger understand, when to clear the buffer.

### Observation buffer

Observations are stored in the store (not just counted) because `understand()` needs the actual observation content to integrate into understanding. The store persists the buffer so it survives restarts (relevant for SQLite). The threshold logic (when to trigger understand) lives in the learner, not the store.

### Why observe + understand is the DNA

The fundamental loop of any learning system is:

```
Data comes in → Extract what's relevant → Store it as knowledge
```

This isn't a design choice — it's what "learning" means. What varies is:

- **How** you observe (LLM extraction, embeddings, rules)
- **How** you understand (LLM synthesis, mechanical append, agentic tool use)
- **How** you query (LLM with tools, direct lookup, RAG)

But the flow itself — observe, then shape understanding — is universal. This is why we bake it in rather than making it pluggable.

---

## 4. The Store

### Store as dumb CRUD adapter

The store is a persistence layer. It saves what it's told, retrieves what's asked, deletes what's requested. It has **zero logic** — no governance, no validation, no thresholds, no rules. It's a database driver, not an application.

The store doesn't know about observers, understand, query, or governance. It just provides raw utilities for data access.

### Pluggable by persistence backend

Two implementations for now:

- **In-memory** — default, zero config
- **SQLite** — persistent, production use

### Fully type-owned schema

Each learner type defines its **complete** schema. No shared/common tables enforced architecturally.

- Text store: defines its own tables for understanding, observations, evolution, state
- List store: defines its own tables for items, observations, evolution, state
- Graph store: defines its own tables for nodes, edges, observations, evolution, state

If the observations table happens to look identical across types — that's fine, but it's by choice, not by inheritance. Each type is fully self-contained.

### Store API per type

Each store type exposes its own raw CRUD methods. Examples:

**Text store API:**

- `getUnderstanding()` — get full text
- `setUnderstanding(text)` — replace text
- `getObservations()` — get buffered observations
- `addObservation(obs)` — save an observation
- `clearObservations()` — delete all observations
- `getEvolution()` — get change history
- `addEvolution(entry)` — save a change entry
- `getState(key)` / `setState(key, value)` — read/write state

**List store API:**

- `getItems()` — get all items
- `getItemById(id)` — get specific item
- `addItem(item)` — save new item
- `updateItem(id, changes)` — update item
- `removeItem(id)` — delete item
- `searchItems(query)` — search items
- Plus observations, evolution, state methods (same shape, own tables)

**Graph store API:**

- `addNode()`, `getNode()`, `searchNodes()`, `updateNode()`
- `addEdge()`, `getEdges()`, `removeEdge()`
- `traverse(startId, depth)`
- Plus observations, evolution, state methods

All of these are raw data operations. No business logic.

---

## 5. The Observer

- One implementation, shared across all learner types
- **Always string in, string out** — extracts literal text from raw data, regardless of learner type
- **Objective**: does not read from the store, does not know about existing understanding
- Uses an LLM-generated "identity" to evaluate relevance
- Outputs text observations with importance scores

The observer is type-agnostic. It always produces text observations. The learner's `understand` operation then interprets these text observations according to its type — a text learner weaves them into prose, a list learner extracts items from them, a graph learner extracts entities and relationships.

---

## 6. Understand (per type)

The learner's operation for shaping understanding from observations. Built-in per learner type. Uses the store's CRUD API.

| Learner type | How understand works |
|-------------|----------------------|
| Text | LLM reads current understanding + observations, produces new prose (fits in context) |
| List | LLM uses store methods as tools to add/update/remove items (agentic) |
| Graph | LLM uses store methods as tools to manage nodes/edges (agentic) |

Whether understand uses direct LLM synthesis or agentic tool use depends on whether understanding fits in LLM context:

- Text: small, fits in context → direct
- List: potentially large → agentic (tools)
- Graph: large → agentic (tools)

---

## 7. Query (per type)

The learner's operation for answering questions from understanding. Built-in per learner type. Uses the store's CRUD API.

The same store methods used by understand can also be used by query. For example, a list store's `searchItems()` is useful for both shaping understanding (checking for duplicates) and answering questions (finding relevant items).

---

## 8. The Learner

The learner is the **main orchestrator**. All logic lives here — governance, thresholds, orchestration, wiring. The learner is the application layer; the store is just the database driver.

### Responsibilities

- **Orchestrates the learning flow**: observe → buffer → threshold check → understand
- **Owns all governance logic**: maxItems, maxTokens, dedup, strategy, pruning — the learner enforces these rules using the store's CRUD, not the store itself
- **Orchestrates queries**: receives a question, uses store API to read and reason
- **Tracks health and metrics**: activation, dismissal rate, confidence, signals
- **Manages lifecycle**: init, learn, query, update, destroy

### Generic by understanding type

```typescript
class Learner<TUnderstanding> {
  observer: Observer
  store: Store<TUnderstanding>
  // understand and query are per-type, built-in
  // health, metrics, signals — shared infrastructure
  // governance — enforced here, not in the store
}
```

How per-type `understand` and `query` behavior is dispatched (subclasses, injected functions, type-keyed modules) is an implementation detail.

### Shared infrastructure (all learners)

- Health tracking: activation, threshold, status (active/monitoring/dormant)
- Metrics: observation count, dismissal rate, query confidence
- Evolution: change history, significance levels
- Signals: emission when thresholds crossed
- Lifecycle: init, learn, query, update, destroy

---

## 9. Config Restructuring

### Current problem

`BaseResolvedConfig` contains `observe` and `synthesize` fields — these are learning-method concerns baked into every learner's config.

### New config structure

Config should reflect the actual component boundaries:

```typescript
{
  id: string
  type: 'text' | 'list' | 'graph'
  instructions: string
  model: LanguageModel              // general fallback

  // Observer config
  observer: {
    model?: LanguageModel
  }

  // Store config — persistence only, no governance
  store: {
    persistence: 'memory' | 'sqlite'
  }

  // Governance — owned by learner, not by store
  governance: { ... }               // type-specific (strategy, maxTokens, dedup, etc.)

  // Understand/query operational config
  // (thresholds, models, etc. — exact shape TBD during implementation)
}
```

No more `observe.blueprintModel`, `synthesize.thresholds`, or governance fields mixed into the base config. Each concern gets its own section, and governance explicitly belongs to the learner.

---

## 10. What's NOT Changing

- **Brain orchestrator**: Still decomposes prompts into learners, routes data, manages evolution
- **Signal system**: Still detects struggling learners and triggers adaptation
- **Health/metrics infrastructure**: Still shared across all learner types
- **The learning pattern**: observe → understand is the DNA, stays as the built-in approach
- **Model cascading**: Models still cascade from specific → general (just from the right config locations)

---

## 11. What IS Changing

| Area | Before | After |
|------|--------|-------|
| Learning method | Pluggable abstraction (BaseLearningMethod) | Built-in per-type `understand` operation |
| Query method | Separate pluggable concept | Built-in per-type `query` operation |
| Synthesize | Owned by learning method | Part of `understand`, uses store CRUD |
| Governance | Applied by learning method in postProcess | Enforced by the learner itself (not the store) |
| Config | observe/synthesize baked into BaseResolvedConfig | Component-owned config (observer, store, governance) |
| Store | Implicit (in-memory arrays/strings) | Explicit pluggable CRUD adapter (in-memory, SQLite), zero logic |
| Store schema | Common tables + type-specific tables | Fully type-owned schema, no enforced common tables |
| TextLearner/ListLearner | Separate classes extending BaseLearner | Generic Learner\<T\> with type-specific components |
| Naming | Learning method, synthesize, observation strategy | Observer, Store, understand, query |

---

## 12. Pluggability Summary

| Component | Pluggable? | Why / Why not |
|-----------|-----------|---------------|
| Store (persistence) | Yes | Real near-term need (in-memory → SQLite) |
| Store (by type) | Yes (by nature) | Each understanding type = different store implementation |
| Observer | No | One shared implementation; always string in, string out |
| Understand | No | Built-in per type; no current need for alternatives |
| Query | No | Built-in per type; no current need for alternatives |

**Principle**: Only introduce plugin boundaries where there's a real, current need. The store persistence is the only one that qualifies today.

---

## 13. Implementation Notes

### Store implementation matrix

|  | In-Memory | SQLite |
|---|---|---|
| **Text** | TextInMemoryStore | TextSQLiteStore |
| **List** | ListInMemoryStore | ListSQLiteStore |
| **Graph** | GraphInMemoryStore | GraphSQLiteStore |

### Per-learner database files (SQLite)

Each learner gets its own database file (from memory.spec.md):

```
brain/
├── brain.db                    ← Brain state, learner registry
└── learners/
    ├── coding-philosophy.db    ← Text learner
    ├── pages-visited.db        ← List learner
    └── user-contacts.db        ← Graph learner
```

### Adding a new learner type

1. Define the understanding shape (e.g., `GraphNode[]`)
2. Create the store implementations (GraphInMemoryStore, GraphSQLiteStore)
3. Implement learn logic for the type (how observations become graph updates)
4. Implement query logic for the type (how questions are answered from graph)
5. Add to Brain's factory
6. No base classes need to change

---

## 14. Migration Path from Current Architecture

This is a structural refactor, not a rewrite. The actual learning behavior stays the same — we're reorganizing where code lives and what owns what.

### High-level steps

1. **Extract store per type** — move understanding storage, observation buffering, evolution tracking into dumb CRUD store classes (in-memory first)
2. **Move governance logic into learner** — learner enforces all rules (maxItems, dedup, strategy, pruning) using store CRUD
3. **Restructure config** — remove observe/synthesize from BaseResolvedConfig, create component-owned configs
4. **Collapse learner classes** — TextLearner/ListLearner become Learner\<T\> with type-specific understand/query
5. **Reorganize directory structure** — align with new component boundaries

### What to preserve

- All current LLM prompts and identities (they work well)
- Health/metrics/signal infrastructure
- The observe → understand flow (same behavior, different ownership)
- Model cascading concept (just from corrected config locations)
