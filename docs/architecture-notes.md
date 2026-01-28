# Unbody Brain — Architecture Notes

Cross-cutting learnings and decisions that affect multiple components. These notes inform the Brain, Perception, and Query Flow specs.

---

## Perceivers vs Learners

The core distinction is **statefulness**.

**Terminology:**
- **Perceiver** (Perception Agent) — stateless, processes incoming data
- **Learner** (Learning Agent) — stateful, builds understanding over time

| | Perceiver | Learner |
|---|---|---|
| State | Stateless | Stateful |
| Operation | Extract from THIS data point | Compare data against EXISTING understanding, update |
| Memory | None — processes in isolation | Persists and evolves over time |
| Output | Enriched data → storage | Updated understanding |

### The Test

Ask: **"Can this be answered/extracted from one data point, or does it require having paid attention over time?"**

- One data point → Perceiver
- Paid attention over time → Learner

### Examples

| Task | Who does it | Why |
|------|-------------|-----|
| Extract victim name from tweet | Perceiver | Single data point extraction |
| Understand patterns in who gets killed | Learner | Requires observing many incidents |
| Extract therapist's stated specializations | Perceiver | Single data point extraction |
| Understand therapist's philosophy | Learner | Requires synthesizing blog, videos, interviews |
| Classify tweet sentiment | Perceiver | Single data point |
| Track how sentiment evolves over days | Learner | Requires temporal observation |

---

## Three Layers, Three Concerns

```
Data arrives
    ↓
┌─────────────────────────────────────────────────────────┐
│ PERCEIVERS (Perception Agents)                          │
│ - Stateless extraction/enrichment                       │
│ - Extract entities, classify, parse, crawl URLs         │
│ - Output: enriched data                                 │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ STORAGE                                                 │
│ - Holds enriched data for recall                        │
│ - Vector (semantic search), Graph (relations), SQL      │
│ - BYODB — developer brings their own                    │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ LEARNERS (Learning Agents)                              │
│ - Stateful understanding                                │
│ - Compare incoming data against existing state          │
│ - Build patterns, track evolution, synthesize           │
└─────────────────────────────────────────────────────────┘
```

### Query Routing

| Query Type | Handler |
|------------|---------|
| Recall specific data | Storage |
| Filter/search structured data | Storage (or perceived fields) |
| Understanding patterns | Learners |
| Prediction/evolution | Learners |
| Synthesis across time | Learners |

---

## How Learners Get Created

Learners are created from three sources (brain-level concern):

1. **From brain prompt** — Brain parses system prompt, infers what needs tracking
2. **Developer-defined** — Explicit learner definitions
3. **Emergent** — Created when existing learners can't handle a pattern

### Brain Parses Prompt → Creates Learners

Example prompt:

```
"Track my digital life. Help me understand my learning interests,
work patterns, and commitments."
```

Brain infers:
- TextLearner: "Understand learning interests and how they evolve"
- TextLearner: "Understand work patterns and priorities"
- ListLearner: "Track commitments and promises made"

This parsing/inference is a brain-level concern, not learner concern.

---

## Learner Storage

**Decision: Defer to implementation.**

For v0, simple JSON persistence is sufficient. If learner understanding is too large to fit in memory, that's a design smell — the understanding should be compressed or the learner should split.

Type-specific storage (Postgres for ListLearner, Graph DB for GraphLearner) is premature optimization.

---

## Stateful Processing Model

Learners don't just "receive and process" data. They perform **stateful comparison**:

```
Data arrives
    ↓
Compare against existing understanding
    ↓
Decide: Is this relevant? Does it change anything?
    ↓
Update understanding (or not)
    ↓
State persists for next data point
```

This is different from perceivers which process each data point in isolation.

---

## Batching

Batching is a **system concern**, not a learner concern.

- Learners receive batches (could be 1 item or 100)
- Who creates batches, when to send them — brain/injection flow decides
- Learners just process whatever they receive

---

## Perceivers (Perception Agents)

See [perceivers.spec.md](specs/perceivers.spec.md) for full spec.

### Core Principles (Resolved)

