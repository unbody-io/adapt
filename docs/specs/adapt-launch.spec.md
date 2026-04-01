# Adapt — Launch Spec

## Decisions

### Name & Branding
- **Project name**: Adapt
- **Internal naming**: Brain (orchestrator) / Neuron (specialized unit, replaces "Learner")
- **Package**: `@unbody/adapt` (single npm package)
- **Version**: `0.1.0`
- **License**: MIT

### Rejected Names for Neuron
- *Learner* — too generic, doesn't feel like it belongs inside a Brain
- *Cell* — considered but ultimately passed on
- *Cortex* — heavy to type, anatomically a brain has one cortex
- *Lobe* — clinical, not accessible enough
- *Synapse* — metaphor doesn't fit (connectors, not processors)
- *Lens* — doesn't go with brain metaphor
- *Sense* — too passive, doesn't convey synthesis
- *Node* — overloaded in JS ecosystem
- *Module* — overloaded in JS ecosystem
- *Agent* — most overloaded word in AI right now

### Package Structure
- Single package with two subpath exports:
  - `@unbody/adapt` — everything (Brain, Neurons, memory stores, types)
  - `@unbody/adapt/sqlite` — SQLite stores (opt-in, requires `better-sqlite3`)
- `better-sqlite3` as optional peer dependency
- `files: ["dist"]` — only dist/ ships to npm
- Server, playground, evals, docs excluded from npm

### Repo Structure (Not a Monorepo)
```
adapt/
├── src/
│   ├── brain/
│   ├── neurons/
│   │   ├── base/
│   │   ├── text/
│   │   └── list/
│   ├── stores/
│   │   ├── memory/
│   │   └── sqlite/
│   ├── llm/
│   ├── types/
│   ├── utils/
│   ├── index.ts            # root export — everything except sqlite
│   └── sqlite.ts           # sqlite subpath export
├── server/                  # not published
├── playground/              # not published
├── evals/                   # not published
├── docs/                    # not published
└── package.json
```

- Single repo, single package. No monorepo tooling.
- Designed so it can become a multi-package monorepo later if needed (folder structure already mirrors how packages would split).

### Import Paths
```typescript
import { Brain, TextNeuron, ListNeuron, MemoryBrainStore, MemoryNeuronStore } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'
```

### Git History
- Squash via interactive rebase
- Keep meaningful milestones (initial architecture, observer pipeline, understand pipeline, query system, store persistence, evolution system, brain orchestration)
- Remove day-to-day noise

### README
- Standard open-source landing page (not technical docs)
- Tech docs live in `/docs` folder and on the website

### Still TBD
- Tagline / one-liner
- Blog post / announcement
- Landing page copy
- CI/CD pipeline
- Unit test suite (CI-friendly, no LLM keys)

---

## Task Breakdown

### Phase 1: Rename & Restructure

1. **Rename Learner → Neuron across the entire codebase**
   - Classes: `BaseLearner` → `BaseNeuron`, `TextLearner` → `TextNeuron`, `ListLearner` → `ListNeuron`
   - Methods: `addLearner()` → `addNeuron()`, `getLearners()` → `getNeurons()`, `removeLearner()` → `removeNeuron()`, `adjustLearner()` → `adjustNeuron()`, `createLearner()` → `createNeuron()`, `deleteLearner()` → `deleteNeuron()`, `mergeLearners()` → `mergeNeurons()`, `splitLearner()` → `splitNeuron()`, `updateLearner()` → `updateNeuron()`
   - Types, interfaces, configs, events, file names, folder names
   - Internal learners → internal neurons
   - Evals, server, playground — update all references
   - LLM prompts that mention "learner"

2. **Rename package: `@unbody/brain` → `@unbody/adapt`**
   - `package.json` name, description
   - All import paths in evals, server, playground

3. **Restructure `src/` folders**
   - `src/learners/` → `src/neurons/`
   - `src/learners/base/` → `src/neurons/base/`
   - `src/learners/text-learner/` → `src/neurons/text/`
   - `src/learners/list-learner/` → `src/neurons/list/`
   - `src/learners/stores/` → `src/stores/memory/` and `src/stores/sqlite/`
   - Brain stores: `src/brain/stores/` → `src/stores/memory/` and `src/stores/sqlite/` (colocated with neuron stores)
   - Create `src/sqlite.ts` as the subpath export entry point

4. **Remove `examples/` directory**

### Phase 2: Package Setup

