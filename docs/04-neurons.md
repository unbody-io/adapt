# Neurons

## TextNeuron

Builds narrative understanding — a single body of prose that evolves over time.

Only `model`, `instructions`, and `store` are required:

```typescript
import { TextNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = new TextNeuron({
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

Customize governance and thresholds as needed:

```typescript
const neuron = new TextNeuron({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and user research insights.',
  store: new MemoryNeuronStore(),
  governance: { strategy: 'decay', maxTokens: 8000 },
  understand: { thresholds: { maxObservations: 5, minImportance: 0.3 } },
})
```

### Cognitive Skills

TextNeuron uses two skill sets during synthesis to recognize patterns in observations:

| Skill Set | Skills | What they detect |
|---|---|---|
| **Compare** | `confirms`, `contradicts`, `extends`, `new` | How new observations relate to existing understanding |
| **Dynamics** | `recurs`, `intensifies`, `fades`, `shifts`, `avoids` | How patterns change over time — frequency, acceleration, decline, direction changes, avoidance |

Each skill is defined as a question the neuron asks itself when recognizing the pattern. For example, `recurs` asks "This keeps appearing — how many times? Over what timespan? In what contexts?"

Skills are automatic — you don't configure them. Your instructions influence *how* the neuron applies them to your domain.

### Governance Strategies

| Strategy | Behavior | Use when |
|---|---|---|
| `continuous` | Unbounded growth, no compression | Low volume, want full detail |
| `cumulative` | Grows until `maxTokens`, then compresses to a seed and resets | Default. Bounded learning with periodic consolidation |
| `decay` | Organizes into Current/Recent/Historical; older content compresses | Evolving knowledge where recency matters |

## ListNeuron

Maintains a structured collection with LLM-generated schemas.

Same required fields — `model`, `instructions`, `store`:

```typescript
import { ListNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = new ListNeuron({
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

The LLM generates the data schema from your instructions. For "track restaurants with cuisine, location, price range, and rating," it produces fields like `name`, `cuisine`, `location`, `priceRange`, `rating`. During synthesis, the LLM agent uses CRUD tools (`addItem`, `updateItem`, `removeItem`, `listItems`, `searchItems`, `getItem`) to manage the collection.

**Schema generation depends on your instructions.** The fields in the schema come directly from what you describe. If your instructions say "track whether it's been rejected by the PM," the schema will have a rejection field. If you don't mention it, it won't exist — and that data will be lost even if it appears in observations. See [Writing Instructions](./09-writing-instructions.md) for guidance.

### Custom Schemas

You can bypass LLM schema generation entirely by providing `observationSchema` and/or `understandingSchema` in the neuron config:

```typescript
const brain = new Brain({
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

**Confidence is mechanical, not LLM-judged.** Each time an observation references an item (via `updateItem`), its `touchCount` increments. After each synthesis, confidence is normalized: `touchCount / maxTouchCount` across all items. The most-referenced item always has confidence 1.0.

**Deduplication during synthesis:** When the LLM agent calls `addItem`, the system automatically searches existing items using full-text search. If similar items are found, the tool returns them and asks the LLM to use `updateItem` instead.

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
const stream = await neuron.queryStream('...') // StreamTextResult

// Understanding
await neuron.getUnderstanding()              // string (text) or ListItem[] (list)
await neuron.setUnderstanding(value)         // Set directly
await neuron.getSummary()                    // Prose summary
await neuron.hasKnowledge()                  // Has any understanding?

// Introspection
neuron.getHealth()                           // { activation, status, signalThresholds }
neuron.getMetrics()                          // { dismissalRate, avgRelevance, avgConfidence, ... }
await neuron.getEvolution()                  // EvolutionRecord[]
neuron.getObservationSchema()                // JSON Schema for observations
neuron.getUnderstandingSchema()              // JSON Schema for understanding
neuron.getMetadata()                         // NeuronMetadata

// Buffer
await neuron.getBufferState()               // { count, avgImportance, totalTokens }
await neuron.getBufferedObservations()       // Array<{ text, importance }>

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
neuron.origin                                // 'decomposition' | 'explicit'
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
