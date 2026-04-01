# Recipes

## Proactive Insights

Trigger queries when a neuron learns something significant:

```typescript
brain.on('neuron:synthesized', async (payload) => {
  if (payload.significance === 'critical' || payload.significance === 'notable') {
    const insight = await brain.ask('What new patterns or tensions have emerged?')
    if (insight.sources.some(s => s.confidence > 0.7)) {
      notifyUser(insight)
    }
  }
})
```

## Quality Gating

Filter out low-confidence answers before surfacing:

```typescript
const result = await brain.ask(query)

const strong = result.sources.filter(s => s.confidence > 0.6 && s.relevance > 0.5)
if (strong.length === 0) return null // Nothing worth surfacing

return { insight: result.insight, gaps: result.gaps }
```

## Cross-Domain Connections

The synthesis LLM sees all neuron responses and can find bridges:

```typescript
const result = await brain.ask('What connects my interest in calm tech with my wedding planning?')
```

## User-Steerable Taxonomy

Let users reshape the neuron structure at runtime:

```typescript
await brain.mergeNeurons(['eink', 'paper-displays'], 'Combine under hardware')
await brain.splitNeuron('ai-neuron', 'Separate into AI tools vs AI research')
await brain.adjustNeuron('categories', 'Stop categorizing things as inspiration')
```

## Dual-Brain Architecture

Use separate brains for different time horizons — one for long-term memory, one for short-lived processing:

```typescript
import { Brain } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'

// Long-term brain: evolves over time, persists everything
const longTermBrain = new Brain({
  prompt: 'Track patterns across all interactions.',
  model,
  store: new SQLiteBrainStore('./long-term.brain.db'),
  learning: {
    store: (id) => new SQLiteNeuronStore(`./long-term.neuron-${id}.db`),
  },
  evolution: { enabled: true },
})

// Session brain: fixed structure, short-lived
const sessionBrain = new Brain({
  prompt: 'Extract observations from this session.',
  model,
  autoSetup: false,
  neurons: sessionNeuronDefs,
  evolution: { enabled: false },
})

// Process data through the session brain
await sessionBrain.inject(sessionData)

// Transfer session knowledge to the long-term brain
for (const neuron of sessionBrain.getNeurons()) {
  const understanding = await neuron.getUnderstanding()
  if (understanding) {
    await longTermBrain.inject({ source: neuron.name, content: understanding })
  }
}
```

## Event-Driven Synchronization

Wait for Brain to fully settle after injection (including synthesis and evolution):

```typescript
const injectDone = new Promise<void>((resolve) => {
  brain.on('brain:inject:completed', () => resolve())
})

await brain.inject(data)
await injectDone // Block until all neurons finish processing
```

## Multi-Provider Model Setup

Use different providers for different phases — a local model for high-volume observation and a cloud model for synthesis:

```typescript
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const local = createOpenAICompatible({
  baseURL: 'http://localhost:11434/v1',
  name: 'ollama',
})

const brain = new Brain({
  prompt: '...',
  model: local('llama3.1'),
  blueprintModel: openai('gpt-4o'),
  init: { model: openai('gpt-4o') },
  query: { model: openai('gpt-4o') },
  learning: {
    observer: { model: local('llama3.1') },
    understand: { model: openai('gpt-4o') },
  },
})
```

## SSE Event Broadcasting

Forward Brain events to SSE clients:

```typescript
// Forward all brain events to connected clients
brain.on((event) => {
  for (const send of sseClients) {
    send(event.type, event.payload)
  }
})
```

The SSE transport layer is framework-dependent (Express, Hono, Fastify, etc.) — the pattern above works with any setup that gives you a `send(event, data)` callback per client.
