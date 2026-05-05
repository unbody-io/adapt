---
title: Events
description: Event system, subscription patterns, and complete event reference.
---

Brain and its neurons emit events at every stage of the pipeline — observation, synthesis, querying, evolution, and more. You can subscribe to these events to build real-time UIs, trigger side effects (like notifying a user when something important is learned), debug pipeline behavior, or forward events to external systems.

## Subscribing

```typescript
// Specific event (typed)
brain.on('neuron:synthesized', (payload) => {
  console.log(`${payload.neuronId}: ${payload.significance} — ${payload.evolution}`)
})

// All events
brain.on((event) => {
  console.log(`[${event.type}] ${event.id} at ${event.timestamp}`)
})
```

Neuron events are automatically forwarded through Brain — subscribe on Brain, not individual neurons.

### Forwarding to a UI

Events are useful for building real-time interfaces — showing users what the Brain is doing as it processes data:

```typescript
// Forward all brain events to an Electron renderer
brain.on((event) => {
  window.webContents.send('brain:event', {
    type: event.type,
    ...event.payload,
  })
})
```

See [Recipes — SSE Event Broadcasting](./recipes#sse-event-broadcasting) for a server-sent events example.

## Event Reference

Events are grouped by phase. The most commonly used events are `neuron:synthesized` (a neuron updated its knowledge), `brain:ask:completed` (a query finished), and `evaluator:evaluation:completed` (the evolution system made decisions).

### Brain Events

| Phase | Events | Key payload fields |
|---|---|---|
| **Init** | `brain:init:started`, `brain:init:config:generating`, `brain:init:config:generated`, `brain:init:completed`, `brain:init:failed` | `configs[]`, `neuronIds[]`, `usage` |
| **Inject** | `brain:inject:started`, `brain:inject:batch:started`, `brain:inject:batch:completed`, `brain:inject:completed`, `brain:inject:failed` | `injectId`, `itemCount`, `batchCount`, `results[]` |
| **Ask** | `brain:ask:started`, `brain:ask:synthesis:started`, `brain:ask:completed`, `brain:ask:failed` | `queryId`, `query`, `insight`, `sources[]`, `gaps[]`, `usage` |
| **Neuron Mgmt** | `brain:neuron:added`, `brain:neuron:removed`, `brain:neuron:status:changed` | `neuronId`, `name`, `instructions`, `previousStatus`, `newStatus` |
| **Signals** | `brain:signal:received` | `source`, `description`, `timestamp` |
| **Evaluator** | `evaluator:evaluation:started`, `evaluator:evaluation:completed`, `evaluator:evaluation:failed` | `signalCount`, `decisions[]`, `reasoning` |
| **Evolution** | `evolution:action:started`, `evolution:action:executed`, `evolution:action:failed` | `action`, `targets[]`, `reasoning`, `result` |
| **Config** | `brain:config:updated` | `updates`, `changedFields[]` |

### Neuron Events

| Phase | Events | Key payload fields |
|---|---|---|
| **Init** | `neuron:init:started`, `neuron:init:completed`, `neuron:init:failed` | `neuronId`, `systemPrompt`, `usage` |
| **Observe** | `neuron:observe:started`, `neuron:observe:thinking`, `neuron:observed`, `neuron:observe:dismissed`, `neuron:observe:error` | `neuronId`, `output[]`, `importance`, `bufferCount`, `gaps[]` |
| **Synthesize** | `neuron:synthesize:started`, `neuron:synthesize:thinking`, `neuron:synthesized`, `neuron:synthesize:dismissed`, `neuron:synthesize:error` | `neuronId`, `newUnderstanding`, `significance`, `evolution` |
| **Learn** | `neuron:learn:failed` | `neuronId`, `error` |
| **Query** | `neuron:query:started`, `neuron:query:completed`, `neuron:query:failed`, `neuron:query:thinking` | `neuronId`, `insight`, `relevance`, `confidence`, `gaps[]` |
| **Health** | `neuron:health:updated` | `neuronId`, `activation`, `status`, `previousStatus` |
| **Signals** | `neuron:signal` | `neuronId`, `description`, `metrics` |
| **Config** | `neuron:config:updated`, `neuron:prompts:regenerated`, `neuron:understanding:set`, `neuron:understanding:adjusted` | `neuronId`, `changedFields[]`, `directive`, `significance` |

### Thinking Events

`neuron:observe:thinking`, `neuron:synthesize:thinking`, and `neuron:query:thinking` fire when the LLM produces intermediate reasoning. Payload includes `thoughts: string[]` and `usage: TokenUsage`. These are useful for two things: debugging (seeing *why* a neuron made a decision) and real-time UI feedback (streaming the neuron's thought process to users).
