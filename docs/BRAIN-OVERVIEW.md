# Brain v0 - Architecture Overview

> Use this document to onboard Claude Code sessions to the brain-v0 codebase.

## What is Brain?

Brain is an **agentic learning system** that builds understanding over time. It decomposes a high-level prompt into specialized **Learners**, each tracking a specific aspect of incoming data. When queried, it synthesizes insights from all learners into a unified response.

**Core idea**: Instead of one monolithic context, Brain maintains multiple focused "understandings" that evolve independently and combine at query time.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                           BRAIN                                  │
│  - Orchestrates learners                                        │
│  - Routes data to all learners                                  │
│  - Synthesizes query responses                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  TextLearner │  │  TextLearner │  │  TextLearner │   ...    │
│  │  (topic A)   │  │  (topic B)   │  │  (topic C)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                    TwoPhaseMethod                               │
│              ┌────────────┴────────────┐                        │
│              │                         │                        │
│         [ Observe ]              [ Synthesize ]                 │
│         Extract relevant         Update understanding           │
│         content + importance     from buffered observations     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Brain
The orchestration layer. Manages multiple learners, routes data, synthesizes answers.

**Key methods:**
- `initialize()` - Decomposes prompt into learner configs, creates learners
- `inject(data)` - Routes data batches to all learners
- `ask(query)` - Queries all learners, synthesizes unified response

### TextLearner
Maintains understanding as narrative text. Each learner has:
- **instructions** - What to focus on
- **understanding** - Current knowledge (text that evolves)
- **evolution** - History of changes with significance levels
- **governance** - Activation level, participation threshold

### Two-Phase Learning

**Phase 1: Observe**
- Examines raw data against learner's purpose
- Extracts relevant content as plain text
- Assigns importance score (0-1)
- Cheap operation (extraction only)

**Phase 2: Synthesize**
- Triggered when buffer thresholds met
- Compares observations against current understanding
- Produces updated understanding + evolution entry
- More expensive (rewrites understanding)

**Why two phases?** Reduces degradation risk. Understanding only changes during synthesis, not on every observation.

### Observation Buffer
Collects observations until synthesis triggers:
- `maxObservations: 10` - Count threshold
- `maxTokens: 8000` - Size threshold
- `minImportance: 0.9` - Importance threshold

Any threshold met → synthesis runs → buffer clears.

### Maintenance Strategies
How understanding grows over time:
- **continuous** - Keeps growing (no compression)
- **cumulative** - Periodically summarizes when too large
- **decay** - Recent observations weighted higher

---

## Data Flow

### Initialization
```
Brain.initialize()
  → LLM decomposes prompt into learner scopes
  → Creates TextLearner for each scope
  → Each learner generates observe/synthesize prompts (one-time)
  → Ready to receive data
```

### Injection
```
brain.inject([item1, item2, ...])
  → Batches by batchSize (default 20)
  → For each batch, all learners process in parallel:
      learner.learn(batch)
        → Observe: extract relevance + importance
        → Buffer: add observation
        → If thresholds met: Synthesize → update understanding
  → Events emitted throughout
```

### Query
```
brain.ask("question")
  → All learners queried in parallel
  → Each returns: { relevant, confidence, insight, gaps }
  → SynthesisAgent combines into single answer
  → Returns: { insight, sources, gaps }
```

---

## Configuration System

Uses **cascading model configuration**. Models flow from specific → general:

```
observe.model → learning.model → brain.model → default
```

Key config structure:
```typescript
BrainConfig {
  model: LanguageModel           // Primary runtime model
  blueprintModel?: LanguageModel // One-time config generation
  ingest.batchSize?: number      // Default 20
  learning: {
    observe.model?: LanguageModel
    synthesize.model?: LanguageModel
    synthesize.thresholds?: { maxObservations, maxTokens, minImportance }
    query.method?: 'tool-based' | 'direct'
    maintenance.strategy?: 'continuous' | 'cumulative' | 'decay'
    maintenance.maxTokens?: number
  }
}
```

---

## Event System

Brain and learners emit typed events for observability:

**Brain events:**
- `brain:init:started/completed/failed`
- `brain:inject:batch:started/completed`
- `brain:ask:synthesis:started/completed`

**Learner events:**
- `learner:observe:started`, `learner:observed`, `learner:observe:dismissed`
- `learner:synthesize:started`, `learner:synthesized`
- `learner:understanding:updated`

Subscribe typed or unified:
```typescript
brain.on('brain:inject:completed', (payload) => { ... })
brain.on((event) => { /* all events */ })
```

---

## File Structure

```
src/
├── brain/
│   ├── class.ts              # Brain orchestrator
│   ├── types.ts              # BrainConfig, events, results
│   └── config.resolver.ts    # Cascade + defaults
│
├── learners/
│   └── text-learner/
│       ├── class.ts          # TextLearner implementation
│       ├── learning-methods/
│       │   └── two-phase/    # Observe → Buffer → Synthesize
│       ├── query-methods/    # tool-based | direct
│       └── strategies/       # continuous | cumulative | decay
│
├── types/
│   └── events.ts             # TypedEmitter base class
│
└── utils/
    └── cascade.ts            # cascade() utility
```

---

## Test Server

Located in `server/` - a Hono.js server with UI for testing:

- `POST /brain/init` - Initialize with config
- `POST /brain/inject` - Inject data (supports Claude Code sessions)
- `POST /brain/ask` - Query the brain
- `GET /brain/status` - Current state
- `GET /brain/events` - SSE stream

UI at `http://localhost:3210` shows learners, events, and chat interface.

Run with: `bun run server/index.ts`

---

## Key Design Patterns

1. **Cascading Configuration** - Models flow specific → general via `cascade()` utility
2. **Identity Generation** - One-time structured output creates reusable system prompts
3. **Discriminated Unions** - `status` field determines result shape
4. **Event-Driven Observability** - TypedEmitter with typed + unified subscriptions
5. **Strategy Pattern** - Pluggable maintenance strategies
6. **Two-Phase Learning** - Separates extraction from understanding updates

---

## Quick Reference

| Component | Purpose | Config Key |
|-----------|---------|------------|
| Brain | Orchestrate learners | `BrainConfig` |
| TextLearner | Build understanding | Generated from prompt |
| Observe | Extract relevant content | `learning.observe.model` |
| Synthesize | Update understanding | `learning.synthesize.model/thresholds` |
| Query | Interrogate understanding | `learning.query.method` |
| Strategy | Manage growth | `learning.maintenance.strategy` |
