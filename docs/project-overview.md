# Unbody Brain v0 — Project Overview

## What We're Building

**Unbody Brain** is a general-purpose cognitive infrastructure — a self-hosted, OSS system where a "brain" is an intelligent container that:

1. **Ingests raw data** through an augmentation pipeline
2. **Maintains understanding** via attention units (not just storage)
3. **Answers questions** that require having "paid attention all along"
4. **Recalls specifics** by falling back to storage when needed

**The core insight:** Some questions can't be answered by search alone. "Have the user's political views shifted over time?" requires continuous observation — you can't reconstruct it from storage. This is what makes Brain different from RAG.

**Tagline:** Not a database that stores. A brain that learns.

---

## What We've Been Doing

We started with an initial architecture doc and raw sketches, then worked **backwards from use cases to architecture** through iterative brainstorming:

1. **Validated use cases** — Conversational memory, IoT behavior engine, personal knowledge assistant, customer data intelligence
2. **First principles exploration** — Asked "why inject?", "why fragments?", "what is understanding?"
3. **Research integration** — Incorporated cognitive science research on emergent governance, activation mechanics, and biological memory systems
4. **Architecture refinement** — Moved from "orchestrator controls everything" to "emergent governance with LLM for semantics, mechanics for lifecycle"
5. **Component-by-component specification** — Now defining each component in detail

---

## Key Architectural Decisions Made

### On Storage
- Storage types (Vector, Graph, Postgres) are **optional BYODB tools**, not layers
- They're for **recall**, not understanding
- A brain can run "attention-only" with no storage (explicit developer choice)

### On Units (formerly "Fragments")
- Units are **attention agents**, not caches
- They maintain **compressed understanding** of specific concerns
- Purpose is **fixed** — evolution happens through population dynamics (split/merge/spawn/die)
- Understanding is **type-specific** (TextUnit, ListUnit, GraphUnit, extensible)
- Governance is **emergent** — activation, thresholds, decay, not central control

### On Governance
- **Local mechanics** (unit handles): activation update, threshold check, ignition detection
- **Global mechanics** (brain handles): decay, deprecation, split/merge
- **LLM for semantics**, mechanical formulas for lifecycle
- No meta-agent controller — governance emerges from substrate conditions

### On Query Flow
- Units self-select based on activation threshold
- Competition ranks responses by activation × confidence
- Query Agent synthesizes final answer
- Storage is fallback for gaps

### On Injection Flow
- Augmentation pipeline enriches data
- Units receive batches (batching is system concern)
- Units process and update understanding
- Storage write is optional

---

## What's Been Completed

### Documents Created

| Document | Status | Description |
|----------|--------|-------------|
| `/docs/initial.specs.md` | ✅ Done | Original architecture document |
| `/docs/initial.sketchs.specs.md` | ✅ Done | Raw sketches and use cases |
| `/docs/cognitive-units.research.md` | ✅ Done | Research on emergent governance |
| `/docs/units.spec.md` | ✅ Done | Complete specification for Units |
| `/docs/project-overview.md` | ✅ Done | This document |

### Concepts Fully Defined

- **Units** — Core structure, types, lifecycle, governance, interface, processing logic, query handling, relationship to subjects

---

## What's Next

### Components to Specify

| Component | Priority | Description |
|-----------|----------|-------------|
| **Brain** | High | The container — lifecycle, configuration, orchestration |
| **Injection Flow** | High | Augmentation pipeline, batching, routing to units |
| **Query Flow** | High | Unit consultation, competition, Query Agent, synthesis |
| **Subjects** | Medium | Scoping mechanism, brain-level vs subject-level units |
| **Query Agent** | Medium | LLM agent for synthesis, gap detection, tool calling |
| **Storage Interface** | Medium | How BYODB tools integrate |
| **Governance Engine** | Medium | Background processes for decay, deprecation, split/merge |

### Decisions Still Needed

1. **Batching strategy** — Where does batching logic live? When do batches trigger?
2. **Extraction logic** — Brain-level extraction vs unit-level? Single LLM call vs agentic?
3. **Activation formula** — Exact computation from relevance, retrieval, recency
4. **Split/merge detection** — How brain detects when population dynamics should occur
5. **Query Agent tools** — What tools does it have access to? How does it decide to use storage?

### Implementation Phases (Tentative)

**Phase 1: Core Loop**
- Brain container
- Single unit type (TextUnit)
- Basic injection → process → query flow
- No storage, no subjects

**Phase 2: Type System**
- ListUnit, GraphUnit
- Type-specific processing and maintenance

**Phase 3: Governance**
- Activation mechanics
- Decay, deprecation
- Ignition of proto-units

**Phase 4: Storage & Recall**
- BYODB integration
- Query Agent with storage fallback

**Phase 5: Subjects & Scoping**
- Subject-level units
- Cross-subject queries

**Phase 6: Advanced Governance**
- Split/merge detection
- Emergent unit spawning from impasse

---

## Architecture Diagram (Current Understanding)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   BRAIN                                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         INJECTION FLOW                                │  │
│  │                                                                       │  │
│  │   inject(data) → Augmentation → Batching → Units (process) → Storage  │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           QUERY FLOW                                  │  │
│  │                                                                       │  │
│  │   ask(query) → Units (consult) → Competition → Query Agent → Response │  │
│  │                                        ↓                              │  │
│  │                                   Storage (if gaps)                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       ATTENTION UNITS                                 │  │
│  │                                                                       │  │
│  │   [TextUnit] [ListUnit] [GraphUnit] [Proto-units (dormant)]           │  │
│  │                                                                       │  │
│  │   Each unit:                                                          │  │
│  │   - purpose (fixed, natural language)                                 │  │
│  │   - understanding (type-specific)                                     │  │
│  │   - governance (activation, threshold, status)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    BACKGROUND GOVERNANCE                              │  │
│  │                                                                       │  │
│  │   Decay │ Deprecation │ Split/Merge Detection                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   STORAGE TOOLS (BYODB, optional)                     │  │
│  │                                                                       │  │
│  │   [Vector DB]   [Graph DB]   [Postgres]                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   EXTERNAL TOOLS (optional)                           │  │
│  │                                                                       │  │
│  │   [Linear MCP]  [Gmail MCP]  [Custom...]                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Session Notes

This spec was developed through iterative brainstorming, questioning assumptions at each step:

- Started with "fragments" → evolved to "attention units"
- Started with "orchestrator controls" → evolved to "emergent governance"
- Started with "three storage layers" → evolved to "optional BYODB tools"
- Started with "shared context for stigmergy" → simplified to "direct broadcast for v0"
- Consistently pushed back on premature implementation details
- Used research on cognitive architectures to inform design

The goal is: **Design for ultimate, implement incrementally.**
