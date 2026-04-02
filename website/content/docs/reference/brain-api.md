---
title: Brain API Reference
description: Complete Brain class API — lifecycle, data, neuron management, evolution, and result types.
---

Complete API reference for the `Brain` class, covering lifecycle management, data operations, neuron management, evolution controls, and all associated result types.

## Lifecycle

| Method | Returns | Description |
|---|---|---|
| `initialize()` | `Promise<void>` | Init brain (auto-called on first inject/ask) |
| `dispose()` | `Promise<void>` | Clean up all neurons and stores |

## Data

| Method | Returns | Description |
|---|---|---|
| `inject(data, options?)` | `Promise<BrainInjectResult>` | Route data to all neurons |
| `ask(query, options?)` | `Promise<BrainAskResult>` | Query all neurons, synthesize response |
| `askStream(query, options?)` | `Promise<StreamTextResult>` | Streaming variant of `ask()` |
| `consult(query, options?)` | `Promise<ConsultResult>` | Query internal neurons |
| `inspect(query, options?)` | `Promise<InspectResult>` | Agentic read-only introspection |

**`ask()` options:** `{ model?: LanguageModel, mode?: 'direct' | 'deep' }` + AI SDK `CallSettings`

**`consult()` options:** `{ neuron?: string }` — target a specific internal neuron by ID

## Neuron Management

| Method | Returns | Description |
|---|---|---|
| `addNeuron(config)` | `Promise<BaseNeuron>` | Add neuron with explicit config |
| `removeNeuron(id)` | `Promise<void>` | Remove neuron and dispose store |
| `adjustNeuron(id, directive)` | `Promise<{ neuron, result }>` | Natural language steering (preserves knowledge) |
| `getNeuron(id)` | `BaseNeuron \| undefined` | Get neuron by ID |
| `getNeurons()` | `BaseNeuron[]` | Get all external neurons |
| `getInternalNeuron(id)` | `BaseNeuron \| undefined` | Get internal neuron by ID |

## Evolution

Requires `evolution.enabled` (default: `true`).

| Method | Returns | Description |
|---|---|---|
| `createNeuron(guidance)` | `Promise<BaseNeuron>` | Create neuron from natural language |
| `deleteNeuron(id)` | `Promise<void>` | Delete neuron via evolution |
| `mergeNeurons(ids, guidance)` | `Promise<BaseNeuron>` | Merge 2+ neurons into one |
| `splitNeuron(id, guidance)` | `Promise<BaseNeuron[]>` | Split neuron into multiple |
| `updateNeuron(id, guidance)` | `Promise<BaseNeuron>` | LLM-driven config update |
| `evaluateEvolution(options?)` | `Promise<{ decisions, results }>` | Trigger evolution evaluation |
| `evaluateEvolutionStream(options?)` | `Promise<{ stream, decisions }>` | Streaming variant |

**`evaluateEvolution()` options:** `{ dryRun?: boolean }`

## Signals & Config

| Method | Returns | Description |
|---|---|---|
| `signal({ source, description, bypass? })` | `void` | Inject signal for evolution |
| `triggerEvolution({ source, description })` | `Promise<void>` | Trigger evolution directly, bypassing signal buffer |
| `update(updates)` | `Promise<BrainUpdateResult>` | Update brain config |
| `on(type, handler)` | `this` | Subscribe to specific event |
| `on(handler)` | `this` | Subscribe to all events |

## Accessors

| Property | Type | Description |
|---|---|---|
| `prompt` | `string` | Brain's purpose prompt |
| `promptContext` | `object \| undefined` | Decomposed prompt context |
| `evolutionContext` | `string \| null` | Evolution guidance from prompt decomposition |
| `config` | `ResolvedBrainConfig` | Current resolved config (computed view) |
| `neurons` | `Map<string, BaseNeuron>` | Map of external neurons |
| `internalNeurons` | `Map<string, BaseNeuron>` | Map of internal neurons |
| `store` | `BrainStore` | Persistence layer |

## Result Types

### BrainAskResult

```typescript
{
  insight: string                          // Synthesized answer
  sources: Array<{
    neuronId: string
    relevance: number
    confidence: number
    insight: string
  }>
  gaps: string[]                           // Aggregated knowledge gaps
}
```

### BrainInjectResult

```typescript
{
  id: string                               // Inject ID
  batches: Array<{
    id: string
    index: number
    results: Array<{
      neuronId: string
      result: LearnOutput                  // See neuron-api.md
    }>
  }>
}
```

### BrainUpdateResult

```typescript
{
  changedFields: string[]
  config: ResolvedBrainConfig
  neuronResults: Array<{
    neuronId: string
    changedFields: string[]
  }>
  evolutionResults?: {                     // Present when semantic changes trigger evaluation
    decisions: EvolutionDecision[]
    created: string[]
    updated: string[]
    deleted: string[]
    merged: string[]
    split: string[]
  }
}
```
