# @unbody/brain

AI agents that learn, remember, and evolve.

## Install

```bash
npm install @unbody/brain
```

Brain uses the [Vercel AI SDK](https://sdk.vercel.ai) for LLM access. Install a provider:

```bash
npm install ai @ai-sdk/openai      # or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Minimal Brain

```typescript
import { Brain } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track my coding patterns and development philosophy.',
  model: openai('gpt-4o'),
})

await brain.initialize()

await brain.inject([
  { type: 'commit', message: 'refactor: extract validation into pure functions' },
  { type: 'review', comment: 'Too heavy — factory functions work fine for our scale.' },
])

const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)
```

Brain auto-decomposes the prompt into specialized learners via LLM, routes data to all of them, and synthesizes a unified answer.

### Standalone Learner

Learners work independently without Brain:

```typescript
import { TextLearner, MemoryStore } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const learner = new TextLearner({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and philosophy.',
  store: new MemoryStore(),
})

await learner.learn([
  'User said: simplicity over features',
  'Team decided: no dark patterns, ever',
])

const result = await learner.query('What are our design principles?')
console.log(result.insight)
```

### Explicit Learners

Skip LLM decomposition and define learners yourself:

```typescript
const brain = new Brain({
  prompt: 'Track cooking knowledge.',
  model: openai('gpt-4o'),
  autoSetup: false,
  learners: [
    {
      id: 'techniques',
      name: 'Cooking Techniques',
      type: 'text',
      description: 'Culinary methods and approaches',
      instructions: 'Track cooking techniques, methods, and principles.',
    },
    {
      id: 'recipes',
      name: 'Recipe Collection',
      type: 'list',
      description: 'Tracked recipes and ingredients',
      instructions: 'Track recipes with cuisine type, ingredients, and difficulty level.',
    },
  ],
})

brain.on('learner:synthesized', (e) => {
  console.log(`${e.learnerId}: ${e.significance} — ${e.evolution}`)
})

await brain.initialize()
```

Both `autoSetup` and `learners` can coexist — Brain will auto-generate additional learners alongside your explicit ones.

---

## Concepts

### Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                              Brain                                    │
│  Orchestration · Decomposition · Synthesis · Evolution                │
│                                                                       │
│  ┌────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Evaluator     │  │  Evolution            │  │  Internal        │  │
│  │  (signal →      │  │  Orchestrator         │  │  Learners        │  │
│  │   decisions)    │  │  (create/merge/       │  │  (gaps, query    │  │
│  │                 │  │   split/update/       │  │   patterns,      │  │
│  │                 │  │   delete)             │  │   global         │  │
│  │                 │  │                       │  │   understanding) │  │
│  └────────────────┘  └──────────────────────┘  └──────────────────┘  │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
          ┌──────────┐    ┌──────────┐    ┌──────────┐
          │Learner A │    │Learner B │    │Learner N │
          │  (Text)  │    │  (List)  │    │  (Text)  │
          └────┬─────┘    └────┬─────┘    └────┬─────┘
               │               │               │
               │  Observe → Buffer → Understand │
               └───────────────┬───────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼                     ▼
              ┌───────────┐        ┌───────────┐
              │  LLM      │        │  Storage   │
              │  (ai-sdk) │        │  (Memory/  │
              └───────────┘        │   SQLite)  │
                                   └───────────┘
```

### Learning Pipeline

Data flows through two phases:

1. **Observe** — LLM filters incoming data, extracts relevant observations, scores importance (0–1). Irrelevant data is dismissed with gap tracking. Observations are buffered as "pending."

2. **Understand** — When buffer thresholds are met (observation count or token count), LLM synthesizes pending observations into compressed knowledge. TextLearner produces narrative prose. ListLearner uses CRUD tools to update a structured collection. Each synthesis produces a significance rating (`routine`, `notable`, `critical`).

Querying is separate: the LLM reads the learner's understanding and answers questions with relevance/confidence scores.

### Brain vs Standalone

**Brain** orchestrates multiple learners — auto-generates them from a prompt, routes data to all of them, synthesizes multi-learner responses, and manages evolution. Use Brain when you want the system to decide its own structure.

**Standalone learners** (`TextLearner`, `ListLearner`) work independently. You create them, feed them data, query them. Use standalone when you want direct control over a single domain.

### Text vs List

| | TextLearner | ListLearner |
|---|---|---|
| **Understanding** | Narrative prose (string) | Structured collection (items) |
| **Good for** | Patterns, philosophy, qualitative themes, behavioral tendencies | Entities, catalogs, inventories, tracking distinct things |
| **Synthesis** | LLM integrates observations into one evolving text | LLM agent uses CRUD tools to add/update/remove items |
| **Schema** | N/A | LLM-generated from instructions |
| **Confidence** | LLM-assigned per query (how well can I answer this?) | Mechanical — `touchCount / maxTouchCount` (evidence frequency) |
| **Cognitive skills** | Compare (confirms/contradicts/extends/new) + Dynamics (recurs/intensifies/fades/shifts/avoids) | None — CRUD tools only |
| **Governance** | Strategy (continuous, cumulative, decay) + maxTokens | Deduplication + maxItems + pruning |

**Choosing between them:**

Use **TextLearner** when the domain is about *how things relate* — patterns, philosophy, evolving narratives, behavioral tendencies. The understanding is a living document that synthesizes across observations. Good for: coding philosophy, design principles, personal behavior patterns, research themes.

Use **ListLearner** when the domain is about *tracking distinct things* — each item is independently identifiable and has its own lifecycle. The understanding is a structured collection where items are added, updated, and removed. Good for: feature requests, contact lists, recipe collections, inventory, event logs.

**Rule of thumb:** If the answer to "what do you know?" is a narrative → TextLearner. If it's a table or list of items → ListLearner.