1. **Perceivers are agents** — autonomous, decide what and how to perceive
2. **Purpose is explicit** — each perceiver has a defined purpose (like learners)
3. **Stateless** — no memory between data points; each input processed in isolation
4. **Evolves over time** — config/behavior changes via knowledge flow mechanisms
5. **Strict output** — all perceivers produce `{ summary, content[], metadata }`

### Key Decisions

| Question | Decision |
|----------|----------|
| Nature | Agent = autonomous + purpose + tools + methods |
| Scope levels | Brain, subject, record-type — one perceiver per level |
| Composition | Tool-based, brain decides order, no explicit chaining API |
| Conditionals | Both match function (cheap gate) and purpose-driven (agent decides) |
| Concurrency | Sync from caller, internal promise.all — no background jobs |
| Versioning | System/storage concern, not perceiver concern |
| Multi-level merging | Storage concern, perceiver just outputs for its scope |

### Model

```
Perceiver = Agent + Tools + Methods
           ↓
    Internal: autonomous decision-making, uses tools
    External: brain/developer configures via methods
```

Tools include: content extraction, chunking, enrichment, storage access (`lookupEntity`), learner access (`askLearner`)

---

## Knowledge Flow Mechanisms

Three complementary mechanisms for knowledge flow between components:

### 1. Feedback Loop (Async)

Learners inform brain → Brain updates perceiver config → Future records use updated config.

```
Time T1: Perceiver has no category constraints
         CategoryLearner observes patterns over time

Time T2: Brain updates perceiver config
         perceiver.tools.classify.categories = ["tutorial", "opinion", "news"]

Time T3: New records get classified into known categories
```

**Direction:** Learners → Brain → Perceiver config
**Timing:** Async/background

### 2. Runtime Learner Access (Sync)

Perceiver can query learners during perception for current understanding.

```
Record arrives
    ↓
Perceiver calls: tools.askLearner("CategoryLearner", "what categories exist?")
    ↓
Returns: ["tutorial", "opinion", "news"]
    ↓
Perceiver classifies using current knowledge
```

**Direction:** Perceiver → Learners (read-only)
**Timing:** Synchronous at perception time

### 3. Re-perceive (Post-hoc)

Old records get enriched with knowledge that didn't exist at perception time.

```
Record arrives at T1
    ↓
Perceive: basic extraction (no categories yet)
    ↓
Time passes, learners learn categories
    ↓
Re-perceive at T2: enrich old record with new knowledge
```

**Direction:** New knowledge → Old records
**Timing:** Async/scheduled/on-demand

### Summary

| Mechanism | Problem Solved | Direction | Timing |
|-----------|----------------|-----------|--------|
| Feedback loop | Constraint evolution | Learners → Brain → Perceiver | Async |
| Learner access | Access current knowledge | Perceiver → Learners | Sync |
| Re-perceive | Backfill old records | Knowledge → Storage | Async |

---

## Entity Resolution

Entities extracted by perceivers need normalization ("Bob van loijt" = "Bob Van L").

**Solution:** Three-layer approach:

1. **Perceiver:** Has `lookupEntity` tool (read-only storage access) to check canonical names
2. **Storage:** Graph layer does fuzzy matching, links to existing entity nodes
3. **Learner:** EntityLearner tracks aliases and deeper relationships

---

## Storage Architecture

Three storage layers (see [storage.spec.md](specs/storage.spec.md)):

| Layer | Purpose | Needs Embedding |
|-------|---------|-----------------|
| Raw | Preservation, re-processing | No |
| Records | High-level semantic search | Yes |
| Chunks | Precise semantic search | Yes |

**Graph relationships:** Storage layer auto-recognizes entity fields in metadata, creates graph nodes/edges. Perceiver doesn't need to know about storage topology.

---

## Updated Injection Flow

```
brain.inject(rawData)
         ↓
┌────────────────────────────────────────────┐
│ Store in raw (optional)                    │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ Perceive                                   │
│ - Agent with tools                         │
│ - Can query storage (lookupEntity)         │
│ - Can query learners (askLearner)          │
│ → Output: { summary, content[], metadata } │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ Storage routes output                      │
│ - summary → records index (embed)          │
│ - content[] → chunks index (embed each)    │
│ - entity fields → graph nodes/edges        │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ Learners receive perceived data            │
│ - Compare against existing understanding   │
│ - Update state                             │
│ - May trigger feedback to brain            │
└────────────────────────────────────────────┘
```

