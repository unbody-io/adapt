# Brain

> **Status: R&D / Work in Progress**

A developer toolkit for building AI systems that learn, remember, and evolve.

## What is Brain?

Brain gives you composable primitives for building systems that accumulate knowledge over time. You create specialized **learners** (text or list), feed them data, query them, listen to **events**, inject **signals**, and let the system **evolve** its own structure — all through a typed, event-driven API.

Brain is not a product. It's a tool. You decide what data goes in, what learners to create, what events to react to, and what to surface to users. The LLM is the reasoning engine — Brain manages the pipeline around it.

**Developer primitives:**

- **Learners** — Specialized learning agents. TextLearner builds narrative understanding (prose). ListLearner maintains structured collections with LLM-generated schemas and agentic CRUD.
- **Events** — 50+ typed events across every phase (observe, synthesize, query, evolution). Build reactive logic on top.
- **Signals** — Inject custom signals to drive evolution decisions. Learners also emit health signals automatically.
- **Evolution** — Create, merge, split, update, delete learners — manually or autonomously via an LLM evaluator.
- **Queries** — Ask questions across all learners. Get synthesized answers with per-source relevance, confidence, and gap tracking.
- **Storage** — Memory or SQLite persistence at both brain and learner levels. Full state restore across sessions.

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

### Web UI (for exploring)

```bash
npx tsx server/index.ts
# Open http://localhost:3210/ui/
```

The UI lets you configure Brain with natural language, inject data, chat, monitor learner states and schemas, manage learners, and trigger evolution actions.

### Programmatic Usage

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Brain } from './src'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
})

const brain = new Brain({
  prompt: 'Track my coding patterns and development philosophy.',
  model: openrouter('google/gemini-2.0-flash-001'),
})

await brain.initialize()

// Inject data — routes to all learners in parallel
await brain.inject([
  { type: 'git_commit', message: 'refactor: extract validation into pure functions' },
  { type: 'code_review', comment: 'Too heavy. Factory functions work fine for our scale.', sentiment: 'reject' },
])

// Query — synthesizes across all learners
const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)        // Synthesized answer
console.log(result.sources)        // Per-learner: { learnerId, relevance, confidence, insight }
console.log(result.gaps)           // Knowledge gaps identified

// React to learning events
brain.on('learner:synthesized', (payload) => {
  console.log(`${payload.learnerId} updated understanding`)
  console.log(`Significance: ${payload.significance}`)
  console.log(`Evolution: ${payload.evolution}`)
})

