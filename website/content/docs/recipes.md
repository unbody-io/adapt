---
title: Recipes
description: Real-world patterns — proactive insights, quality gating, dual-brain architecture.
---

Common patterns for building with Adapt. Each recipe addresses a specific problem you'll likely encounter.

## Proactive Insights

**Problem:** By default, insights only come when you ask for them via `ask()`. But sometimes you want the system to proactively surface important findings — for example, notifying a user when a critical pattern emerges.

**Solution:** Subscribe to `neuron:synthesized` events and trigger a query when significance is high:

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

**Problem:** Not every query produces a good answer. If neurons don't have enough knowledge, you'll get low-confidence, speculative responses. You don't want to surface these to users.

**Solution:** Filter results by confidence and relevance before showing them:

```typescript
const result = await brain.ask(query)

const strong = result.sources.filter(s => s.confidence > 0.6 && s.relevance > 0.5)
if (strong.length === 0) return null // Nothing worth surfacing

return { insight: result.insight, gaps: result.gaps }
```

## Cross-Domain Connections

**Problem:** Each neuron is an independent specialist. But sometimes the most interesting insights come from *connecting* knowledge across domains — patterns that no single neuron can see on its own.

**Solution:** Just ask. The synthesis step in `brain.ask()` sees all neuron responses together and can draw connections between them:

```typescript
const result = await brain.ask('What connects my interest in calm tech with my wedding planning?')
```

## User-Steerable Taxonomy

**Problem:** Your users may want to control how knowledge is organized — merging categories that feel redundant, splitting broad ones that are too noisy, or adjusting what a neuron pays attention to.

**Solution:** Expose the evolution management API to your users, letting them reshape the Brain's structure at runtime:

```typescript
await brain.mergeNeurons(['eink', 'paper-displays'], 'Combine under hardware')
await brain.splitNeuron('ai-neuron', 'Separate into AI tools vs AI research')
await brain.adjustNeuron('categories', 'Stop categorizing things as inspiration')
```

## Dual-Brain Architecture

**Problem:** Some use cases need both long-term memory (patterns across weeks or months) and short-term processing (extracting observations from a single session). A single Brain can't easily serve both — long-term brains have accumulated knowledge that biases observation, while session brains need to start fresh.

**Solution:** Use two separate brains. A session brain processes the immediate data with a fixed, lightweight structure. After the session, transfer its knowledge into the long-term brain:

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

**Problem:** `brain.inject()` returns after observation completes, but synthesis may still be running. If you need to guarantee that all neurons have finished processing before continuing (e.g., before querying), you need to wait for the full pipeline.

**Solution:** Listen for the `brain:inject:completed` event, which fires after all neurons finish both observation and synthesis:

```typescript
const injectDone = new Promise<void>((resolve) => {
  brain.on('brain:inject:completed', () => resolve())
})

await brain.inject(data)
await injectDone // Block until all neurons finish processing
```

## Multi-Provider Model Setup

**Problem:** You want to minimize cloud API costs, but local models aren't good enough for synthesis and querying.

**Solution:** Use the [model cascade](./configuration#model-cascade) to assign a local model for high-volume observation and a cloud model for the operations that need quality:

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

**Problem:** You're building a web app and want to stream Brain activity (observation progress, synthesis results, evolution decisions) to the browser in real time.

**Solution:** Forward Brain events over Server-Sent Events. The event system emits structured payloads that map cleanly to SSE:

```typescript
// Forward all brain events to connected clients
brain.on((event) => {
  for (const send of sseClients) {
    send(event.type, event.payload)
  }
})
```

The SSE transport layer is framework-dependent (Express, Hono, Fastify, etc.) — the pattern above works with any setup that gives you a `send(event, data)` callback per client.