---

## Metadata Storage and Query Complexity

**The tension:**
- We want schema-less, fluid metadata (no migrations, dynamically updateable)
- But rich queries (geo-radius, date ranges) require typed schemas and indexes
- Different databases (Weaviate, Qdrant, Postgres) have different syntax for these

**Key insight:**
- Perceiver extracts data (geo, dates, etc.) — perceiver's job
- How to store/query it — storage concern
- The schema-less goal is specifically for the records/chunks layer to stay fluid

**Design direction:**
- **Records + Chunks layer:** Schema-less metadata, supports basic filters (equality, contains) + semantic search. No migrations needed.
- **Rich queries:** When developer needs geo-radius, date ranges, etc., this requires explicit schema. Could be:
  - Per-record-type structured storage
  - Field declarations that create typed indexes
  - Separate from the fluid layer

**Trade-off accepted:**
- Simple queries: schema-less, fluid, no setup
- Rich queries: require developer to declare types/structure

This keeps the core flexible while allowing power users to opt into structure when needed.

---

## Open Questions for Query Flow Spec

1. How does Query Agent decide to use learners vs storage?
2. How does competition work when multiple learners respond?
3. How does Query Agent synthesize multiple learner responses?
4. When does Query Agent fall back to storage?

---

## Specs

| Spec | Status | First Principles | Location |
|------|--------|------------------|----------|
| Perceivers | Draft | ✅ Resolved | [perceivers.spec.md](specs/perceivers.spec.md) |
| Learners | Draft | ✅ Resolved | [learners.spec.md](specs/learners.spec.md) |
| Brain | Draft | ⚪ Needs review | [brain.spec.md](specs/brain.spec.md) |
| Storage | Draft | ⚪ Needs review | [storage.spec.md](specs/storage.spec.md) |
| Query Flow | TODO | ❌ Not started | — |

## Eval Learnings (Jan 2026)

Findings from multi-learner evals across 3 datasets (crisis-hostage, developer-memory, therapist-profile):

### Implementation Issues to Fix

1. **Confidence calibration is broken** - All 88 query responses returned "low" confidence regardless of answer quality. The model isn't using the confidence levels meaningfully. Need to investigate whether this is a prompt issue or if confidence should be computed differently (e.g., based on understanding coverage vs query scope).

2. **Relevance scoring lacks discrimination** - Batches consistently score 0.95-0.99 relevance regardless of actual alignment with purpose. Either purposes are too broad or the relevance assessment prompt needs refinement.

3. **Activation doesn't differentiate specialists** - Within each dataset, all learners converge to nearly identical activation levels (e.g., 0.69-0.72 for crisis). Activation should vary more if purposes are genuinely different.

### What Works Well

1. **Understanding synthesis** - The final understanding text is coherent, well-structured, and captures genuine patterns from the data.
2. **Query response quality** - Responses are detailed, accurate, and include meaningful gap identification.
3. **Token efficiency** - ~300-500 tokens/event is reasonable for the depth of processing.

### Open Questions for Brain Router (Future)

- When to create specialists vs use a broader generic learner
- How much purpose overlap is acceptable before learners should merge
- Whether query-time specialization (single learner, multiple query lenses) is more efficient than parallel learners

---

## Pending Discussions

Topics that need first-principles review before implementation:

| Area | Key Questions |
|------|---------------|
| **Learners** | Walk through spec like perceivers, validate types and governance |
| **Injection orchestration** | Error handling, partial failures, transaction semantics |
| **Storage** | Adapter interface, graph layer, entity resolution details |
| **Learner routing** | How brain decides which learners receive which data |
| **Query Flow** | Routing to storage vs learners, competition, synthesis |
| **Governance** | Decay formula, split/merge triggers and execution |
| **Subjects** | Lifecycle, isolation, cross-subject queries |