// Inject custom signals to drive evolution
brain.signal({
  source: 'app',
  description: 'Users keep asking about deployment patterns but no learner covers it',
  bypass: true, // force immediate evaluation
})
```

## Core Concepts

### Brain Orchestrator

The coordination layer that:

- Auto-generates specialized learners from your prompt (or accepts explicit configs)
- Routes injected data to all learners in parallel
- Synthesizes unified responses from multiple learner perspectives
- Manages learner lifecycle through signals and evolution
- Emits typed events for every operation
- Persists its own state (learner registry, evolution history) via `BrainStore`

### Learner Types

#### TextLearner — Narrative Understanding

Builds and maintains a single body of prose that synthesizes what it has learned. Good for qualitative patterns, philosophies, interconnected concepts, and anything that benefits from narrative reasoning.

**Governance strategies** control how understanding grows:

| Strategy | Behavior | Use when |
|----------|----------|----------|
| `continuous` | Unbounded growth, no compression | Low volume, want full detail |
| `cumulative` | Grows until `maxTokens`, then compresses to a seed and resets the cycle | Streams where only recent context matters |
| `decay` | Organizes into Current/Recent/Historical sections, compresses older content gradually | Long-running processes where recency matters |

```typescript
await brain.addLearner({
  type: 'text',
  instructions: 'Track evolving product philosophy and design principles',
  governance: { strategy: 'decay', maxTokens: 8000 },
})
```

#### ListLearner — Structured Collections

Maintains a collection of items with **arbitrary, domain-specific schemas**. The schema isn't hardcoded — it's **generated by the LLM from the learner's instructions**.

When you create a ListLearner with instructions like "track restaurants including cuisine, location, and rating," the LLM reasons about the domain and generates a JSON Schema with fields like `name`, `cuisine`, `location`, `rating`. This schema then validates the CRUD tools during the understand phase.

**This means you can track anything** — behavioral patterns, temporal events, entities, preferences, inventory — just by describing it in instructions. The LLM designs the schema.

**Agentic understand phase**: During synthesis, the LLM agent has CRUD tools:

| Tool | What it does |
|------|-------------|
| `listItems()` | List all items with data and confidence |
| `searchItems(query)` | Full-text search across all fields |
| `getItem(id)` | Fetch single item with full metadata |
| `addItem(data, confidence?, signals?)` | Add new item (auto-checks for duplicates first) |
| `updateItem(id, data?, confidence?, signals?)` | Merge new data into existing item (never replaces) |
| `removeItem(id, reason)` | Remove item with explicit reason |

**Item structure**:

```typescript
{
  id: string
  data: Record<string, unknown>  // Arbitrary fields matching LLM-generated schema
  metadata: {
    confidence: number           // 0-1 score, updated during synthesis
    firstSeen: string            // ISO 8601 timestamp
    lastUpdated: string          // ISO 8601 timestamp
    signals: string[]            // Accumulated tags/markers
  }
}
```

**Governance** (applied mechanically after synthesis):

| Option | Values | Default |
|--------|--------|---------|
| `deduplication` | `'strict'` / `'none'` | `'strict'` |
| `maxItems` | number | `200` |
| `pruning` | `'oldest'` / `'least-confident'` / `'none'` | `'oldest'` |

```typescript
await brain.addLearner({
  type: 'list',
  instructions: 'Track intake velocity — periods, save counts, dominant behavioral modes, top topics',
  governance: { deduplication: 'strict', maxItems: 100, pruning: 'least-confident' },
})
```

### Learning Pipeline

Data flows through two phases, each emitting events:

```text
brain.inject(data)
  │
  ├─ Batched (configurable batchSize)
  │
  └─ For each learner (in parallel):
     │
     ├─ OBSERVE: LLM extracts relevant observations
     │   ├─ Emits: learner:observe:started, learner:observed OR learner:observe:dismissed
     │   ├─ Each observation scored by importance (0-1)
     │   ├─ Filtered by minImportance threshold
     │   └─ Stored as "pending" with timestamp
     │
     └─ UNDERSTAND (when buffer thresholds met):
         ├─ Emits: learner:synthesize:started, learner:synthesized
         ├─ TextLearner: LLM synthesizes narrative from observations + prior understanding
         ├─ ListLearner: LLM agent uses CRUD tools to update collection
         ├─ Significance tracked: 'new' | 'extends' | 'confirms' | 'contradicts'
         └─ Observations marked processed (never deleted)
```

**Understand triggers** (configurable):

- Pending observation count >= `maxObservations` (default: 10)
- Total pending tokens >= `maxTokens` (default: 8000)

### Self-Evolution

Brain adapts its learner structure through signals and an LLM evaluator:

**Signal sources:**

- **Automatic** — learners emit signals on: high dismissal rate, low query relevance, low confidence, observation stagnation
- **Coverage gaps** — when queries consistently get low relevance from all learners
- **Developer-injected** — `brain.signal()` with custom signals from your application

**Evaluator flow:**

1. Signals buffer until threshold (default: 5) or `bypass: true`
2. LLM evaluator investigates (has tools: `getUnderstandings`, `getLearnerActivity`, `getRecentHistory`)
3. Produces decisions: create, merge, split, update, or delete learners
4. Evolution orchestrator executes decisions

```typescript
// Manual evolution
await brain.createLearner('Track user frustration patterns')
await brain.mergeLearners(['learner-a', 'learner-b'], 'Combine overlapping concerns')
await brain.splitLearner('broad-learner', 'Separate into technical vs behavioral')
await brain.updateLearner('learner-x', 'Narrow focus to frontend only')
await brain.deleteLearner('learner-y')

// Or let the evaluator decide
await brain.evaluateEvolution()
```

### Learner Management (without evolution)

These work without `evolution.enabled`:

```typescript
// Add with explicit config
await brain.addLearner({
  id: 'my-learner',
  type: 'list',
  instructions: 'Track user preferences and favorites',
})

// Adjust with natural language — evolves instructions, regenerates schemas and prompts
// Existing understanding and observations are preserved
await brain.adjustLearner('my-learner', 'Focus more on UI preferences, stop tracking API preferences')

// Remove
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

### Event System

Brain emits 50+ typed events across every phase. Subscribe to specific events or all events at once:

```typescript
// Typed subscription (specific event)
brain.on('learner:synthesized', (payload) => {
  console.log(`${payload.learnerId} updated understanding`)
  console.log(`Significance: ${payload.significance}`)  // 'new' | 'extends' | 'confirms' | 'contradicts'
})

// Unified subscription (all events)
brain.on((event) => {
  console.log(`[${event.type}] at ${event.timestamp}`)
})
```

