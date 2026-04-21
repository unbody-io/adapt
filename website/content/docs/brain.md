---
title: Brain
description: Creating, configuring, and querying a Brain.
---

A Brain is the top-level orchestrator — it takes a prompt describing what to learn, decomposes it into specialized neurons, and coordinates them through data ingestion, querying, and evolution.

## Creating a Brain

Only two things are required — `prompt` (what to learn about) and `model` (which LLM to use):

```typescript
import { Brain } from '@unbody-io/adapt'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track user coding patterns and development philosophy.',
  model: openai('gpt-4o'),
})
```

With just these two fields, the Brain will auto-decompose the prompt into neurons, store everything in memory, and enable evolution — all with sensible defaults. When you need more control, you can configure persistence, learning thresholds, and evolution behavior:

```typescript
import { Brain } from '@unbody-io/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody-io/adapt/sqlite'

const brain = new Brain({
  prompt: 'Track user coding patterns and development philosophy.',
  model: openai('gpt-4o'),
  // Persist state to disk (default: in-memory, lost on exit)
  store: new SQLiteBrainStore('./brain.db'),
  learning: {
    // Each neuron gets its own SQLite store
    store: (id) => new SQLiteNeuronStore(`./neuron-${id}.db`),
    // Synthesize understanding after every 5 observations instead of the default 10
    understand: { thresholds: { maxObservations: 5 } },
  },
  // Evolution is on by default — shown here for clarity
  evolution: { enabled: true },
})
```

For Bun, import the same store classes from `@unbody-io/adapt/sqlite/bun` instead of `@unbody-io/adapt/sqlite`.

See [Configuration](./configuration) for the full config reference.

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

Data is sent to **all** neurons in parallel. Each neuron independently decides what's relevant to its domain and ignores the rest (this is the "observe" phase from the [learning pipeline](./concepts#learning-pipeline)). Items are batched by `ingest.batchSize` (default: 20).

When *every* neuron dismisses a batch — meaning nothing in the batch was relevant to any neuron — it gets tracked as a coverage gap. These gaps feed into the [evolution system](./evolution), helping the Brain detect domains it's not yet equipped to handle.

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

The observer does **not** see the neuron's accumulated knowledge when filtering — it only uses the neuron's identity (derived from `instructions`) to decide relevance. This is intentional: it keeps observation fast and stateless, but it also means the observer can't filter based on "I already know this." That trade-off is handled downstream during synthesis, where the neuron integrates new observations with existing knowledge.

**Timestamps matter.** If your use case involves temporal patterns, include timestamps in the data. The observer and synthesizer will see them and can reason about time if the neuron's instructions ask for it.

## Querying

```typescript
const result = await brain.ask('What patterns do you see?')

result.insight    // Synthesized answer from all neurons
result.sources    // [{ neuronId, relevance, confidence, insight }]
result.gaps       // Knowledge gaps across all neurons
```

Two query modes:

- **`direct`** (default) — All neurons are queried in parallel (one LLM call each), then a single synthesis call combines their answers. Fast and predictable.
- **`deep`** — An LLM agent drives the query interactively. It decides which neurons to consult, what to ask each one, and whether to ask follow-up questions based on what it learns. It can also consult [internal neurons](#consulting-internal-neurons) (gap tracking, cross-domain patterns) to build a more complete answer. Slower, but better for complex questions that benefit from multi-step reasoning.

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

Beyond the neurons that learn from your data, Brain maintains **internal neurons** that track how the system itself is performing. This gives you (and the evolution system) visibility into coverage gaps, query patterns, and cross-domain connections.

| Internal Neuron | Type | What it tracks | When to consult it |
|---|---|---|---|
| Global Understanding | text | Cross-domain patterns from all neuron knowledge | "What themes connect my different domains?" |
| Global Query Understanding | list | Query topics, frequency, clusters | "What are users asking about most?" |
| Injection Gaps | text | Data no neuron could process | "What data am I not capturing?" |
| Query Gaps | text | Questions no neuron could answer well | "Where are my blind spots?" |

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

There are two ways to manage neurons: **basic management** (you provide explicit configs) and **evolution management** (the LLM designs neurons from natural language guidance). Basic management is always available. Evolution management requires `evolution.enabled` (on by default).

**Basic management** — you specify exactly what to create or change:

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

**Evolution management** — the LLM designs neurons from natural language guidance. Use this when you know *what* you want but want the system to figure out the specifics (name, instructions, type, schema):

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

**`brain.update(config)`** — Config replacement. Changes to mechanical fields (like models, thresholds, governance) take effect immediately across all neurons. Changes to semantic fields (like `prompt`) trigger an evolution evaluation, because changing the Brain's purpose may require restructuring its neurons.

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