5. **Configure `package.json` for publishing**
   - `name`: `@unbody/adapt`
   - `version`: `0.1.0`
   - `license`: `MIT`
   - `files`: `["dist"]`
   - `exports`: `{ ".": "./dist/index.js", "./sqlite": "./dist/sqlite.js" }`
   - Move `hono`, `@hono/node-server`, playground deps to `devDependencies`
   - Move `better-sqlite3` to `peerDependencies` (optional)
   - Add `peerDependenciesMeta` for `better-sqlite3`

6. **Update `src/index.ts`** — root export
   - Export Brain, TextNeuron, ListNeuron, BaseNeuron
   - Export MemoryBrainStore, MemoryNeuronStore
   - Export all types, configs, events
   - Do NOT export SQLite stores from root

7. **Create `src/sqlite.ts`** — subpath export
   - Export SQLiteBrainStore, SQLiteNeuronStore

8. **Verify build** — `tsc` compiles cleanly with new structure

### Phase 3: Git History

9. **Interactive rebase** — squash commits into meaningful milestones

### Phase 4: Documentation

10. **Write new README** — standard open-source landing page
    - Project name, tagline (TBD), brief description
    - Install instructions
    - Quick start example (minimal Brain + inject + ask)
    - Standalone Neuron example
    - Link to `/docs` for full documentation
    - License, Unbody attribution

11. **Create `/docs` folder structure**
    - Getting started / quick start
    - Core concepts (Brain, Neuron, observe → understand pipeline, evolution)
    - TextNeuron guide (narrative understanding, cognitive skills, governance)
    - ListNeuron guide (structured collections, schemas, CRUD)
    - Stores (memory, SQLite, custom)
    - Configuration reference (BrainConfig, model cascade, thresholds, governance)
    - Evolution guide (signals, evaluator, manual control)
    - Writing instructions guide
    - API reference
    - Recipes

### Phase 5: Pre-publish Checks

12. **Verify npm publishing**
    - `npm pack` — inspect tarball, confirm only `dist/` ships
    - Confirm `@unbody` npm org exists with publish access
    - Confirm subpath export resolves correctly
    - Test install in a fresh project

13. **Confirm all evals still pass** after rename/restructure

14. **Clean up** — remove dead code, unused exports, stale references to "learner"

### Phase 6: Launch

15. **Publish `@unbody/adapt@0.1.0` to npm**

16. **Deferred TODOs**
    - Tagline / one-liner
    - Blog post / announcement
    - Landing page copy
    - Unit test suite (CI-friendly, no LLM keys)
    - CI/CD pipeline (GitHub Actions for build + test + publish)

---

## What Adapt Is (Complete Brief for Copy/Tagline Work)

### From Raw Notes

**Core Thesis:**
Adapt is a memory that doesn't recall — it learns as it goes. If you need to recall historic data, you're better off using existing memories or storage like databases. Adapt is designed to complement those systems.

**The Attention Problem:**
Adapt's core philosophy is based on one simple fact: there are questions that can't be answered if you don't pay attention along the way. Most approaches to memory are about storing data, retrieving it, and synthesizing over it. This is effective — but there are situations where you need more. You need continuous comprehension.

**Memory != Storage:**
Adapt doesn't store data — it understands data. More importantly, it doesn't understand everything about the data — it understands what matters to the context. The context is defined by you as a developer and by the data itself. This is attention-based memory, following the nature of language models themselves.

**Self-Evolving Architecture:**
Adapt's structure and architecture evolve over time based on: incoming data, queries it answers, explicit instructions from the developer. The system shapes itself around usage.

**Designed For:**
Building software and knowledge bases that need to adapt over time.

**Complementary, Not Competitive:**
Adapt sits alongside databases, RAG pipelines, and existing memory systems. It answers the questions they structurally can't.

### Refined Framing

Three stacked insights:

1. **The attention problem.** There are questions you can only answer if you were paying attention as data came in. No retroactive querying recovers what you didn't notice in the moment.

2. **Memory != storage.** Most memory systems store and retrieve. Adapt develops understanding. The difference is a filing cabinet vs a person who's been in the room the whole time. You can't grep your way to "what patterns have been emerging over the last three months."

3. **The structure adapts.** What Adapt pays attention to, how it organizes knowledge, how many neurons it maintains — all evolve based on what flows through it. Architecture shaped by usage, not just configuration.

**Undersold / Not Yet Articulated:**
- The complementary angle: additive, not competitive with existing tools
- The "what matters to the context" point: this is what separates Adapt from a generic summarizer — selective understanding oriented around a developer-defined purpose

### From the Codebase (Technical Reality)

