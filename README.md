# Brain

> **Status: R&D / Work in Progress**

An adaptive learning system that builds and maintains understanding from streaming data.

## What is Brain?

Brain is an experimental framework for creating AI systems that learn continuously from data streams. Instead of stateless question-answering, Brain accumulates knowledge over time, similar to how humans build understanding through repeated exposure and synthesis.

**Core capabilities:**

- **Incremental Learning** — Processes data streams (events, documents, conversations) continuously
- **Understanding Synthesis** — Builds structured knowledge from observations
- **Confident Responses** — Answers queries with calibrated confidence and explicit gap awareness
- **Auto-specialization** — Generates specialized learners from natural language prompts
- **Self-evolution** — Autonomously adapts learner structure (create, merge, split, update, delete) based on performance signals
- **Pluggable Storage** — Memory or SQLite persistence at both brain and learner levels

Think of it as giving an LLM persistent, evolving memory that improves over time.

## Quick Start

### Prerequisites

- Node.js v20+
- [OpenRouter API key](https://openrouter.ai/) (for LLM access)

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd brain-v0

# Install dependencies
npm install

# Set up your API key
export OPENROUTER_API_KEY=your_key_here
```

### Option 1: Web UI (Recommended for exploring)

Launch the interactive web interface:

```bash
npx tsx server/index.ts
# Open http://localhost:3210/ui/
```

The UI lets you:

- Configure Brain with natural language prompts
- Select storage independently for brain and learner levels (Memory or SQLite)
- Inject data (paste text, upload files, or browse Claude sessions)
- Chat with Brain and see real-time learning
- Monitor learner states, schemas, and evolution history
- Manage learners (create, remove, adjust, query individually)
- Trigger evolution actions (create, merge, split, update, delete learners)

### Option 2: Programmatic Usage

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Brain } from './src'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
})

const brain = new Brain({
  prompt: `
    Track my coding patterns and development philosophy.
    Learn from my git commits, code reviews, and conversations.
  `,
  model: openrouter('google/gemini-2.0-flash-001')
})

// Initialize — generates specialized learners via LLM decomposition
await brain.initialize()

// Inject data — Brain routes to relevant learners
await brain.inject([
  {
    type: 'git_commit',
    message: 'refactor: extract validation into pure functions',
    files: ['src/utils/validators.ts']
  },
  {
    type: 'code_review',
    comment: 'Too heavy. Factory functions work fine for our scale.',
    sentiment: 'reject'
  }
])

// Ask questions — queries all learners, synthesizes unified response
const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)
console.log('Confidence:', result.confidence)
console.log('Gaps:', result.gaps)
```

## Key Concepts

### Brain Orchestrator

The orchestration layer that:

- Auto-generates specialized learners from your prompt
- Routes data to relevant learners via batched injection
- Synthesizes unified responses from multiple learner perspectives
- Manages learner lifecycle through signals and evolution
- Persists its own state (learner registry, evolution history) via `BrainStore`

### Learners

Independent learning agents with specialized understanding types:

- **TextLearner** — Builds free-text understanding (prose summaries, narratives)
- **ListLearner** — Maintains structured collections (items with confidence, signals, metadata)

All learners share a common base (`BaseLearner`) and:

- Have specific focus areas (e.g., "coding philosophy", "preferences", "behavioral patterns")
- Auto-generate observation and understanding schemas from their instructions
- Observe incoming data for relevance
- Build understanding over time through synthesis
- Answer queries from their specialized perspective
- Report confidence and knowledge gaps
- Emit health signals when performance degrades

### Two-Phase Learning

Brain uses a two-phase approach:

1. **Observe Phase**: Extract relevant information from raw data
   - Filters noise, focuses on purpose-specific content
   - Buffers observations in the store as `pending`

2. **Understand Phase**: Update understanding from buffered observations
   - Triggers when pending count or token thresholds are reached
   - Merges new insights with existing knowledge
   - Marks processed observations (never deleted)
   - Records evolution history with significance tracking

### Self-Evolution (Living Brain)

Brain autonomously adapts its learner structure based on performance signals:

- **Signal System**: Learners emit signals when thresholds are crossed (high dismissal, low confidence, stagnation)
- **Tool-Based Evaluator**: LLM investigates signals and decides what actions to take
- **Evolution Actions**: Create, merge, split, update, or delete learners
- **Coverage Gap Detection**: Evaluator identifies areas not covered by existing learners
- **Purpose Changes**: When brain prompt changes, evaluator restructures learners automatically

```typescript
// Enable evolution
const brain = new Brain({
  prompt: '...',
  model: openrouter('google/gemini-2.0-flash-001'),
  evolution: {
    enabled: true,
    evaluatorSignalThreshold: 3,
    autoEvaluate: true,
  }
})

// Manual evolution actions
await brain.createLearner('Track user frustration patterns')
await brain.mergeLearners(['learner-a', 'learner-b'], 'Combine overlapping concerns')
await brain.splitLearner('broad-learner', 'Separate into technical vs behavioral')

// Or let the evaluator decide
await brain.evaluateEvolution()
```

### Non-Evolution Learner Management

These work without evolution enabled:

```typescript
// Add a learner with explicit config
await brain.addLearner({
  id: 'my-learner',
  name: 'Preferences',
  type: 'list',
  instructions: 'Track user preferences and favorites',
})

// Adjust a learner with natural language
await brain.adjustLearner('my-learner', 'Focus more on UI preferences')

// Remove a learner
await brain.removeLearner('my-learner')
```

### Storage

Brain has two independent storage layers:

| Layer            | Interface    | Purpose           | Namespaces                                            |
|------------------|--------------|-------------------|-------------------------------------------------------|
| **Brain Store**  | `BrainStore` | Brain-level state | `state`, `learners`, `evolution`                      |
| **Learner Store**| `Store`      | Per-learner data  | `observations`, `understanding`, `evolution`, `state` |

Each layer has two implementations:

- **MemoryStore** / **MemoryBrainStore** — In-memory, ephemeral (default)
- **SQLiteStore** / **SQLiteBrainStore** — Persistent via `better-sqlite3`

```typescript
import { SQLiteBrainStore } from './src/brain/stores/sqlite'
import { SQLiteStore } from './src/learners/stores/sqlite'

const brain = new Brain({
  prompt: '...',
  model: openrouter('google/gemini-2.0-flash-001'),
  store: new SQLiteBrainStore('./data/brain.db'),
  learning: {
    store: (learnerId) => new SQLiteStore(`./data/learner-${learnerId}.db`),
  }
})
```

With SQLite file storage, restarting the server and re-initializing with the same paths restores all state — learners, understanding, evolution history.

### Cascading Configuration

Model selection flows down from Brain → Learners → Operations:

```typescript
const brain = new Brain({
  prompt: '...',
  model: fastModel,                       // Default for all operations
  blueprintModel: smartModel,             // Schema generation
  learning: {
    observer: {
      model: fastModel,                   // Observation extraction
      blueprintModel: smartModel,         // Observer schema generation
    },
    understand: {
      model: smartModel,                  // Understanding synthesis
      thresholds: {
        maxObservations: 15,              // Trigger synthesis after N observations
        minImportance: 0.3,               // Minimum importance to buffer
      }
    },
    query: { model: smartModel },         // Per-learner queries
  }
})
```

This lets you optimize cost vs quality — use fast models for high-volume observations, smart models for critical synthesis and queries.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                            Brain                                │
│  (Orchestration, decomposition, synthesis, evolution)           │
│                                                                 │
│  ┌──────────────────┐  ┌─────────────────────────────────┐     │
│  │    Evaluator      │  │    Evolution Orchestrator        │     │
│  │  (Signal-driven   │  │  (Create/Merge/Split/Update/    │     │
│  │   decisions)      │  │   Delete handlers)              │     │
│  └──────────────────┘  └─────────────────────────────────┘     │
└────────────────────────────┬────────────────────────────────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │Learner 1 │    │Learner 2 │    │Learner N │
       │  (Text)  │    │  (List)  │    │  (Text)  │
       └────┬─────┘    └────┬─────┘    └────┬─────┘
            │               │               │
            │  Observe → Store → Understand │
            └───────────────┬───────────────┘
                            │
                 ┌──────────┼──────────┐
                 ▼                     ▼
           ┌───────────┐        ┌───────────┐
           │ LLM Layer │        │  Storage   │
           │ (ai-sdk)  │        │ (Memory /  │
           └───────────┘        │  SQLite)   │
                                └───────────┘
```

### Tech Stack

- **Runtime**: Node.js (server uses tsx)
- **LLM SDK**: Vercel AI SDK
- **Providers**: OpenRouter (multi-provider access)
- **Validation**: Zod schemas
- **Storage**: MemoryStore (default) or SQLiteStore (`better-sqlite3`)
- **Server**: Hono + `@hono/node-server`
- **Events**: Server-Sent Events (SSE) for real-time updates

## Configuration

### BrainConfig

```typescript
interface BrainConfig {
  prompt: string                    // Natural language description
  model: LanguageModel              // Default model for all operations
  blueprintModel?: LanguageModel    // Model for schema generation
  autoSetup?: boolean               // Enable LLM decomposition (default: true)
  learners?: GeneratedLearnerConfig[] // Explicit learner definitions
  store?: BrainStore                // Brain-level persistence
  init?: {
    model?: LanguageModel           // Model for decomposition
  }
  query?: {
    model?: LanguageModel           // Model for ask() synthesis
  }
  ingest?: {
    batchSize?: number              // Events per inject batch
  }
  learning?: {
    store?: (id: string) => Store   // Learner store factory
    observer?: {
      model?: LanguageModel
      blueprintModel?: LanguageModel
    }
    understand?: {
      model?: LanguageModel
      blueprintModel?: LanguageModel
      thresholds?: {
        maxObservations?: number
        maxTokens?: number
        minImportance?: number
      }
    }
    query?: { model?: LanguageModel }
    governance?: {
      strategy?: 'continuous' | 'cumulative' | 'decay'
      maxTokens?: number
    }
  }
  evolution?: {
    enabled?: boolean
    evaluatorSignalThreshold?: number
    autoEvaluate?: boolean
  }
}
```

## Project Structure

```text
brain-v0/
├── src/
│   ├── brain/                # Brain orchestration layer
│   │   ├── class.ts          # Brain implementation
│   │   ├── types.ts          # BrainConfig, event maps, result types
│   │   ├── state.ts          # BrainState management
│   │   ├── agent.ts          # Synthesis agent for ask()
│   │   ├── config.defaults.ts
│   │   ├── stores/           # Brain-level persistence
│   │   │   ├── types.ts      # BrainStore, BrainCollection interfaces
│   │   │   ├── memory.ts     # MemoryBrainStore
│   │   │   └── sqlite.ts     # SQLiteBrainStore
│   │   ├── evaluator/        # Signal-driven evolution decisions
│   │   │   ├── class.ts      # Evaluator with tool-based LLM
│   │   │   └── tools/        # Decision-making tools
│   │   ├── evolution/        # Evolution action execution
│   │   │   ├── orchestrator.ts
│   │   │   └── handlers/     # Create, merge, split, update, delete
│   │   ├── prompts/          # Root decomposition + system prompts
│   │   └── schemas/          # Decomposition output schemas
│   ├── learners/             # Learner implementations
│   │   ├── base/             # BaseLearner (shared pipeline)
│   │   │   ├── class.ts      # Abstract base with observe/understand/query
│   │   │   ├── types.ts      # BaseResolvedConfig, SharedLearnerEventMap
│   │   │   ├── state.ts      # BaseLearnerState
│   │   │   └── query/        # Query module
│   │   ├── text-learner/     # TextLearner (free-text understanding)
│   │   ├── list-learner/     # ListLearner (structured collections)
│   │   ├── observer/         # Shared observer logic
│   │   └── stores/           # Learner-level persistence
│   │       ├── types.ts      # Store, Collection interfaces
│   │       ├── memory.ts     # MemoryStore
│   │       └── sqlite.ts     # SQLiteStore (better-sqlite3)
│   ├── llm/                  # LLM wrapper (JSON repair, usage tracking)
│   └── utils/                # Shared utilities
├── server/                   # Web UI + API
│   ├── index.ts              # Hono server (HTTP + SSE)
│   └── public/
│       └── index.html        # Single-page UI
├── evals/                    # Evaluation scripts
│   ├── datasets/             # Test data
│   └── scripts/              # Eval scripts (store, learner, brain)
└── docs/
    └── specs/                # Design specs
```

## Running Evaluations

Brain includes eval suites for testing components in isolation and end-to-end:

```bash
# Set up API key
export OPENROUTER_API_KEY=your_key_here

# Store evals (no LLM required)
npx tsx evals/scripts/store-01-standalone.ts

# Learner evals
npx tsx evals/scripts/learner-01-lifecycle.ts
npx tsx evals/scripts/learner-05-learn.ts

# Brain evals
npx tsx evals/scripts/brain-01-lifecycle.ts
npx tsx evals/scripts/brain-04-init-complete.ts

# Brain store evals
npx tsx evals/scripts/brain-store-01-standalone.ts
```

## Limitations & Future Work

### Current Limitations

- **Scale**: Not optimized for large-scale data (100K+ events)
- **Learner types**: TextLearner and ListLearner only
- **Runtime constraint**: SQLite store uses `better-sqlite3` (Node.js native addon) — not compatible with Bun runtime

### Roadmap

- [x] Advanced governance (auto-merging, splitting learners)
- [x] Persistent storage (SQLite adapter)
- [x] Learner state serialization/restore from store
- [x] Multiple learner types (TextLearner, ListLearner)
- [x] Schema generation (observation + understanding schemas)
- [x] Self-evolution (signal-driven evaluator with tool-based decisions)
- [x] Brain-level persistence (BrainStore for learner registry + evolution history)
- [ ] Streaming injection (real-time data sources)
- [ ] Benchmark suite (accuracy, calibration, cost)
- [ ] Multi-Brain federation (Brain networks)

## Contributing

This is an active R&D project. Contributions welcome:

1. **Try it out**: Run evals, test with your own data
2. **Report issues**: What breaks? What's confusing?
3. **Share results**: How does it perform in your use case?
4. **Propose ideas**: Architecture improvements, new features

Open an issue or PR on GitHub.

## License

MIT

---

*This is an [Unbody](https://unbody.io) research project.*