Learner events are automatically forwarded through Brain — you don't need to subscribe to each learner individually.

**Events by phase:**

| Phase | Events | Key payload fields |
|-------|--------|--------------------|
| **Init** | `brain:init:started`, `brain:init:config:generated`, `brain:init:completed` | `configs[]`, `learnerIds[]` |
| **Inject** | `brain:inject:started`, `brain:inject:batch:completed`, `brain:inject:completed` | `injectId`, `itemCount`, `batchCount`, `results[]` |
| **Observe** | `learner:observe:started`, `learner:observed`, `learner:observe:dismissed` | `learnerId`, `output[]`, `importance`, `bufferCount` |
| **Synthesize** | `learner:synthesize:started`, `learner:synthesized` | `learnerId`, `newUnderstanding`, `previousUnderstanding`, `significance`, `evolution` |
| **Query** | `learner:query:started`, `learner:query:completed` | `learnerId`, `insight`, `relevant`, `relevance`, `confidence`, `gaps[]` |
| **Ask** | `brain:ask:started`, `brain:ask:completed` | `queryId`, `insight`, `sources[]`, `gaps[]` |
| **Health** | `learner:health:updated`, `learner:signal` | `activation`, `status`, `metrics` (dismissalRate, avgRelevance, etc.) |
| **Evolution** | `evaluator:evaluation:completed`, `evolution:action:executed` | `decisions[]`, `action`, `targets[]`, `result` |
| **Config** | `learner:config:updated`, `learner:prompts:regenerated` | `changedFields[]`, `observePrompt`, `understandPrompt` |

### Signals

Inject custom signals to drive evolution decisions:

```typescript
brain.signal({
  source: 'analytics',                    // Any string identifier
  description: 'Users asking about deployment but no learner covers it',
})
```

Signals buffer until `evaluatorSignalThreshold` (default: 5), then trigger LLM evaluation. Use `bypass: true` to force immediate evaluation:

```typescript
brain.signal({
  source: 'admin',
  description: 'Critical: restructure learners for new product direction',
  bypass: true,
})
```

**Automatic signals** emitted by learners:

- High dismissal rate (>80% observations dismissed)
- Low query relevance (avg < 0.3 over last 5 queries)
- Low query confidence (avg < 0.3 over last 5 queries)
- Stagnation (observations buffered > 3x maxObservations without synthesis)

### Query Response

`brain.ask()` returns a synthesized answer with per-source attribution:

```typescript
const result = await brain.ask('What patterns do you see?')

result.insight    // Synthesized answer from all relevant learners
result.sources    // Per-learner contributions:
                  //   [{ learnerId, relevance (0-1), confidence (0-1), insight }]
result.gaps       // Knowledge gaps identified across all learners
```

Each individual learner query also returns:

```typescript
const learnerResult = await learner.query('What do you know about X?')

learnerResult.relevant     // boolean: does this learner have relevant knowledge?
learnerResult.relevance    // 0-1: how relevant to the question
learnerResult.confidence   // 0-1: how confident in the answer
learnerResult.insight      // the learner's answer
learnerResult.gaps         // what the learner doesn't know
```

Use these scores for application-layer judgment — decide what to surface, what to suppress, and when.

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

## Recipes

Common patterns for composing Brain primitives.

### Behavioral Tracking

Use a ListLearner with instructions that describe the behavioral dimensions you want to track. The LLM generates the schema — you don't define fields manually.

```typescript
await brain.addLearner({
  type: 'list',
  instructions: `Track behavioral patterns: intake velocity (saves per period),
    dominant mode (exploring/deciding/processing/coping), session depth,
    annotation ratio, and top topics per period`,
  governance: { maxItems: 50, pruning: 'oldest' },
})
```

The LLM will generate a schema with fields like `period`, `saveCount`, `dominantMode`, `annotationRatio`, `topTopics` and maintain the collection via CRUD tools during each synthesis.

### Proactive Insights

Brain is query-driven. To build proactive behavior, combine events + scheduled queries:

```typescript
// React to new understanding
brain.on('learner:synthesized', async (payload) => {
  if (payload.significance === 'contradicts' || payload.significance === 'new') {
    const insight = await brain.ask('What new patterns or tensions have emerged?')
    if (insight.sources.some(s => s.confidence > 0.7)) {
      notifyUser(insight)
    }
  }
})

// Periodic reflection
setInterval(async () => {
  const insight = await brain.ask('Are any current concerns pulling in opposite directions?')
  if (insight.sources.some(s => s.relevance > 0.6)) {
    surfaceToUser(insight)
  }
}, REFLECTION_INTERVAL)
```