- A Brain is an orchestrator that coordinates multiple Neurons. Each Neuron focuses on a specific domain — one might track user preferences, another might track behavioral patterns, another might maintain an inventory
- Data flows in continuously via `brain.inject()`. The Brain routes it to relevant Neurons. Each Neuron observes, filters for relevance, and integrates what matters into its evolving understanding
- Understanding is not a log or a summary — it's a living document that gets rewritten as new data arrives. A TextNeuron maintains narrative understanding ("user has been increasingly frustrated with X"). A ListNeuron maintains structured collections ("these are the active projects and their status")
- You query the Brain with natural language: `brain.ask("what patterns have emerged?")`. Neurons use their accumulated understanding to answer — not by searching raw data, but by consulting what they've learned
- The Brain can evolve its own structure — creating new Neurons when it detects uncovered domains, merging Neurons that overlap, splitting ones that grew too broad. This happens through a signal/evaluation system
- Neurons work standalone too — you don't need a Brain. A single Neuron can observe and build understanding independently
- LLM-powered throughout — observation filtering, understanding synthesis, query answering, and evolution decisions all use language models. Supports any provider via Vercel AI SDK
- Persistent via pluggable stores — in-memory for experiments, SQLite for production. The entire state (observations, understanding, evolution history) can be persisted and restored
- Developer controls what each Neuron pays attention to via natural language instructions, schemas, and governance strategies

### From the README (Feature-Level Detail)

- Brain auto-decomposes a prompt into specialized neurons via LLM, routes data to all of them, and synthesizes a unified answer
- Standalone neurons work independently without Brain — direct control over a single domain
- Data flows through two phases: **Observe** (LLM filters incoming data, extracts relevant observations, scores importance) → **Understand** (LLM synthesizes pending observations into compressed knowledge)
- Querying is separate: the LLM reads the neuron's understanding and answers questions with relevance/confidence scores
- TextNeuron: narrative prose understanding, cognitive skills (compare: confirms/contradicts/extends/new + dynamics: recurs/intensifies/fades/shifts/avoids), governance strategies (continuous/cumulative/decay)
- ListNeuron: structured collection with LLM-generated schemas, CRUD tools, mechanical confidence via touchCount
- Brain maintains internal neurons for meta-knowledge: global patterns, query patterns, injection gaps, query gaps
- Evolution: signal-based system where neurons emit health signals, coverage gaps are detected, developer can inject custom signals → evaluator makes decisions → orchestrator executes (create/merge/split/update/delete)
- Instructions are the single most important input — they determine observer identity, schema generation, synthesis behavior, and query behavior
- "A neuron with vague instructions produces vague understanding. A neuron with specific instructions produces grounded, evidence-backed knowledge"
- The filing cabinet analogy: "the difference is a filing cabinet vs a person who's been in the room the whole time"
- Cross-domain connections: synthesis LLM sees all neuron responses and finds bridges
- User-steerable taxonomy: merge, split, adjust neurons via natural language
- Persistence across sessions: restore from SQLite, no LLM calls on restore
- Practical limits: 10-20 neurons comfortable, 50+ works but increases latency/cost linearly. Bottleneck is LLM calls, not Brain itself
- Works with any Vercel AI SDK provider (OpenAI, Anthropic, Google, OpenRouter, any OpenAI-compatible)
- Streaming support for queries, evolution evaluation — returns raw AI SDK StreamTextResult objects
- Two query modes: direct (fast, parallel) and deep (agentic, multi-step)
- `inspect()` for agentic read-only introspection of brain structure and knowledge
- `consult()` for querying internal neurons (meta-knowledge)
- Model cascade: brain.model flows to all neurons, overridable at every level
- Cost-optimized setup: cheap model for high-volume observation, smart model for synthesis

---

## README Draft

### Blurb
Adapt is a self-evolving memory layer for AI applications. Instead of storing and retrieving data, it continuously observes incoming information, builds understanding, and reshapes its own structure over time. It answers the questions that databases and RAG pipelines structurally can't — the ones that require paying attention as data flows in.

### Why
There are questions you can only answer if you were paying attention when the data came in. What patterns have been emerging over the last three months? Where do stated intentions contradict actual behavior? What keeps coming up that nobody's acting on? You can store everything and still miss all of this. Logs don't capture it. Summaries flatten it. RAG retrieves what you saved, not what you noticed.

### How
Adapt routes incoming data through a Brain — an orchestrator that coordinates specialized Neurons, each responsible for a different domain of knowledge. Neurons don't store raw data. They observe what's relevant, discard what isn't, and synthesize what they keep into compressed, evolving understanding. Query the Brain and it answers from what the system has learned, not by searching what it saved. But more importantly, Adapt is designed to live like a living organisation; the architecture reshapes itself with usage: Neurons are created when new domains emerge, merged when they overlap, split when they're overloaded. You define the purpose. The structure adapts to the data.


Also somehere 
"Think of Adapt like a mycelium network..."