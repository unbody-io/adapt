---
title: Neurons
description: TextNeuron and ListNeuron — learning, querying, governance, and schemas.
---

API guide for `TextNeuron` and `ListNeuron`. For when to pick each, see [Concepts — Neuron Types](./concepts#neuron-types).

## TextNeuron

Only `model`, `instructions`, and `store` are required:

```typescript
import { TextNeuron, MemoryNeuronStore } from '@unbody-io/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = await TextNeuron.create({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and user research insights.',
  store: new MemoryNeuronStore(),
})

await neuron.learn([
  'User testing showed: 3-click navigation preferred over hamburger menu',
  'Design review: dark mode should be default for evening users',
])

const understanding = await neuron.getUnderstanding() // string
const result = await neuron.query('What are the key design principles?')
```

You can control how the neuron grows and when it synthesizes. **Governance** determines how understanding evolves over time (see [Governance Strategies](#governance-strategies) below). **Thresholds** control how many observations accumulate before synthesis triggers:

```typescript
const neuron = await TextNeuron.create({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and user research insights.',
  store: new MemoryNeuronStore(),
  governance: { strategy: 'decay', maxTokens: 8000 },
  understand: { thresholds: { maxObservations: 5, minImportance: 0.3 } },
})
```

To restore a previously persisted neuron from disk, use `TextNeuron.restore`:

```typescript
import { SQLiteNeuronStore } from '@unbody-io/adapt/sqlite'

// Path-string sugar (Node SQLite)
const neuron = await TextNeuron.restore('./neuron.db', { model: openai('gpt-4o') })

// Or pass an explicit NeuronStore instance
const neuron = await TextNeuron.restore(
  new SQLiteNeuronStore('./neuron.db'),
  { model: openai('gpt-4o') },
)

// Standalone neurons can carry their own id when restoring from a shared store
const neuron = await TextNeuron.restore('./neuron.db', {
  id: 'design-principles',
  model: openai('gpt-4o'),
})
```

The `model` argument rehydrates persisted model refs through the LLM plugin. See [Brain — Fresh vs Restored](./brain#fresh-vs-restored) for the full runtime semantics — it applies identically to neuron `restore`.

`ListNeuron` exposes the same `create` / `restore` shape. Constructors are private — `create` and `restore` are the only public entry points, and both fully initialize the neuron (no separate `init()` call).

### Cognitive Skills

A TextNeuron's synthesizer applies two built-in skill sets when integrating observations — automatic, not configurable. Instructions influence *what domain* the skills are applied to (see [Prompt Design](./prompt-design)).

| Skill Set | Skills | What the neuron asks itself |
|---|---|---|
| **Compare** | `confirms`, `contradicts`, `extends`, `new` | "Does this observation reinforce, challenge, add to, or introduce something new relative to what I already know?" |
| **Dynamics** | `recurs`, `intensifies`, `fades`, `shifts`, `avoids` | "Is this pattern repeating? Getting stronger? Declining? Changing direction? Being avoided?" |

These skills produce grounded output ("cancelled gym 6 times in 3 weeks") rather than vague summaries ("sometimes skips gym").

### Governance Strategies

`governance.strategy` controls what happens when accumulated understanding gets large enough to risk losing the LLM's focus during queries.

| Strategy | How it works | Good for |
|---|---|---|
| `continuous` | Understanding grows indefinitely with no compression | Low-volume domains where you want every detail preserved (e.g., design decisions) |
| `cumulative` (default) | Grows until `maxTokens`, then the LLM compresses it to a ~500-token seed summary and starts a new cycle. The seed carries forward the most important patterns | General-purpose learning — bounded size with periodic consolidation |
| `decay` | Organizes understanding into temporal sections (Current / Recent / Historical). As it grows, older content is progressively compressed while recent stays detailed | Domains where recency matters — the latest observations get the most detail |

## ListNeuron

Same required fields as TextNeuron — `model`, `instructions`, `store`:

```typescript
import { ListNeuron, MemoryNeuronStore } from '@unbody-io/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = await ListNeuron.create({
  model: openai('gpt-4o'),
  instructions: 'Track restaurants with cuisine type, location, price range, and rating.',
  store: new MemoryNeuronStore(),
})

await neuron.learn([
  'Had amazing ramen at Ichiran in Shibuya — rich tonkotsu broth, ¥1200',
  'Tried the new Italian place on 5th — mediocre pasta, overpriced',
])

const items = await neuron.getUnderstanding() // ListItem[]
```

The LLM generates the data schema from your instructions. For "track restaurants with cuisine, location, price range, and rating," it produces fields like `name`, `cuisine`, `location`, `priceRange`, `rating`.

During synthesis, the LLM works like an agent with tools: it reads the buffered observations and decides how to update the collection using `addItem`, `updateItem`, `removeItem`, and other collection management tools. For example, if an observation mentions a restaurant the neuron already tracks, the LLM calls `updateItem` to revise it rather than creating a duplicate.

**Schema generation depends on your instructions.** The fields in the schema come directly from what you describe. If your instructions say "track whether it's been rejected by the PM," the schema will have a rejection field. If you don't mention it, it won't exist — and that data will be lost even if it appears in observations. See [Prompt Design](./prompt-design) for guidance.

### Custom Schemas

You can bypass LLM schema generation entirely by providing `observationSchema` and/or `understandingSchema` in the neuron config:

```typescript
const brain = await Brain.create({
  prompt: 'Track therapy sessions.',
  model: openai('gpt-4o'),
  autoSetup: false,
  neurons: [{
    id: 'relationships',
    type: 'list',
    name: 'Relationships',
    description: 'Key people, client descriptions, shifts in perception',
    instructions: 'Track the key people in this client\'s life and how perception evolves.',
    governance: { deduplication: 'strict', maxItems: 100, pruning: 'least-confident' },
    observationSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string' },
        relationship_to_client: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['person_name', 'description'],
    },
    understandingSchema: {
      type: 'object',
      properties: {
        person_name: { type: 'string' },
        relationship_to_client: { type: 'string' },
        emotional_charge: { type: 'string', enum: ['positive', 'negative', 'ambivalent', 'neutral'] },
        role_in_client_patterns: { type: 'string' },
        perception_shift_observed: { type: 'boolean' },
      },
      required: ['person_name', 'relationship_to_client'],
    },
  }],
})
```

When provided, schemas are used as-is — no LLM call, fully deterministic. This works for both `TextNeuron` and `ListNeuron`, and for both standalone neurons and Brain-managed explicit neurons.

### Item Structure

```typescript
{
  id: string
  data: Record<string, unknown>   // Fields matching the schema
  metadata: {
    confidence: number            // 0–1, mechanical: touchCount / maxTouchCount
    touchCount: number            // How many times this item was referenced in observations
    firstSeen: string             // ISO 8601
    lastUpdated: string           // ISO 8601
    signals: string[]             // Accumulated tags
  }
}
```

**Confidence tells you how much evidence backs an item.** It's calculated mechanically, not by the LLM: each time an observation references an item (via `updateItem`), its `touchCount` increments. After each synthesis, confidence is normalized across all items as `touchCount / maxTouchCount`. The most-referenced item always has confidence 1.0. Items mentioned only once will have low confidence — this helps you distinguish well-established items from one-off mentions.

**Deduplication is automatic.** When the LLM calls `addItem` during synthesis, the system searches existing items for similar matches. If it finds any, it returns them to the LLM and suggests using `updateItem` instead — preventing the same entity from appearing multiple times.

### List Governance

| Option | Values | Default |
|---|---|---|
| `deduplication` | `'strict'` / `'none'` | `'strict'` |
| `maxItems` | number | `200` |
| `pruning` | `'oldest'` / `'least-confident'` / `'none'` | `'oldest'` |

## Common Neuron API

Both `TextNeuron` and `ListNeuron` share:

```typescript
// Learning
await neuron.learn(batch)                    // LearnOutput
await neuron.learn(batch, { forceSynthesize: true }) // Force understand phase

// Querying
const result = await neuron.query('...')     // QueryResult
const stream = await neuron.queryStream('...') // AdaptStreamResult

// Understanding
await neuron.getUnderstanding()              // string (text) or ListItem[] (list)
await neuron.setUnderstanding(value)         // Set directly
await neuron.getSummary()                    // Prose summary
await neuron.hasKnowledge()                  // Has any understanding?

// Introspection
neuron.getHealth()                           // { activation, status, signalThresholds }
neuron.getMetrics()                          // { ingestion: { dismissalRate, ... }, query: { ... } }
await neuron.getEvolution()                  // EvolutionRecord[]
neuron.getObservationSchema()                // JSON Schema for observations
neuron.getUnderstandingSchema()              // JSON Schema for understanding
neuron.getMetadata()                         // NeuronMetadata

// Buffer
await neuron.getBufferState()               // { count, avgImportance, totalTokens }
await neuron.getBufferedObservations()       // Array<{ text, importance }> — pending only, condensed

// Observations (full history, full ObservationRecord shape)
await neuron.getObservations()               // ObservationRecord[]
await neuron.getObservations({ status: 'pending' })   // filter
await neuron.getObservations({ status: 'processed' })
await neuron.setObservations(records)        // bulk replace
await neuron.updateObservation(id, patch)
await neuron.removeObservation(id)

// Config
await neuron.adjust('natural language directive')
await neuron.update({ instructions: '...' })

// Identity
neuron.id                                    // string
neuron.name                                  // string
neuron.instructions                          // string
neuron.description                           // string
neuron.type                                  // 'text' | 'list'
neuron.focus                                 // string | null
neuron.origin                                // 'prompt' | 'developer' | 'emergent'
```

### Learn Output

`learn()` returns a discriminated union:

```typescript
const result = await neuron.learn(data)

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
    // Data not relevant to this neuron
    console.log(`Gaps: ${result.gaps}`)
    break

  case 'observe:error':
  case 'synthesize:dismissed':
  case 'synthesize:error':
    // Error or LLM chose not to update
    break
}
```
