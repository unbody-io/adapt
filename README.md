# Adapt

A self-evolving memory layer for AI applications.

Adapt is a self-evolving memory layer for AI applications. Instead of storing and retrieving data, it continuously observes incoming information, builds understanding, and reshapes its own structure over time. It answers the questions that databases and RAG pipelines structurally can't — the ones that require paying attention as data flows in.

## Why

There are questions you can only answer if you were paying attention when the data came in. You can store everything and still miss all of this — logs don't capture it, summaries flatten it, RAG retrieves what you saved, not what you noticed.

## How It Works

Adapt routes incoming data through a **Brain** — an orchestrator that coordinates specialized **Neurons**, each focused on a different domain of knowledge.

```text
Data → Brain → Neurons (observe → understand) → Query
```

Neurons don't store raw data. They observe what's relevant, discard what isn't, and synthesize what they keep into compressed, evolving understanding. Query the Brain and it answers from what it has *learned* — not by searching what it saved.

## Features

- **Brain + Neurons** — orchestrator auto-decomposes a prompt into specialized Neurons, or use Neurons standalone
- **Self-evolving** — structure reshapes itself based on usage: creates, merges, splits, removes Neurons
- **Any LLM** — cloud or local (Ollama, LMStudio) via Vercel AI SDK
- **Pluggable stores** — in-memory or SQLite

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

```typescript
import { Brain } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const brain = new Brain({
  prompt: 'Track my coding patterns and development philosophy.',
  model: openai('gpt-4o'), // or any Vercel AI SDK provider, including local models via Ollama/LMStudio
})

await brain.inject([
  { type: 'commit', message: 'refactor: extract validation into pure functions' },
  { type: 'review', comment: 'Too heavy — factory functions work fine for our scale.' },
])

const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)

brain.signal({ source: 'user', description: 'I care most about simplicity over abstraction.' })

const updated = await brain.ask('How should I approach this new feature?')
console.log(updated.insight)
```

### Standalone Neuron

```typescript
import { TextNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { openai } from '@ai-sdk/openai'

const neuron = new TextNeuron({
  model: openai('gpt-4o'), // or any Vercel AI SDK provider, including local models via Ollama/LMStudio
  instructions: 'Track product design principles and philosophy.',
  store: new MemoryNeuronStore(),
})

await neuron.learn([
  'User said: simplicity over features',
  'Team decided: no dark patterns, ever',
])

const result = await neuron.query('What are our design principles?')
console.log(result.insight)

await neuron.adjust('Focus more on accessibility principles')

const updated = await neuron.query('What should we prioritize in the next redesign?')
console.log(updated.insight)
```

## Limitations

- **Model requirements** — Adapt requires models that support both structured output and tool calling. Without these capabilities, the pipeline will break.
- **Local models** — local model support (Ollama, LMStudio) has not been fully tested yet. It's a top priority and will be updated soon.
- **Not a database** — Adapt builds understanding, it doesn't store or retrieve raw data. Use it alongside your existing storage, not instead of it.
- **Experimental** — this is `0.0.x`. Expect breaking changes in any release.

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/unbody-io/adapt/issues). PRs are welcome.

To set up for local development:

```bash
git clone https://github.com/unbody-io/adapt.git
npm install
npm run build
```

## License

MIT — [Unbody](https://unbody.io)