### Real-Time Contextualization on Ingest

Listen to observation events to provide immediate feedback when data arrives:

```typescript
brain.on('learner:observed', (payload) => {
  // This fires during inject — each learner reports what it noticed
  console.log(`Learner ${payload.learnerId} observed ${payload.output.length} items`)
  console.log(`Importance: ${payload.importance}, Buffer: ${payload.bufferCount} pending`)
})

brain.on('learner:synthesized', (payload) => {
  // Understanding just updated — surface the evolution summary
  console.log(`New understanding: ${payload.evolution}`)
  console.log(`Significance: ${payload.significance}`)
})
```

### Cross-Domain Connection Finding

Multi-learner synthesis is built in. Just ask the right question:

```typescript
const result = await brain.ask('What connects my interest in calm technology with my wedding planning?')
// Synthesis LLM sees responses from ALL learners and finds bridges
console.log(result.insight)
console.log(result.sources) // Which learners contributed, with relevance scores
```

### User-Steerable Taxonomy

Let users reshape the brain's structure with natural language:

```typescript
// User says "merge e-ink and paper-like displays under hardware"
await brain.mergeLearners(['eink-learner', 'paper-displays'], 'Combine under hardware')

// User says "split AI into tools and research"
await brain.splitLearner('ai-learner', 'Separate into AI tools vs AI research')

// User says "stop tracking inspiration, too vague"
await brain.adjustLearner('categories', 'Stop categorizing things as inspiration — too vague')

// Or let the user steer with a directive that adjusts behavior going forward
await brain.adjustLearner('topics', 'Be stricter about what counts as a distinct topic')
```

### Quality Gating

Use confidence and relevance scores to decide what reaches the user:

```typescript
const result = await brain.ask(query)

// Only surface high-quality responses
const dominated = result.sources.filter(s => s.confidence > 0.6 && s.relevance > 0.5)
if (dominated.length === 0) {
  // Silence — nothing worth surfacing
  return null
}

// Surface with attribution
return {
  insight: result.insight,
  confidence: Math.max(...dominated.map(s => s.confidence)),
  gaps: result.gaps,
}
```

## API Reference

### Brain API

**Lifecycle:**

| Method | Returns | Description |
|--------|---------|-------------|
| `initialize()` | `Promise<void>` | Init brain (auto-called on first inject/ask) |
| `dispose()` | `Promise<void>` | Clean up all learners and stores |

**Data:**

| Method | Returns | Description |
|--------|---------|-------------|
| `inject(data)` | `Promise<BrainInjectResult>` | Route data to all learners. Accepts array or single item. |
| `ask(query)` | `Promise<BrainAskResult>` | Query all learners, synthesize unified response |

**Learner Management:**

| Method | Returns | Description |
|--------|---------|-------------|
| `addLearner(config)` | `Promise<BaseLearner>` | Add learner with explicit config |
| `removeLearner(id)` | `Promise<void>` | Remove learner |
| `adjustLearner(id, directive)` | `Promise<BaseLearner>` | Evolve learner with natural language. Changes instructions, regenerates schemas/prompts. Preserves understanding and observations. |
| `getLearner(id)` | `BaseLearner \| undefined` | Get learner by ID |
| `getLearners()` | `BaseLearner[]` | Get all learners |

**Evolution** (requires `evolution.enabled`):

| Method | Returns | Description |
|--------|---------|-------------|
| `createLearner(guidance)` | `Promise<BaseLearner>` | Create new learner from natural language guidance |
| `deleteLearner(id)` | `Promise<void>` | Delete learner via evolution |
| `mergeLearners(ids, guidance)` | `Promise<BaseLearner>` | Merge 2+ learners into one |
| `splitLearner(id, guidance)` | `Promise<BaseLearner[]>` | Split learner into multiple |
| `updateLearner(id, guidance)` | `Promise<BaseLearner>` | Update learner config via LLM |
| `evaluateEvolution(options?)` | `Promise<{decisions, results}>` | Manually trigger evolution evaluation |

**Signals & Config:**

