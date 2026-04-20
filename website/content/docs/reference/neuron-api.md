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

`init()` has two modes, chosen automatically by inspecting the store:

- **Cold start** (empty store) — generates observe/understand identity, system prompts, and schemas via LLM calls, then persists them.
- **Restore** (store has prior state) — rehydrates identity, prompts, and schemas from the store via DB reads only. **Zero LLM calls.** This is how a `TextNeuron`/`ListNeuron` constructed over a prepopulated `SQLiteNeuronStore` picks up exactly where a previous process left off.

Constructing a neuron does no I/O — the constructor only wires up `id`, `store`, and initial state. Restore happens when `init()` runs, either explicitly or on the first `learn()`/`query()` call via auto-init.

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
| `getSummary()` | `Promise<string>` | Prose summary (returns `'(no understanding yet)'` pre-synthesis) |
| `hasKnowledge()` | `Promise<boolean>` | Has any understanding |

**Pre-synthesis return values.** Before synthesis has produced any understanding (fresh neuron, or enough `learn()` calls buffered but threshold not yet crossed), `getUnderstanding()` resolves to an empty value of `T` — never `undefined`, `null`, or a throw:

- `TextNeuron` → `''` (empty string)
- `ListNeuron` → `[]` (empty array)

For a clean "is there any understanding yet?" check, prefer `hasKnowledge()` over inspecting the return of `getUnderstanding()`.

## Buffer

| Method | Returns | Description |
|---|---|---|
| `getBufferState()` | `Promise<{ count, avgImportance, totalTokens }>` | Pending observation metrics |
| `getBufferedObservations()` | `Promise<Array<{ text, importance }>>` | Pending observations only — for processed history see [Stores → Observation lifecycle](../stores#observation-lifecycle) |

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
