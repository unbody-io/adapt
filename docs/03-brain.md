# Brain

## Creating a Brain

Only `prompt` and `model` are required:

```typescript
import { Brain } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track user coding patterns and development philosophy.',
  model: openai('gpt-4o'),
})
```

Everything else has sensible defaults — auto-decomposition is on, memory stores are used, evolution is enabled. Customize as needed:

```typescript
import { Brain } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'

const brain = new Brain({
  prompt: 'Track user coding patterns and development philosophy.',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: {
    store: (id) => new SQLiteNeuronStore(`./neuron-${id}.db`),
    understand: { thresholds: { maxObservations: 5 } },
  },
  evolution: { enabled: true },
})
```

See [Configuration](./05-configuration.md) for the full config reference.

`initialize()` is called automatically on first `inject()` or `ask()`. Call it explicitly if you want to control timing:

```typescript
await brain.initialize()
```

On init, Brain tries to restore from the store first (no LLM call). If no state exists, it runs fresh LLM decomposition.

## Injecting Data

```typescript
// Array or single item — anything serializable
await brain.inject([
  { type: 'note', text: 'Users prefer dark mode' },
  { type: 'commit', message: 'refactor: move to composition API' },
])

// With custom ID
await brain.inject(data, { id: 'session-42' })
```

Data is sent to **all** neurons in parallel. Each neuron's observer independently decides what's relevant. Items are batched by `ingest.batchSize` (default: 20).

When all neurons dismiss a batch, it enters the dismissed batch buffer and feeds the internal gap neuron.

### What observers see

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
    savedAt: '2025-03-01T10:30:00Z',
  },
])

// Bad — opaque, no context for the observer to reason about
await brain.inject(['https://example.com/local-first'])
```

The observer does **not** see the neuron's current understanding when filtering — it only uses its generated identity (derived from `instructions`) to decide relevance. This is intentional: observation is fast and stateless.

**Timestamps matter.** If your use case involves temporal patterns, include timestamps in the data. The observer and synthesizer will see them and can reason about time if the neuron's instructions ask for it.

## Querying

```typescript
const result = await brain.ask('What patterns do you see?')

result.insight    // Synthesized answer from all neurons
result.sources    // [{ neuronId, relevance, confidence, insight }]
result.gaps       // Knowledge gaps across all neurons
```

Two query modes:

- **`direct`** (default) — All neurons queried in parallel (single LLM call each), then one synthesis call. Fast.
- **`deep`** — Agentic synthesis where the LLM decides which neurons to consult, what to ask, and when it has enough. Slower but can do follow-up queries. Internal neurons available as consult tools.

```typescript
// Default — fast, parallel
const result = await brain.ask('What patterns do you see?')

// Agentic — multi-step, selective
const deep = await brain.ask('What patterns do you see?', { mode: 'deep' })

// Override model per-call
const result = await brain.ask('...', { model: openai('gpt-4o') })
```

## Streaming

All query and evaluation methods have streaming variants that return raw AI SDK `StreamTextResult` objects.

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

## Consulting Internal Neurons

Brain maintains internal neurons that track meta-knowledge:

| Internal Neuron | Type | Tracks |
|---|---|---|
| Global Understanding | text | Cross-domain patterns from all neuron knowledge |
| Global Query Understanding | list | Query topics, frequency, clusters |
| Injection Gaps | text | Data no neuron could process |
| Query Gaps | text | Questions no neuron could answer well |

Query them via `consult()`:

```typescript
const meta = await brain.consult('What cross-domain patterns have emerged?')

// Target a specific internal neuron
const gaps = await brain.consult('What knowledge gaps exist?', {
  neuron: '__internal_injection_gaps',
})
```

All internal neurons are enabled by default. Toggle them:

```typescript
const brain = new Brain({
  // ...
  internalNeurons: {
    globalUnderstanding: true,                    // enabled (default)
    globalQueryUnderstanding: false,              // disabled
    injectionGaps: { governance: { maxTokens: 4000 } }, // enabled with overrides
    queryGaps: true,
  },
})
```

## Inspecting the Brain

`inspect()` is an agentic read-only method that answers questions about the brain's structure and knowledge. An LLM agent browses neuron metadata, reads understanding summaries, and consults internal neurons to build its answer.

```typescript
// What is the brain set up to track? (works even before any data is injected)
const result = await brain.inspect('What are you learning and tracking?')
console.log(result.insight)

// Deeper questions about accumulated knowledge
const health = await brain.inspect('Which neurons have the most gaps?')
```

Unlike `ask()` (which queries neuron knowledge) or `consult()` (which queries internal self-knowledge), `inspect()` can reason across both — and works on a fresh brain by falling back to neuron configs when no understanding exists yet.

## Managing Neurons

**Basic management** — works without evolution:

```typescript
// Add with explicit config
const neuron = await brain.addNeuron({
  id: 'ui-patterns',
  type: 'text',
  name: 'UI Patterns',
  description: 'Tracks UI/UX design patterns',
  instructions: 'Track user interface patterns, component choices, and design decisions.',
})

// Adjust with natural language — incremental, preserves knowledge
await brain.adjustNeuron('ui-patterns', 'Focus more on accessibility patterns')

// Remove
await brain.removeNeuron('ui-patterns')

// Inspect
brain.getNeurons()              // all external neurons
brain.getNeuron('ui-patterns')  // specific neuron
```

**Evolution management** — requires `evolution.enabled` (default: true):

```typescript
// LLM designs the neuron from guidance
const neuron = await brain.createNeuron('Track emerging frontend frameworks')

// Merge overlapping neurons
const merged = await brain.mergeNeurons(
  ['react-neuron', 'vue-neuron'],
  'Combine into unified frontend framework tracker'
)

// Split overloaded neuron
const parts = await brain.splitNeuron(
  'broad-neuron',
  'Separate into technical patterns vs team dynamics'
)

// LLM-driven update
await brain.updateNeuron('neuron-x', 'Narrow scope to React hooks only')

// Delete via evolution
await brain.deleteNeuron('neuron-y')
```

## Update vs Adjust

These are different operations:

**`brain.adjustNeuron(id, directive)`** — Natural language steering. The LLM sees the neuron's current state and evolves it incrementally. Preserves all existing observations and understanding. Think "steering."

```typescript
await brain.adjustNeuron('topics', 'Be stricter about what counts as a distinct topic')
await brain.adjustNeuron('patterns', 'Also track testing patterns going forward')
```

**`brain.update(config)`** — Config replacement. Mechanical fields cascade to all neurons immediately. Semantic fields (prompt, instructions) go through the evaluator. Three phases: brain-only state → mechanical cascade → signal-driven semantic.

```typescript
// Mechanical: cascades immediately to all neurons
await brain.update({
  learning: { understand: { thresholds: { maxObservations: 20 } } },
})

// Semantic: triggers evolution evaluation
await brain.update({ prompt: 'Track design systems instead of coding patterns.' })
```

**Standalone neuron equivalents:**

```typescript
// adjust() — incremental, LLM sees current state
await neuron.adjust('Also track performance metrics')

// update() — replace config, regenerate from scratch
await neuron.update({
  instructions: 'Track only React performance patterns.',
  understand: { thresholds: { maxObservations: 5 } },
})
```
