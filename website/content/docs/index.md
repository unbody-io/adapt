---
title: Getting Started
description: Install Adapt and build your first Brain in under 5 minutes.
---

Adapt is a TypeScript library for building AI systems that learn and evolve from data. This guide walks you through installation and building your first Brain in under 5 minutes.

## Install

```bash
npm install @unbody-io/adapt
```

Adapt connects to LLMs through [Vercel AI SDK](https://sdk.vercel.ai) providers. Install the one that matches your LLM service — for example, `@ai-sdk/openai` for OpenAI or `@ai-sdk/anthropic` for Claude:

```bash
npm install @ai-sdk/openai
```

See [Configuration — Using Different Providers](./configuration#using-different-providers) for the full list of supported providers.

## Quick Start

### Brain

A Brain takes a prompt describing what to learn, automatically creates specialized neurons to cover different aspects of that domain, and coordinates them. You feed it data, it routes to all neurons, and when you ask a question it synthesizes answers from all of them.

```typescript
import { Brain } from '@unbody-io/adapt'
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

If you don't need multi-domain orchestration, neurons work independently without a Brain. You get direct control over a single learning domain:

```typescript
import { TextNeuron, MemoryNeuronStore } from '@unbody-io/adapt'
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

By default, Brain uses the LLM to decompose your prompt into neurons automatically. If you already know what neurons you want, you can define them explicitly:

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

By default, all state is held in memory and lost when the process exits. To persist knowledge across sessions (so a Brain can pick up where it left off), use SQLite:

```bash
npm install better-sqlite3
```

```typescript
import { Brain } from '@unbody-io/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody-io/adapt/sqlite'
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

- [Concepts](./concepts) — architecture, pipeline, neuron types
- [Brain](./brain) — full Brain API guide
- [Neurons](./neurons) — TextNeuron and ListNeuron in depth
- [Prompt Design](./prompt-design) — the most important input to a neuron