---

## Brain

### Creating a Brain

```typescript
import { Brain, MemoryBrainStore, MemoryStore } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  // Required
  prompt: 'Track user coding patterns and development philosophy.',
  model: openai('gpt-4o'),

  // Optional — all have defaults
  autoSetup: true,                        // LLM decomposition (default: true)
  learners: [],                           // Explicit learner definitions
  store: new MemoryBrainStore(),          // Brain-level persistence (default: MemoryBrainStore)
  learning: {
    store: (id) => new MemoryStore(),     // Per-learner store factory (default: MemoryStore)
  },
  evolution: {
    enabled: true,                        // default: true
  },
})
```

`initialize()` is called automatically on first `inject()` or `ask()`. Call it explicitly if you want to control timing:

```typescript
await brain.initialize()
```

On init, Brain tries to restore from the store first (no LLM call). If no state exists, it runs fresh LLM decomposition.

### Injecting Data

```typescript
// Array or single item — anything serializable
await brain.inject([
  { type: 'note', text: 'Users prefer dark mode' },
  { type: 'commit', message: 'refactor: move to composition API' },
])

// With custom ID
await brain.inject(data, { id: 'session-42' })
```

Data is sent to **all** learners in parallel. Each learner's observer independently decides what's relevant. Items are batched by `ingest.batchSize` (default: 20).

When all learners dismiss a batch, it enters the dismissed batch buffer and feeds the internal gap learner.

#### What observers see

The observer receives your data as `JSON.stringify(data, null, 2)`. It sees the raw structure — keys, values, nesting. Structure your data so the observer can reason about it:

```typescript
// Good — structured, self-describing, rich context
await brain.inject([
  {
    type: 'bookmark',
    url: 'https://example.com/local-first',
    title: 'Local-First Software',
    highlights: ['CRDTs enable...', 'Offline-first is...'],
    tags: ['architecture', 'sync'],
    source: 'reader-app',
    savedAt: '2025-03-01T10:30:00Z',
    readingTime: 420, // seconds
  },
])

// Bad — opaque, no context for the observer to reason about
await brain.inject(['https://example.com/local-first'])
```

The observer does **not** see the learner's current understanding when filtering — it only uses its generated identity (derived from `instructions`) to decide relevance. This is intentional: observation is fast and stateless.

**Timestamps matter.** If your use case involves temporal patterns (frequency, velocity, dormancy), include timestamps in the data. The observer and synthesizer will see them and can reason about time if the learner's instructions ask for it.

### Querying

```typescript
const result = await brain.ask('What patterns do you see?')

result.insight    // Synthesized answer from all learners
result.sources    // [{ learnerId, relevance, confidence, insight }]
result.gaps       // Knowledge gaps across all learners
```

Two query modes:

- **`direct`** (default) — All learners queried in parallel (single LLM call each), then one synthesis call. Fast: typically 3–5s per query.
- **`deep`** — Agentic synthesis where the LLM decides which specialists to consult, what to ask, and when it has enough. Slower but can do follow-up queries. Internal learners available as consult tools.

```typescript
// Default — fast, parallel
const result = await brain.ask('What patterns do you see?')

// Agentic — multi-step, selective
const deep = await brain.ask('What patterns do you see?', { mode: 'deep' })

// Override model per-call
const result = await brain.ask('...', { model: openai('gpt-4o') })
```

### Streaming

All query and evaluation methods have streaming variants that return raw ai-sdk `StreamTextResult` objects. Use `textStream` for incremental text or `fullStream` for all events (text, tool calls, tool results, etc.).

```typescript
// Stream a brain query
const stream = await brain.askStream('What patterns do you see?')

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk) // incremental text
}

// Or iterate all events (tool calls visible in deep mode)
const stream = await brain.askStream('What patterns?', { mode: 'deep' })

for await (const part of stream.fullStream) {
  if (part.type === 'text-delta') process.stdout.write(part.text)
  if (part.type === 'tool-call') console.log(`Tool: ${part.toolName}`)
  if (part.type === 'tool-result') console.log(`Result: ${part.output}`)
}

// Resolved promises available after stream completes
const text = await stream.text
const usage = await stream.usage
```

```typescript
// Stream a standalone learner query
const stream = await learner.queryStream('What do you know about pour-over?')

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk)
}
```

```typescript
// Stream evolution evaluation
const { stream, decisions } = await brain.evaluateEvolutionStream({ dryRun: true })

for await (const part of stream.fullStream) {
  // See evaluator tool calls: inspectSpecialist, querySpecialist, finalizeDecisions, etc.
}

const { decisions: d, results } = await decisions // resolves after stream completes
```

### Consulting Internal Learners

Brain maintains internal learners that track meta-knowledge:

| Internal Learner | Type | Tracks |
|---|---|---|
| Global Injection Understanding | text | Cross-domain patterns from all learner knowledge |
| Global Query Understanding | list | Query topics, frequency, clusters |
| Injection Gaps | text | Data no learner could process |
| Query Gaps | text | Questions no learner could answer well |

Query them via `consult()`:

```typescript
const meta = await brain.consult('What cross-domain patterns have emerged?')

// Target a specific internal learner
const gaps = await brain.consult('What knowledge gaps exist?', {
  learner: '__internal_injection_gaps',
})
```

All internal learners are enabled by default. Toggle them:

```typescript
const brain = new Brain({
  // ...
  internalLearners: {
    globalInjectionUnderstanding: true,                // enabled (default)
    globalQueryUnderstanding: false,                   // disabled
    injectionGaps: { governance: { maxTokens: 4000 } }, // enabled with overrides
    queryGaps: true,
  },
})
```

### Inspecting the Brain

