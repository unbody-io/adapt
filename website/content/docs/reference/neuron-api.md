---
title: Neuron API Reference
description: Shared API for TextNeuron and ListNeuron.
---

Shared API for `TextNeuron` and `ListNeuron` (both extend `BaseNeuron`).

## Lifecycle

| Method | Returns | Description |
|---|---|---|
| `TextNeuron.create(config, parentModels?)` | `Promise<TextNeuron>` | Construct a fresh TextNeuron and persist its config. Throws if the store already contains a neuron. |
| `TextNeuron.restore(pathOrStore, opts?)` | `Promise<TextNeuron>` | Restore a previously persisted TextNeuron. Path-string sugar uses Node SQLite via dynamic import. `opts.id` lets you pin the neuron id. Throws if the store is empty. |
| `ListNeuron.create(config, parentModels?)` | `Promise<ListNeuron>` | Same shape — fresh ListNeuron. |
| `ListNeuron.restore(pathOrStore, opts?)` | `Promise<ListNeuron>` | Same shape — restored ListNeuron. |
| `dispose()` | `Promise<void>` | Close the neuron's own store. |
| `isInitialized()` | `boolean` | True once the neuron's `understand_prompt` has been generated/restored (works for `skipObservation` neurons too). |

Constructors are private — the static `create` / `restore` methods are the only public entry points. Both fully initialize the neuron; there is no separate `init()` step on the public surface. `create` runs prompt + schema generation via LLM and persists everything. `restore` rehydrates identity, prompts, and schemas from the store via DB reads only — zero LLM calls during init.

> **Required after `restore` (non-Gateway users):** Restored models rehydrate as Vercel AI Gateway strings. If you don't have `AI_GATEWAY_API_KEY` set, you **must** call `await neuron.update({ model })` before any LLM operation, otherwise calls fail with `GatewayAuthenticationError`. Issue [#9](https://github.com/unbody-io/adapt/issues/9) — BYO LLM call function — will remove this step in 0.0.6.

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
| `getBufferedObservations()` | `Promise<Array<{ text, importance }>>` | Pending observations only, condensed shape |

## Observations

Full-history access to the underlying observation collection. Returns full `ObservationRecord` shape (id, data, importance, status, tokens, created_at).

| Method | Returns | Description |
|---|---|---|
| `getObservations(filter?)` | `Promise<ObservationRecord[]>` | All observations. Optional `{ status: 'pending' \| 'processed' }` filter. |
| `setObservations(records)` | `Promise<void>` | Bulk-replace the entire observation collection. |
| `updateObservation(id, patch)` | `Promise<void>` | Patch a single observation's fields. |
| `removeObservation(id)` | `Promise<void>` | Delete a single observation. |

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