| Method | Returns | Description |
|--------|---------|-------------|
| `signal({ source, description, bypass? })` | `void` | Inject signal for evolution evaluation |
| `update(updates)` | `Promise<BrainUpdateResult>` | Update brain config (3-phase: brain-only → mechanical cascade → signal-driven semantic) |
| `on(type, handler)` | `this` | Subscribe to specific event |
| `on(handler)` | `this` | Subscribe to all events |

**Accessors:**

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | `string` | Brain's purpose prompt |
| `config` | `ResolvedBrainConfig` | Current resolved config |
| `store` | `BrainStore` | Persistence layer |

### Learner API

**Learning:**

| Method | Returns | Description |
|--------|---------|-------------|
| `learn(batch)` | `Promise<LearnOutput>` | Process data batch (observe → understand) |
| `query(question)` | `Promise<QueryResult>` | Query learner directly |
| `getBufferState()` | `Promise<{count, tokens}>` | Pending observations count/tokens |

**Understanding:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getUnderstanding()` | `Promise<T>` | Get current knowledge (string for text, ListItem[] for list) |
| `setUnderstanding(value)` | `Promise<void>` | Set knowledge directly |
| `getSummary()` | `Promise<string>` | Get prose summary |
| `hasKnowledge()` | `Promise<boolean>` | Check if learner has any understanding |

**Introspection:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getHealth()` | `LearnerHealth` | Health metrics (activation, status) |
| `getMetrics()` | `LearnerMetrics` | Ingestion/query metrics (dismissalRate, etc.) |
| `getEvolution()` | `Promise<EvolutionRecord[]>` | Evolution history |
| `getObservationSchema()` | `Record \| null` | JSON Schema for observations |
| `getUnderstandingSchema()` | `Record \| null` | JSON Schema for understanding |
| `getGovernance()` | `GovernanceConfig` | Current governance settings |

**Config:**

| Method | Returns | Description |
|--------|---------|-------------|
| `update(updates)` | `Promise<{changedFields}>` | Update learner config (stateless regen) |
| `adjust(directive)` | `Promise<{changedFields}>` | Evolutionary adjustment (incremental, LLM-driven) |
| `on(type, handler)` | `this` | Subscribe to learner events |

**Identity accessors:** `id`, `name`, `instructions`, `description`, `type`, `focus`, `origin`

## Configuration

```typescript
interface BrainConfig {
  prompt: string                          // Brain's purpose
  model: LanguageModel                    // Default model for all operations
  blueprintModel?: LanguageModel          // Model for schema generation
  autoSetup?: boolean                     // LLM decomposition (default: true)
  learners?: GeneratedLearnerConfig[]     // Explicit learner definitions
  store?: BrainStore                      // Brain-level persistence

  init?: { model?: LanguageModel }        // Model for decomposition
  query?: { model?: LanguageModel }       // Model for ask() synthesis
  ingest?: { batchSize?: number }         // Events per batch (default: 20)

  learning?: {
    store?: (id: string) => Store         // Learner store factory
    observer?: {
      model?: LanguageModel
      blueprintModel?: LanguageModel
    }
    understand?: {
      model?: LanguageModel
      blueprintModel?: LanguageModel
      thresholds?: {
        maxObservations?: number          // default: 10
        maxTokens?: number                // default: 8000
        minImportance?: number            // default: 0.5
      }
    }
    query?: { model?: LanguageModel }
    governance?: {                        // TextLearner governance
      strategy?: 'continuous' | 'cumulative' | 'decay'   // default: 'cumulative'
      maxTokens?: number                  // default: 16000
    }
  }

  evolution?: {
    enabled?: boolean                     // default: true
    evaluatorSignalThreshold?: number     // default: 5
    autoEvaluate?: boolean                // default: true
  }
}
```

## Running Evaluations

```bash
export OPENROUTER_API_KEY=your_key_here

# Store evals (no LLM required)
npx tsx evals/scripts/store-01-standalone.ts
npx tsx evals/scripts/brain-store-01-standalone.ts

# Learner evals
npx tsx evals/scripts/learner-01-lifecycle.ts
npx tsx evals/scripts/learner-05-learn.ts

# Brain evals
npx tsx evals/scripts/brain-01-lifecycle.ts
npx tsx evals/scripts/brain-04-init-complete.ts
```

## Limitations

- **Scale**: Not optimized for large-scale data (100K+ events)
- **Learner types**: TextLearner and ListLearner only (custom types require code changes)
- **Runtime**: SQLite store uses `better-sqlite3` (Node.js native addon) — not compatible with Bun

## License

MIT

---

*This is an [Unbody](https://unbody.io) research project.*