`inspect()` is an agentic read-only method that answers questions about the brain's structure and knowledge. An LLM agent browses learner metadata, reads understanding summaries, and consults internal learners to build its answer.

```typescript
// What is the brain set up to track? (works even before any data is injected)
const result = await brain.inspect('What are you learning and tracking?')
console.log(result.insight)

// Deeper questions about accumulated knowledge
const health = await brain.inspect('Which learners have the most gaps?')
```

Unlike `ask()` (which queries learner knowledge) or `consult()` (which queries internal self-knowledge), `inspect()` can reason across both — and works on a fresh brain by falling back to learner configs when no understanding exists yet.

### Managing Learners

**Basic management** — works without evolution:

```typescript
// Add with explicit config
const learner = await brain.addLearner({
  id: 'ui-patterns',
  type: 'text',
  name: 'UI Patterns',
  description: 'Tracks UI/UX design patterns',
  instructions: 'Track user interface patterns, component choices, and design decisions.',
})

// Adjust with natural language — incremental, preserves knowledge
await brain.adjustLearner('ui-patterns', 'Focus more on accessibility patterns')

// Remove
await brain.removeLearner('ui-patterns')

// Inspect
brain.getLearners()          // all external learners
brain.getLearner('ui-patterns')  // specific learner
```

**Evolution management** — requires `evolution.enabled` (default: true):

```typescript
// LLM designs the learner from guidance
const learner = await brain.createLearner('Track emerging frontend frameworks')

// Merge overlapping learners
const merged = await brain.mergeLearners(
  ['react-learner', 'vue-learner'],
  'Combine into unified frontend framework tracker'
)

// Split overloaded learner
const parts = await brain.splitLearner(
  'broad-learner',
  'Separate into technical patterns vs team dynamics'
)

// LLM-driven update
await brain.updateLearner('learner-x', 'Narrow scope to React hooks only')

// Delete via evolution
await brain.deleteLearner('learner-y')
```

### Update vs Adjust

These are different operations:

**`brain.adjustLearner(id, directive)`** — Natural language steering. The LLM sees the learner's current state and evolves it incrementally. Preserves all existing observations and understanding. Think "steering."

```typescript
await brain.adjustLearner('topics', 'Be stricter about what counts as a distinct topic')
await brain.adjustLearner('patterns', 'Also track testing patterns going forward')
```

**`brain.update(config)`** — Config replacement. Mechanical fields cascade to all learners immediately. Semantic fields (prompt, instructions) go through the evaluator. Three phases: brain-only state → mechanical cascade → signal-driven semantic.

```typescript
// Mechanical: cascades immediately to all learners
await brain.update({
  learning: { understand: { thresholds: { maxObservations: 20 } } },
})

// Semantic: triggers evolution evaluation
await brain.update({ prompt: 'Track design systems instead of coding patterns.' })
```

**Standalone learner equivalents:**

```typescript
// adjust() — incremental, LLM sees current state
await learner.adjust('Also track performance metrics')

// update() — replace config, regenerate from scratch
await learner.update({
  instructions: 'Track only React performance patterns.',
  understand: { thresholds: { maxObservations: 5 } },
})
```

---

## Learners

### TextLearner

Builds narrative understanding — a single body of prose that evolves over time.

```typescript
import { TextLearner, MemoryStore } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const learner = new TextLearner({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and user research insights.',
  store: new MemoryStore(),
  governance: { strategy: 'decay', maxTokens: 8000 },
  understand: {
    thresholds: { maxObservations: 5, minImportance: 0.3 },
  },
})

await learner.learn([
  'User testing showed: 3-click navigation preferred over hamburger menu',
  'Design review: dark mode should be default for evening users',
])

const understanding = await learner.getUnderstanding() // string
const result = await learner.query('What are the key design principles?')
```

**Cognitive skills:** TextLearner uses two skill sets during synthesis to recognize patterns in observations:

| Skill Set | Skills | What they detect |
|---|---|---|
| **Compare** | `confirms`, `contradicts`, `extends`, `new` | How new observations relate to existing understanding |
| **Dynamics** | `recurs`, `intensifies`, `fades`, `shifts`, `avoids` | How patterns change over time — frequency, acceleration, decline, direction changes, avoidance |

Each skill is defined as a question the learner asks itself when recognizing the pattern. For example, `recurs` asks "This keeps appearing — how many times? Over what timespan? In what contexts?" This drives the learner to gather specifics rather than just label patterns.

Skills are automatic — you don't configure them. Your instructions influence *how* the learner applies them to your domain.

**Governance strategies:**

| Strategy | Behavior | Use when |
|---|---|---|
| `continuous` | Unbounded growth, no compression | Low volume, want full detail |
| `cumulative` | Grows until `maxTokens`, then compresses to a seed and resets | Default. Bounded learning with periodic consolidation |
| `decay` | Organizes into Current/Recent/Historical; older content compresses | Evolving knowledge where recency matters |

### ListLearner

Maintains a structured collection with LLM-generated schemas.

```typescript
import { ListLearner, MemoryStore } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const learner = new ListLearner({
  model: openai('gpt-4o'),
  instructions: 'Track restaurants with cuisine type, location, price range, and rating.',
  store: new MemoryStore(),
  governance: { deduplication: 'strict', maxItems: 100, pruning: 'least-confident' },
})

await learner.learn([
  'Had amazing ramen at Ichiran in Shibuya — rich tonkotsu broth, ¥1200',
  'Tried the new Italian place on 5th — mediocre pasta, overpriced',
])

const items = await learner.getUnderstanding() // ListItem[]
```

The LLM generates the data schema from your instructions. For "track restaurants with cuisine, location, price range, and rating," it produces fields like `name`, `cuisine`, `location`, `priceRange`, `rating`. During synthesis, the LLM agent uses CRUD tools (`addItem`, `updateItem`, `removeItem`, `listItems`, `searchItems`, `getItem`) to manage the collection.

