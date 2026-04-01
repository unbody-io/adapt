# Getting Started

## Install

```bash
npm install @unbody/adapt
```

Adapt uses the [Vercel AI SDK](https://sdk.vercel.ai) for LLM access. Install a provider:

```bash
npm install @ai-sdk/openai    # or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Brain

Brain auto-decomposes a prompt into specialized neurons, routes data to all of them, and synthesizes unified answers.

```typescript
import { Brain } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track my coding patterns and development philosophy.',
  model: openai('gpt-4o'),
})

await brain.inject([
  { type: 'commit', message: 'refactor: extract validation into pure functions' },
  { type: 'review', comment: 'Too heavy — factory functions work fine for our scale.' },
])

const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)
```

### Standalone Neuron

Neurons work independently without a Brain — direct control over a single domain:

```typescript
import { TextNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = new TextNeuron({
  model: openai('gpt-4o'),
  instructions: 'Track product design principles and philosophy.',
  store: new MemoryNeuronStore(),
})

await neuron.learn([
  'User said: simplicity over features',
  'Team decided: no dark patterns, ever',
])

const result = await neuron.query('What are our design principles?')
console.log(result.insight)
```

### Explicit Neurons

Skip LLM decomposition and define neurons yourself:

```typescript
const brain = new Brain({
  prompt: 'Track cooking knowledge.',
  model: openai('gpt-4o'),
  autoSetup: false,
  neurons: [
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

await brain.initialize()
```

Both `autoSetup` and `neurons` can coexist — Brain will auto-generate additional neurons alongside your explicit ones.

### SQLite Persistence

By default, Adapt stores everything in memory. For persistence across sessions, use SQLite:

```bash
npm install better-sqlite3
```

```typescript
import { Brain } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track my coding patterns.',
  model: openai('gpt-4o'),
  store: new SQLiteBrainStore('./brain.db'),
  learning: {
    store: (neuronId) => new SQLiteNeuronStore(`./neuron-${neuronId}.db`),
  },
})

await brain.initialize() // Restores from SQLite if state exists — no LLM calls
```

## Next Steps

- [Concepts](./02-concepts.md) — architecture, pipeline, neuron types
- [Brain](./03-brain.md) — full Brain API guide
- [Neurons](./04-neurons.md) — TextNeuron and ListNeuron in depth
- [Writing Instructions](./09-writing-instructions.md) — the most important input to a neuron
