---
title: Neuron API Reference
description: Shared API for TextNeuron and ListNeuron.
---

Shared API for `TextNeuron` and `ListNeuron` (both extend `BaseNeuron`).

## Lifecycle

| Method | Returns | Description |
|---|---|---|
| `TextNeuron.create(config, parentModels?)` | `Promise<TextNeuron>` | Construct a fresh TextNeuron and persist its config. Throws if the store already contains a neuron. |
| `TextNeuron.restore(pathOrStore, runtime?)` | `Promise<TextNeuron>` | Restore a previously persisted TextNeuron. Path-string sugar uses Node SQLite via dynamic import. Throws if the store is empty. |
| `ListNeuron.create(config, parentModels?)` | `Promise<ListNeuron>` | Same shape — fresh ListNeuron. |
| `ListNeuron.restore(pathOrStore, runtime?)` | `Promise<ListNeuron>` | Same shape — restored ListNeuron. |
| `dispose()` | `Promise<void>` | Close the neuron's own store. |
| `isInitialized()` | `boolean` | True once `init` has completed (an explicit internal `initialized` flag is set at the end of init). For legacy persisted neurons that predate the flag, it also returns true when `understand_prompt` is present. Works for `skipObservation` and `skipUnderstand` neurons. |

Constructors are private — the static `create` / `restore` methods are the only public entry points. Both fully initialize the neuron; there is no separate `init()` step on the public surface. `create` runs prompt + schema generation via LLM and persists everything. `restore` rehydrates identity, prompts, and schemas from the store via DB reads only — zero LLM calls during init.

**`restore()` runtime options:**

```typescript
{
  id?: string                  // Pin the neuron id (useful when the store holds multiple)
  model?: LanguageModel        // Live AI SDK model — covers the common case
  llm?: AdaptLLMPlugin         // Custom plugin — for BYO runtimes
  onEvent?: UnifiedHandler     // Subscribed before restore init runs — catches neuron:init:* events
}
```

All fields are optional. See [Brain — Fresh vs Restored](../brain#fresh-vs-restored) for the canonical write-up — the same semantics apply to neuron `restore`.

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
| `queryStream(question, options?)` | `Promise<AdaptStreamResult>` | Streaming variant |

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
| `instructions` | `string` | Shared verbatim instructions (feed both observe and understand) |
| `observeInstructions` | `string \| null` | Observe-phase instruction override (`null` = inherit `instructions`) |
| `understandInstructions` | `string \| null` | Understand-phase instruction override (`null` = inherit `instructions`) |
| `focus` | `string \| null` | Observe-only focus narrowing |
| `origin` | `NeuronOrigin` | `'prompt'`, `'developer'`, or `'emergent'` |

## Config Fields

Accepted by `TextNeuron.create()` / `ListNeuron.create()` (and, where noted, by Brain explicit-neuron configs). Required: `model`, `instructions`, `store`.

| Field | Type | Description |
|---|---|---|
| `model` | `LanguageModel` | Default model for all phases. |
| `instructions` | `string` | Shared verbatim instructions. Inserted directly into the observe and understand prompts — not paraphrased. |
| `observeInstructions` | `string \| null` | Optional. Overrides the verbatim instructions for the observe prompt only. |
| `understandInstructions` | `string \| null` | Optional. Overrides the verbatim instructions for the understand prompt only. |
| `focus` | `string \| null` | Optional. Observe-only — narrows what data is kept. |
| `skipObservation` | `boolean` | Optional. Skip the observe phase — data goes straight to the understanding buffer. |
| `skipUnderstand` | `boolean` | Optional. Retain observations but never synthesize understanding — not on threshold, not on `forceSynthesize`. No understand prompt is built. Symmetric counterpart of `skipObservation`. |
| `observationSchema` | `Record<string, unknown>` | Optional. Custom observation JSON Schema — skips LLM schema generation. |
| `understandingSchema` | `Record<string, unknown>` | Optional. Custom understanding JSON Schema — skips LLM schema generation. |
| `onEvent` | `UnifiedHandler<NeuronEvent>` | Optional. Subscribed via `.on(...)` before `init()` runs, so `neuron:init:*` events are observable. Also accepted in `restore()` runtime options. |