**Schema generation depends on your instructions.** The fields in the schema come directly from what you describe. If your instructions say "track whether it's been rejected by the PM," the schema will have a rejection field. If you don't mention it, it won't exist — and that data will be lost even if it appears in observations. See [Writing Instructions](#writing-instructions) for guidance.

**Custom schemas:** You can bypass LLM schema generation entirely by providing `observationSchema` and/or `understandingSchema` in the learner config:

```typescript
const brain = new Brain({
  prompt: 'Track therapy sessions.',
  model: openai('gpt-4o'),
  autoSetup: false,
  learners: [{
    id: 'window-of-tolerance',
    type: 'list',
    name: 'Window of Tolerance',
    description: 'Tracks nervous system regulation per session',
    instructions: 'Track zone states, triggers, and recovery patterns.',
    observationSchema: {
      zone_state: { type: 'string', enum: ['hyper', 'within', 'hypo'] },
      trigger: { type: 'string' },
      somatic_cue: { type: 'string' },
    },
    understandingSchema: {
      dominant_zone: { type: 'string' },
      zone_shifts: { type: 'array', items: { type: 'object' } },
      overall_trend: { type: 'string', enum: ['contracting', 'stable', 'expanding'] },
    },
  }],
})
```

When provided, schemas are used as-is — no LLM call, fully deterministic. This works for both `TextLearner` and `ListLearner`, and for both standalone learners and Brain-managed explicit learners.

**Item structure:**

```typescript
{
  id: string
  data: Record<string, unknown>   // Fields matching LLM-generated schema
  metadata: {
    confidence: number            // 0–1, mechanical: touchCount / maxTouchCount
    touchCount: number            // How many times this item was referenced in observations
    firstSeen: string             // ISO 8601
    lastUpdated: string           // ISO 8601
    signals: string[]             // Accumulated tags
  }
}
```

**Confidence is mechanical, not LLM-judged.** Each time an observation references an item (via `updateItem`), its `touchCount` increments. After each synthesis, confidence is normalized: `touchCount / maxTouchCount` across all items. The most-referenced item always has confidence 1.0. This means confidence reflects *evidence frequency*, not LLM opinion.

**Deduplication during synthesis:** When the LLM agent calls `addItem`, the system automatically searches existing items using full-text search (FTS5 with porter stemming in SQLite). If similar items are found, the tool returns them and asks the LLM to use `updateItem` instead. This catches near-duplicates like "Custom Fields" vs "Custom Fields on Tasks."

**Governance:**

| Option | Values | Default |
|---|---|---|
| `deduplication` | `'strict'` / `'none'` | `'strict'` |
| `maxItems` | number | `200` |
| `pruning` | `'oldest'` / `'least-confident'` / `'none'` | `'oldest'` |

### Common Learner API

Both `TextLearner` and `ListLearner` share:

```typescript
// Learning
await learner.learn(batch)                    // LearnOutput
await learner.learn(batch, { forceSynthesize: true }) // Force understand phase

// Querying
const result = await learner.query('...')     // QueryResult

// Understanding
await learner.getUnderstanding()              // string (text) or ListItem[] (list)
await learner.setUnderstanding(value)         // Set directly
await learner.getSummary()                    // Prose summary
await learner.hasKnowledge()                  // Has any understanding?

// Introspection
learner.getHealth()                           // { activation, status, signalThresholds }
learner.getMetrics()                          // { dismissalRate, avgRelevance, avgConfidence, ... }
await learner.getEvolution()                  // EvolutionRecord[]
learner.getObservationSchema()                // JSON Schema for observations
learner.getUnderstandingSchema()              // JSON Schema for understanding
learner.getGovernance()                       // Current governance settings

// Config
await learner.adjust('natural language directive')
await learner.update({ instructions: '...' })

// Identity
learner.id                                    // string
learner.name                                  // string
learner.instructions                          // string
learner.description                           // string
learner.type                                  // 'text' | 'list'
learner.focus                                 // string | undefined
learner.origin                                // 'prompt' | 'developer' | 'emergent'
```

### Learn Output

`learn()` returns a discriminated union:

```typescript
const result = await learner.learn(data)

switch (result.status) {
  case 'observed':
    // Observations buffered, threshold not met yet
    console.log(`Buffered ${result.output.length} observations`)
    break

  case 'synthesized':
    // Understanding updated
    console.log(`Significance: ${result.significance}`) // routine | notable | critical
    console.log(`What changed: ${result.evolution}`)
    break

  case 'observe:dismissed':
    // Data not relevant to this learner
    console.log(`Gaps: ${result.gaps}`)
    break

  case 'observe:error':
  case 'synthesize:dismissed':
  case 'synthesize:error':
    // Error or LLM chose not to update
    break
}
```

---

## Configuration

### BrainConfig

```typescript
interface BrainConfig {
  prompt: string                            // What to track and learn
  model: LanguageModel                      // Default model for all operations
  blueprintModel?: LanguageModel            // Schema/config generation (falls back to model)
  autoSetup?: boolean                       // LLM decomposition on init (default: true)
  learners?: GeneratedLearnerConfig[]       // Explicit learner definitions
  store?: BrainStore                        // Brain persistence (default: MemoryBrainStore)

  init?: { model?: LanguageModel }          // Decomposition model
  query?: { model?: LanguageModel }         // ask() synthesis model
  ingest?: { batchSize?: number }           // Items per batch (default: 20)

  learning?: {
    store?: (id: string) => Store           // Per-learner store factory
    observer?: {
      model?: LanguageModel                 // Observe phase model
      blueprintModel?: LanguageModel        // Observer prompt generation model
    }
    understand?: {
      model?: LanguageModel                 // Understand phase model
      blueprintModel?: LanguageModel        // Understand prompt generation model
      thresholds?: {
        maxObservations?: number            // default: 10
        maxTokens?: number                  // default: 8000
        minImportance?: number              // default: 0.5
      }
    }
    query?: { model?: LanguageModel }       // Per-learner query model
    governance?: {
      strategy?: 'continuous' | 'cumulative' | 'decay'  // default: 'cumulative'
      maxTokens?: number                    // default: 16000
    }
  }

  evolution?: {
    enabled?: boolean                       // default: true
    evaluatorSignalThreshold?: number       // Signals before auto-eval (default: 5)
    autoEvaluate?: boolean                  // Auto-trigger on threshold (default: true)
    coverageGap?: {
      relevanceThreshold?: number           // Below this = "not relevant" (default: 0.3)
      gapCountThreshold?: number            // Gaps before signaling (default: 5)
      windowSize?: number                   // Rolling window (default: 20)
    }
  }

  internalLearners?: {
    globalInjectionUnderstanding?: boolean | Partial<LearningConfig>
    globalQueryUnderstanding?: boolean | Partial<LearningConfig>
    injectionGaps?: boolean | Partial<LearningConfig>
    queryGaps?: boolean | Partial<LearningConfig>
  }

  dismissedBatchBuffer?: {
    maxSize?: number                        // default: 100
  }
}
```

### Model Cascade

Models flow from Brain → Learner → Phase. Each level falls back to its parent:

```text
brain.model (default for everything)
├── brain.blueprintModel (schema/prompt generation, falls back to model)
├── brain.init.model (decomposition, falls back to blueprintModel)
├── brain.query.model (ask synthesis, falls back to model)
└── learning.* (applied to all learners):
    ├── learning.observer.model → observe phase
    ├── learning.observer.blueprintModel → observer prompt generation
    ├── learning.understand.model → understand phase
    ├── learning.understand.blueprintModel → understand prompt generation
    └── learning.query.model → per-learner query
```

**Cost-optimized setup** — fast model for high-volume observation, smart model for synthesis:

```typescript
import { openai } from '@ai-sdk/openai'

const fast = openai('gpt-4o-mini')
const smart = openai('gpt-4o')

const brain = new Brain({
  prompt: '...',
  model: fast,                      // Default: cheap model
  blueprintModel: smart,            // Schema generation: smart model
  init: { model: smart },           // Decomposition: smart model
  query: { model: smart },          // ask() synthesis: smart model
  learning: {
    observer: { model: fast },      // Observation: cheap model (high volume)
    understand: { model: smart },   // Synthesis: smart model (critical)
    query: { model: smart },        // Per-learner query: smart model
  },
})
```

**Using different providers:**

```typescript
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Direct providers
new Brain({ model: openai('gpt-4o'), ... })
new Brain({ model: anthropic('claude-sonnet-4-20250514'), ... })
new Brain({ model: google('gemini-2.0-flash'), ... })

// OpenRouter (multi-provider gateway)
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
new Brain({ model: openrouter('google/gemini-2.0-flash-001'), ... })
```

Any `LanguageModel` from any `@ai-sdk/*` provider works. See [Vercel AI SDK providers](https://sdk.vercel.ai/providers) for the full list.

### Understand Thresholds

Three settings control when synthesis triggers:

| Threshold | Default | Effect |
|---|---|---|
| `maxObservations` | 10 | Trigger synthesis after N buffered observations |
| `maxTokens` | 8000 | Trigger synthesis when buffered tokens exceed this |
| `minImportance` | 0.5 | Observations below this importance (0–1) are discarded |

Synthesis triggers when **either** `maxObservations` or `maxTokens` is exceeded.

**Tuning guidance:**

- **Small `maxObservations` (3–5):** Frequent synthesis, fresher understanding, more LLM calls, higher cost.
- **Large `maxObservations` (20–50):** Less frequent synthesis, better batching, understanding stays stale longer.
- **Low `minImportance` (0.1–0.3):** Buffer almost everything — noisy but comprehensive.
- **High `minImportance` (0.7–0.9):** Only buffer highly significant data — clean but may miss subtle patterns.

### Governance

**TextLearner governance** controls how understanding grows over time:

- **`continuous`** — Understanding grows indefinitely. No compression. Use for low-volume domains where you want full detail. No token limit enforced.

- **`cumulative`** (default) — Understanding grows until `maxTokens`, then LLM compresses it to a ~500-token seed summary. The seed becomes the foundation for the next cycle. Use for bounded learning with periodic consolidation.

- **`decay`** — Understanding is organized into temporal sections (Current State / Recent Developments / Historical Context). When `maxTokens` is approached, older content is progressively compressed while recent stays detailed. Use for evolving knowledge where recency matters.

**ListLearner governance** is mechanical post-processing after each synthesis:

- **`deduplication: 'strict'`** (default) — Items with identical data are merged. Merges `touchCount` from both, keeps max confidence, combines signals, preserves earliest `firstSeen`.
- **`maxItems: 200`** (default) — Hard cap on collection size.
- **`pruning: 'oldest'`** (default) — When over limit, remove oldest items first. Also: `'least-confident'` or `'none'`.

---

## Stores

Brain has two independent storage layers:

| Layer | Interface | Purpose |
|---|---|---|
| **Brain Store** | `BrainStore` | Brain state, learner registry, evolution history, dismissed batches |
| **Learner Store** | `Store` | Per-learner observations, understanding, evolution, state |

### Memory Stores (default)

```typescript
import { Brain, MemoryBrainStore, MemoryStore } from '@unbody/brain'

const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new MemoryBrainStore(),
  learning: {
    store: () => new MemoryStore(),
  },
})
```

Ephemeral — data lost on process exit. Good for development and testing.

### SQLite Stores

```typescript
import { SQLiteBrainStore } from '@unbody/brain/brain/stores'
import { SQLiteStore } from '@unbody/brain/learners/stores'

const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./data/brain.db'),
  learning: {
    store: (learnerId) => new SQLiteStore(`./data/learner-${learnerId}.db`),
  },
})
```

Persistent via `better-sqlite3`. Restarting and calling `initialize()` with the same paths restores all state — learners, understanding, evolution history. No LLM calls on restore.

### Custom Stores

Implement the `Store` interface (4 namespaces: `observations`, `understanding`, `evolution`, `state`) and `BrainStore` interface (5 namespaces: `state`, `learners`, `internalLearners`, `evolution`, `dismissedBatches`) to use any backend.

---

## Evolution

Brain adapts its learner structure through signals and an LLM evaluator.

### Signal Flow

```text
Signal Sources                  Evaluator              Orchestrator
─────────────────              ─────────              ────────────
Learner health signals    ───►  Buffer signals    ───►  Execute decisions
Coverage gaps             ───►  (threshold: 5)    ───►  create / merge /
Developer signals         ───►  LLM evaluates     ───►  split / update /
System events             ───►  with tools        ───►  delete learners
```

**Signal sources:**

- **Automatic** — Learners emit signals on: high dismissal rate (>80%), low query relevance (avg < 0.3), low confidence (avg < 0.3), observation stagnation.
- **Coverage gaps** — Queries where all learners score low relevance. Also: injection batches dismissed by all learners.
- **Developer** — `brain.signal({ source, description })` with custom signals from your application.

### Evolution Config

```typescript
evolution: {
  enabled: true,                    // Master switch (default: true)
  evaluatorSignalThreshold: 5,      // Signals before auto-evaluation (default: 5)
  autoEvaluate: true,               // Auto-trigger on threshold (default: true)
  coverageGap: {
    relevanceThreshold: 0.3,        // Below this = "not relevant" (default: 0.3)
    gapCountThreshold: 5,           // Gaps before signaling (default: 5)
    windowSize: 20,                 // Rolling window (default: 20)
  },
}
```

### Manual Control

```typescript
// Inject custom signal
brain.signal({
  source: 'analytics',
  description: 'Users asking about deployment patterns but no learner covers it',
})

// Force immediate evaluation (bypass threshold)
brain.signal({
  source: 'admin',
  description: 'Restructure learners for new product direction',
  bypass: true,
})

// Manually trigger evaluation
const { decisions } = await brain.evaluateEvolution()

// Dry run — see what the evaluator would decide without executing
const { decisions: preview } = await brain.evaluateEvolution({ dryRun: true })
```

The evaluator has tools to inspect learners, query them, consult internal learners, review dismissed data, and review past decisions before making choices.

---

## Events

### Subscribing

```typescript
// Specific event (typed)
brain.on('learner:synthesized', (payload) => {
  console.log(`${payload.learnerId}: ${payload.significance} — ${payload.evolution}`)
})

// All events
brain.on((event) => {
  console.log(`[${event.type}] ${event.id} at ${event.timestamp}`)
})
```

Learner events are automatically forwarded through Brain — subscribe on Brain, not individual learners.

### Event Reference

| Phase | Events | Key payload fields |
|---|---|---|
| **Init** | `brain:init:started`, `brain:init:config:generated`, `brain:init:completed` | `configs[]`, `learnerIds[]` |
| **Inject** | `brain:inject:started`, `brain:inject:batch:completed`, `brain:inject:completed` | `injectId`, `itemCount`, `batchCount`, `results[]` |
| **Observe** | `learner:observe:started`, `learner:observed`, `learner:observe:dismissed` | `learnerId`, `output[]`, `importance`, `bufferCount` |
| **Synthesize** | `learner:synthesize:started`, `learner:synthesized` | `learnerId`, `newUnderstanding`, `significance`, `evolution` |
| **Query** | `learner:query:started`, `learner:query:completed` | `learnerId`, `insight`, `relevance`, `confidence`, `gaps[]` |
| **Ask** | `brain:ask:started`, `brain:ask:completed` | `queryId`, `insight`, `sources[]`, `gaps[]` |
| **Health** | `learner:health:updated`, `learner:signal` | `activation`, `status`, `metrics` |
| **Evolution** | `evaluator:evaluation:completed`, `evolution:action:executed` | `decisions[]`, `action`, `targets[]`, `result` |
| **Config** | `brain:config:updated`, `learner:config:updated` | `changedFields[]` |
| **Learner Mgmt** | `brain:learner:added`, `brain:learner:removed` | `learnerId`, `name` |

---

## Writing Instructions

Instructions are the single most important input to a learner. They determine everything downstream:

```text
Instructions → Observer identity (what data is relevant?)
            → Schema generation (ListLearner: what fields exist?)
            → Understand identity (how to synthesize?)
            → Query behavior (how to answer questions?)
```

A learner with vague instructions produces vague understanding. A learner with specific instructions produces grounded, evidence-backed knowledge.

### Brain Prompt

The brain prompt seeds LLM decomposition — it determines what learners are created and what they track.

**Good prompts** are specific about the domain and what matters:

```text
Track my coding patterns across git commits, code reviews, and technical
discussions. I want to understand my evolving development philosophy,
preferred tools, and antipatterns I avoid.
```

**Bad prompts** are vague:

```text
Be a good brain that learns stuff.
```

### Learner Instructions

Lead with the questions the learner should be able to answer. These root questions orient everything — what the observer filters for, how the synthesizer reasons, and what the query layer prioritizes.

```text
Track product design principles and user research insights.

Track answers to:
- What are the team's core design principles?
- How do user needs inform design choices?
- Where do design principles conflict with each other?

Watch for:
- Design decisions and their rationale
- User testing results and behavioral patterns
- Accessibility considerations and standards applied
```

The "Track answers to" section is the most important part. It gives the learner a purpose beyond collecting data.

### Instructions for TextLearner

TextLearner instructions shape how cognitive skills are applied to your domain. The learner automatically detects confirmation, contradiction, recurrence, intensification, avoidance, etc. — your instructions determine *what* it applies these skills to.

**Ask for specifics if you want them.** The synthesizer defaults to abstract patterns ("frequent behavior") unless instructions push for grounding:

```text
// Vague — produces "Alex exercises sometimes"
Track Alex's daily habits.

// Specific — produces "Alex cancelled gym 6 times with excuses,
// rescheduled dentist 4 times, dodged promotion conversation at 4 separate 1:1s"
Track Alex's behavioral patterns across daily activities.

Track answers to:
- What does Alex consistently avoid, and how? (approximate counts, timeframes)
- What topics recur most frequently? How many times, over what period?
- Where do stated intentions contradict actual behavior?
```

The difference is that specific instructions trigger the dynamics skills (recurs, avoids, shifts) to gather evidence — counts, timeframes, concrete instances — rather than just labeling patterns.

### Instructions for ListLearner

ListLearner instructions directly control schema generation. **The fields in your schema come from what you describe in instructions.** This has practical consequences:

**Name the fields you want.** If you say "track cuisine type, location, and price range," the schema will have those fields. If you don't mention a field, it won't exist.

```text
// Missing status field — if a PM rejects a feature, there's nowhere to record it
Track feature requests with name, description, and customer segment.

// Has status field — deprioritization data is captured
Track feature requests for a SaaS product. Each item is a distinct feature request.

For each feature request, track:
- The feature name and description
- Which customer segments are asking (enterprise, SMB, startup)
- Whether it's been deprioritized or rejected by the PM
```

**Describe what each item IS.** "Each item is a distinct feature request" is better than "Track features" — it tells the synthesizer the granularity you expect, which affects deduplication behavior.

**Don't ask the LLM to count.** If your instructions say "track how many sources requested this," the LLM will manage a `request_count` field — but it drifts over time (LLMs are bad at arithmetic across batches). Use `metadata.touchCount` instead, which is mechanically accurate. It increments every time an observation references an item.

### Specificity and Signal-to-Noise

Instructions control how much data the observer lets through:

- **Narrow instructions** → observer dismisses most data → high precision, may miss related patterns
- **Broad instructions** → observer accepts most data → comprehensive but noisy, more synthesis needed

This is a design choice, not a quality issue. A learner tracking "React performance antipatterns" will be precise but miss general coding philosophy. A learner tracking "coding patterns" will be comprehensive but need more synthesis cycles to find structure.

### Learner Granularity

**Few broad learners vs many narrow ones?**

Start with 3–7 learners covering broad domains. Let evolution split them as data arrives. Reasons:

- Each learner makes independent LLM calls during observe, understand, and query. More learners = linear cost increase per inject/ask.
- Evolution is designed for this — it detects when a learner is overloaded (high dismissal, low confidence) and splits it.
- Narrow learners miss cross-cutting patterns. A "React hooks" learner won't notice your general preference for functional patterns.

**When to go narrow:** If you know your domains upfront and they're distinct (e.g., "recipes" vs "workout tracking" vs "journal entries"), define explicit learners. If domains emerge from usage, let `autoSetup: true` and evolution handle it.

**Practical limits:** Brain processes all learners in parallel per inject/ask call. 10–20 learners is comfortable. 50+ will work but increases latency and cost proportionally. The bottleneck is LLM calls, not Brain itself.

### Adjust Directives

Natural language steering for `adjustLearner()` / `learner.adjust()`:

```typescript
// Expand scope
await brain.adjustLearner('design', 'Also track accessibility patterns')

// Narrow scope
await brain.adjustLearner('tech', 'Focus only on React, stop tracking Vue')

// Change behavior
await brain.adjustLearner('patterns', 'Be stricter about what counts as a distinct pattern')

// Shift emphasis
await brain.adjustLearner('trends', 'Weight recent observations more heavily')
```

The LLM sees the learner's current instructions and identity, then evolves them incrementally. If the directive is ambiguous, it preserves more rather than less.

---

## Recipes

### Proactive Insights

```typescript
brain.on('learner:synthesized', async (payload) => {
  if (payload.significance === 'critical' || payload.significance === 'notable') {
    const insight = await brain.ask('What new patterns or tensions have emerged?')
    if (insight.sources.some(s => s.confidence > 0.7)) {
      notifyUser(insight)
    }
  }
})
```

### Quality Gating

```typescript
const result = await brain.ask(query)

const strong = result.sources.filter(s => s.confidence > 0.6 && s.relevance > 0.5)
if (strong.length === 0) return null // Silence — nothing worth surfacing

return { insight: result.insight, gaps: result.gaps }
```

### Cross-Domain Connections

```typescript
const result = await brain.ask('What connects my interest in calm tech with my wedding planning?')
// Synthesis LLM sees all learner responses and finds bridges
```

### User-Steerable Taxonomy

```typescript
await brain.mergeLearners(['eink', 'paper-displays'], 'Combine under hardware')
await brain.splitLearner('ai-learner', 'Separate into AI tools vs AI research')
await brain.adjustLearner('categories', 'Stop categorizing things as inspiration')
```

### Persistence Across Sessions

```typescript
// Session 1: create and learn
const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: { store: (id) => new SQLiteStore(`./learner-${id}.db`) },
})
await brain.initialize()
await brain.inject(data)

// Session 2: restore and continue
const brain2 = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: { store: (id) => new SQLiteStore(`./learner-${id}.db`) },
})
await brain2.initialize() // Restores from SQLite — no LLM calls
await brain2.ask('What do you know?') // Has full knowledge from session 1
```

---

## API Reference

### Brain API

**Lifecycle:**

| Method | Returns | Description |
|---|---|---|
| `initialize()` | `Promise<void>` | Init brain (auto-called on first inject/ask) |
| `dispose()` | `Promise<void>` | Clean up all learners and stores |

**Data:**

| Method | Returns | Description |
|---|---|---|
| `inject(data, options?)` | `Promise<BrainInjectResult>` | Route data to all learners |
| `ask(query, options?)` | `Promise<BrainAskResult>` | Query all learners, synthesize response |
| `askStream(query, options?)` | `Promise<StreamTextResult>` | Streaming variant of `ask()` |
| `consult(query, options?)` | `Promise<ConsultResult>` | Query internal learners |
| `inspect(query, options?)` | `Promise<InspectResult>` | Agentic read-only introspection of brain structure and knowledge |

**Learner Management:**

| Method | Returns | Description |
|---|---|---|
| `addLearner(config)` | `Promise<BaseLearner>` | Add learner with explicit config |
| `removeLearner(id)` | `Promise<void>` | Remove learner and dispose store |
| `adjustLearner(id, directive)` | `Promise<{ learner, result: AdjustResult }>` | Natural language steering (preserves knowledge) |
| `getLearner(id)` | `BaseLearner \| undefined` | Get learner by ID |
| `getLearners()` | `BaseLearner[]` | Get all external learners |

**Evolution** (requires `evolution.enabled`):

| Method | Returns | Description |
|---|---|---|
| `createLearner(guidance)` | `Promise<BaseLearner>` | Create learner from natural language |
| `deleteLearner(id)` | `Promise<void>` | Delete learner via evolution |
| `mergeLearners(ids, guidance)` | `Promise<BaseLearner>` | Merge 2+ learners into one |
| `splitLearner(id, guidance)` | `Promise<BaseLearner[]>` | Split learner into multiple |
| `updateLearner(id, guidance)` | `Promise<BaseLearner>` | LLM-driven config update |
| `evaluateEvolution(options?)` | `Promise<{ decisions, results }>` | Trigger evolution evaluation |
| `evaluateEvolutionStream(options?)` | `Promise<{ stream, decisions }>` | Streaming variant of `evaluateEvolution()` |

**Signals & Config:**

| Method | Returns | Description |
|---|---|---|
| `signal({ source, description, bypass? })` | `void` | Inject signal for evolution |
| `update(updates)` | `Promise<BrainUpdateResult>` | Update brain config |
| `on(type, handler)` | `this` | Subscribe to specific event |
| `on(handler)` | `this` | Subscribe to all events |

**Accessors:**

| Property | Type | Description |
|---|---|---|
| `prompt` | `string` | Brain's purpose prompt |
| `config` | `ResolvedBrainConfig` | Current resolved config |
| `store` | `BrainStore` | Persistence layer |

### Learner API

**Learning:**

| Method | Returns | Description |
|---|---|---|
| `learn(batch, options?)` | `Promise<LearnOutput>` | Process data (observe → understand) |
| `query(question, options?)` | `Promise<QueryResult>` | Query learner knowledge |
| `queryStream(question, options?)` | `Promise<StreamTextResult>` | Streaming variant of `query()` |
| `getBufferState()` | `Promise<{ count, tokens }>` | Pending observations |

**Understanding:**

| Method | Returns | Description |
|---|---|---|
| `getUnderstanding()` | `Promise<T>` | Current knowledge (`string` or `ListItem[]`) |
| `setUnderstanding(value)` | `Promise<void>` | Set knowledge directly |
| `getSummary()` | `Promise<string>` | Prose summary |
| `hasKnowledge()` | `Promise<boolean>` | Has any understanding |

**Introspection:**

| Method | Returns | Description |
|---|---|---|
| `getHealth()` | `LearnerHealth` | Activation, status, signal thresholds |
| `getMetrics()` | `LearnerMetrics` | Dismissal rate, avg relevance, avg confidence |
| `getEvolution()` | `Promise<EvolutionRecord[]>` | Evolution history |
| `getObservationSchema()` | `Record \| null` | JSON Schema for observations |
| `getUnderstandingSchema()` | `Record \| null` | JSON Schema for understanding |
| `getGovernance()` | `GovernanceConfig` | Current governance settings |

**Config:**

| Method | Returns | Description |
|---|---|---|
| `update(updates)` | `Promise<{ changedFields }>` | Replace config, regenerate prompts |
| `adjust(directive)` | `Promise<{ changedFields }>` | Incremental LLM-driven adjustment |

**Identity:** `id`, `name`, `instructions`, `description`, `type`, `focus`, `origin`

---

## Limitations

- **Scale**: Each `inject()` makes one LLM call per learner per batch. Each `ask()` makes one LLM call per learner + one synthesis call. Cost and latency scale linearly with learner count. Thousands of inject events are fine; the bottleneck is LLM calls, not storage or Brain itself. ListLearner collections work well up to `maxItems` (default: 200); TextLearner understanding is bounded by `governance.maxTokens`.
- **Learner types**: TextLearner and ListLearner only. No built-in temporal, graph, or vector primitives — temporal reasoning depends on the LLM interpreting timestamps in your data and instructions.
- **Runtime**: SQLite store uses `better-sqlite3` (Node.js native addon).
- **LLM dependency**: Requires Vercel AI SDK v4+ and a compatible provider.

## License

MIT

---

*An [Unbody](https://unbody.io) project.*
