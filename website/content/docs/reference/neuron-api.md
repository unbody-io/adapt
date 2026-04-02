---
title: Neuron API Reference
description: Shared API for TextNeuron and ListNeuron.
---

Shared API for `TextNeuron` and `ListNeuron` (both extend `BaseNeuron`).

## Lifecycle

| Method | Returns | Description |
|---|---|---|
| `init()` | `Promise<{ observeSystemPrompt, understandSystemPrompt }>` | Initialize neuron (auto-called on first `learn`/`query`) |
| `dispose()` | `Promise<void>` | Dispose neuron store |
| `isInitialized()` | `boolean` | Check if neuron is initialized |

## Learning

| Method | Returns | Description |
|---|---|---|
| `learn(batch, options?)` | `Promise<LearnOutput>` | Process data (observe → understand) |

**`learn()` options:** `{ forceSynthesize?: boolean }`

### LearnOutput

Discriminated union — check `status` to determine the outcome:

| Status | Fields | Meaning |
|---|---|---|
| `observed` | `output[], usage?` | Observations buffered, threshold not met |
| `synthesized` | `newUnderstanding, significance, evolution, reasoning?, usage?` | Understanding updated |
| `observe:dismissed` | `output[], gaps[], usage?` | Data not relevant |
| `observe:error` | `error` | Observer failed |
| `synthesize:dismissed` | `output, usage?` | LLM chose not to update |
| `synthesize:error` | `error` | Synthesizer failed |

**`significance`**: `'routine' | 'notable' | 'critical'`

## Querying

| Method | Returns | Description |
|---|---|---|
| `query(question, options?)` | `Promise<QueryResult>` | Query neuron knowledge |
| `queryStream(question, options?)` | `Promise<StreamTextResult>` | Streaming variant |

### QueryResult

```typescript
{
  relevant: boolean
  relevance: number      // 0–1
  confidence: number     // 0–1
  insight: string
  gaps: string
  usage: TokenUsage
}
```

## Understanding

| Method | Returns | Description |
|---|---|---|
| `getUnderstanding()` | `Promise<T>` | Current knowledge (`string` for text, `ListItem[]` for list) |
| `setUnderstanding(value)` | `Promise<void>` | Set knowledge directly |
| `getSummary()` | `Promise<string>` | Prose summary |
| `hasKnowledge()` | `Promise<boolean>` | Has any understanding |

## Buffer

| Method | Returns | Description |
|---|---|---|
| `getBufferState()` | `Promise<{ count, avgImportance, totalTokens }>` | Pending observation metrics |
| `getBufferedObservations()` | `Promise<Array<{ text, importance }>>` | Pending observations |

## Introspection

| Method | Returns | Description |
|---|---|---|
| `getHealth()` | `NeuronHealth` | Activation, status, signal thresholds |
| `getMetrics()` | `NeuronMetrics` | `{ ingestion: { dismissalRate, ... }, query: { relevanceScores, confidenceScores, gaps } }` |
| `getMetadata()` | `NeuronMetadata` | Combined metadata |
| `getEvolution()` | `Promise<EvolutionRecord[]>` | Change history |
| `getObservationSchema()` | `Record \| null` | JSON Schema for observations |
| `getUnderstandingSchema()` | `Record \| null` | JSON Schema for understanding |
| `getObserveSystemPrompt()` | `string \| null` | Generated observe system prompt |
| `getUnderstandSystemPrompt()` | `string \| null` | Generated understand system prompt |
| `getUnderstandThresholds()` | `{ maxObservations?, maxTokens?, minImportance? }` | Current thresholds |

## Config

| Method | Returns | Description |
|---|---|---|
| `update(updates)` | `Promise<{ changedFields }>` | Replace config, regenerate prompts |
| `adjust(directive)` | `Promise<AdjustResult>` | Incremental LLM-driven adjustment |

### AdjustResult

```typescript
{
  changedFields: string[]
  adjustedConfig: boolean
  adjustedUnderstanding: boolean
}
```

## Identity

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Neuron ID |
| `type` | `string` | `'text'` or `'list'` |
| `name` | `string` | Display name |
| `description` | `string` | What this neuron tracks |
| `instructions` | `string` | Neuron instructions |
| `focus` | `string \| null` | Narrowed focus (from adjust) |
| `origin` | `NeuronOrigin` | `'prompt'`, `'developer'`, or `'emergent'` |
