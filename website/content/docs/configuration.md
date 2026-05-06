---
title: Configuration
description: Full BrainConfig reference, model cascade, providers, thresholds, and governance.
---

Reference for `BrainConfig` and the model cascade. For per-operation LLM call counts, see [Cost & Performance](./cost).

## BrainConfig

```typescript
interface BrainConfig {
  prompt: string                            // What to track and learn
  model: LanguageModel                      // Default model for all operations
  blueprintModel?: LanguageModel            // Schema/config generation (falls back to model)
  llm?: AdaptLLMPlugin                      // BYO LLM runtime (default: AI SDK plugin)
  autoSetup?: boolean                       // LLM decomposition on init (default: true)
  neurons?: GeneratedNeuronConfig[]         // Explicit neuron definitions
  store?: BrainStore                        // Brain persistence (default: MemoryBrainStore)

  init?: { model?: LanguageModel }          // Decomposition model
  query?: { model?: LanguageModel }         // ask() synthesis model
  ingest?: { batchSize?: number }           // Items per batch (default: 20)

  learning?: {
    // Per-neuron stores are derived from `store` automatically via
    // BrainStore.getNeuronStore(neuronId). No factory required.
    observer?: {
      model?: LanguageModel                 // Observe phase model
      blueprintModel?: LanguageModel        // Observer prompt generation model
    }
    understand?: {
      model?: LanguageModel                 // Understand phase model
      blueprintModel?: LanguageModel        // Understand prompt generation model
      thresholds?: {
        maxObservations?: number            // default: 10
        maxTokens?: number                  // default: 8000
        minImportance?: number              // default: 0.5
      }
    }
    query?: { model?: LanguageModel }       // Per-neuron query model
    governance?: {
      strategy?: 'continuous' | 'cumulative' | 'decay'  // default: 'cumulative'
      maxTokens?: number                    // default: 16000
    }
  }

  evolution?: {
    enabled?: boolean                       // default: true
    model?: LanguageModel                   // Evolution evaluation model
    evaluatorSignalThreshold?: number       // Signals before auto-eval (default: 5)
    autoEvaluate?: boolean                  // Auto-trigger on threshold (default: true)
    coverageGap?: {
      relevanceThreshold?: number           // Below this = "not relevant" (default: 0.3)
      gapCountThreshold?: number            // Gaps before signaling (default: 5)
      windowSize?: number                   // Rolling window (default: 20)
    }
  }

  internalNeurons?: {
    globalUnderstanding?: boolean | Partial<LearningConfig>
    globalQueryUnderstanding?: boolean | Partial<LearningConfig>
    injectionGaps?: boolean | Partial<LearningConfig>
    queryGaps?: boolean | Partial<LearningConfig>
  }

  dismissedBatchBuffer?: {
    maxSize?: number                        // default: 100
  }
}
```

## Model Cascade

Different operations have different cost/quality trade-offs. Observation runs on every inject and scales linearly with neurons — a cheap, fast model works well here. Synthesis and querying run less often but need higher quality output. The model cascade lets you assign different models to different operations, with each level falling back to its parent if not explicitly set:

```text
brain.model (default for everything)
├── brain.blueprintModel (schema/prompt generation, falls back to model)
├── brain.init.model (decomposition, falls back to blueprintModel)
├── brain.query.model (ask synthesis, falls back to model)
├── brain.evolution.model (evolution evaluation, falls back to model)
└── learning.* (applied to all neurons):
    ├── learning.observer.model → observe phase
    ├── learning.observer.blueprintModel → observer prompt generation
    ├── learning.understand.model → understand phase
    ├── learning.understand.blueprintModel → understand prompt generation
    └── learning.query.model → per-neuron query
```

**Cost-optimized setup** — fast model for high-volume observation, smart model for synthesis:

```typescript
import { openai } from '@ai-sdk/openai'

const fast = openai('gpt-4o-mini')
const smart = openai('gpt-4o')

const brain = await Brain.create({
  prompt: '...',
  model: fast,                      // Default: cheap model
  blueprintModel: smart,            // Schema generation: smart model
  init: { model: smart },           // Decomposition: smart model
  query: { model: smart },          // ask() synthesis: smart model
  learning: {
    observer: { model: fast },      // Observation: cheap model (high volume)
    understand: { model: smart },   // Synthesis: smart model (critical)
    query: { model: smart },        // Per-neuron query: smart model
  },
})
```

For a per-operation breakdown of how many LLM calls each method makes — and where to spend a smarter model vs a cheaper one — see [Cost & Performance](./cost).

## Using Different Providers

```typescript
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Direct providers
await Brain.create({ model: openai('gpt-4o'), ... })
await Brain.create({ model: anthropic('claude-sonnet-4-20250514'), ... })
await Brain.create({ model: google('gemini-2.0-flash'), ... })

// OpenRouter (multi-provider gateway)
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
await Brain.create({ model: openrouter('google/gemini-2.0-flash-001'), ... })
```

Any `LanguageModel` from any `@ai-sdk/*` provider works. See [Vercel AI SDK providers](https://sdk.vercel.ai/providers) for the full list.

### Custom LLM Runtimes

If you need a runtime outside the AI SDK — Effect, an in-house client, or anything implementing the `AdaptLLMPlugin` contract — pass `llm` in `BrainConfig` (or to `Brain.restore` / `TextNeuron.create` / `ListNeuron.create`):

```typescript
import { Brain, createAiSdkLLM } from '@unbody-io/adapt'
import { openai } from '@ai-sdk/openai'

// Pre-register providers so the plugin can rehydrate persisted model refs.
const llm = createAiSdkLLM({ providers: { openai } })

const brain = await Brain.create({
  prompt: '...',
  model: openai('gpt-4o'),
  llm,
})
```

The default plugin (`createAiSdkLLM`) is wired up automatically when you pass any AI SDK model in `model` — you only need to set `llm` explicitly if you want a non-default plugin or to opt into AI Gateway via `createAiSdkLLM({ gateway: true })`. See [Brain — BYO LLM runtime](./brain#byo-llm-runtime).

## Model Requirements

Adapt requires models that support **structured output** and **tool calling**. Not all operations need both — here's the breakdown:

| Operation | Structured Output | Tool Calling |
|---|---|---|
| Observe phase | Yes | No |
| TextNeuron understand | Yes | No |
| ListNeuron understand | No | **Yes** (CRUD tools: add/update/remove/list/search items) |
| Direct query (`ask`) | Yes | No |
| Agentic query (`ask` deep mode) | No | **Yes** (cognitive tools + done tool) |
| Brain synthesis (direct) | Yes | No |
| Brain synthesis (deep) | No | **Yes** (specialist query tools) |
| Evaluator | No | **Yes** (inspect, query, review tools) |
| Brain inspect | No | **Yes** (introspection tools) |
| Identity/schema generation | Yes | No |
| Evolution handlers | Yes | No |
| Governance compression | No | No (plain text) |

If your model doesn't support tool calling, **TextNeuron in direct mode** still works end-to-end. ListNeuron, deep mode, evolution, and inspect require tool-calling models.

> **Practical tip:** Use a tool-calling model (GPT-4o, Claude Sonnet, Gemini Flash) as the default `model`. If you want to use a cheaper/local model for observation, set it on `learning.observer.model` only — observation doesn't need tool calling.

## Understand Thresholds

After observations are buffered, synthesis doesn't happen immediately — it triggers when enough observations have accumulated. Three settings control this:

| Threshold | Default | Effect |
|---|---|---|
| `maxObservations` | 10 | Trigger synthesis after N buffered observations |
| `maxTokens` | 8000 | Trigger synthesis when buffered tokens exceed this |
| `minImportance` | 0.5 | Observations below this importance (0–1) are discarded |

Synthesis triggers when **either** `maxObservations` or `maxTokens` is exceeded.

**Tuning guidance:**

- **Small `maxObservations` (3–5):** Frequent synthesis, fresher understanding, more LLM calls, higher cost.
- **Large `maxObservations` (20–50):** Less frequent synthesis, better batching, understanding stays stale longer.
- **Low `minImportance` (0.1–0.3):** Buffer almost everything — noisy but comprehensive.
- **High `minImportance` (0.7–0.9):** Only buffer highly significant data — clean but may miss subtle patterns.

## Governance

**TextNeuron governance** controls how understanding grows over time:

- **`continuous`** — Understanding grows indefinitely. No compression. Use for low-volume domains where you want full detail.

- **`cumulative`** (default) — Understanding grows until `maxTokens`, then LLM compresses it to a ~500-token seed summary. The seed becomes the foundation for the next cycle.

- **`decay`** — Understanding is organized into temporal sections (Current State / Recent Developments / Historical Context). When `maxTokens` is approached, older content is progressively compressed while recent stays detailed.

**ListNeuron governance** is mechanical post-processing after each synthesis:

- **`deduplication: 'strict'`** (default) — Items with identical data are merged. Merges `touchCount` from both, keeps max confidence, combines signals, preserves earliest `firstSeen`.
- **`maxItems: 200`** (default) — Hard cap on collection size.
- **`pruning: 'oldest'`** (default) — When over limit, remove oldest items first. Also: `'least-confident'` or `'none'`.

## How Thresholds and Governance Interact

Thresholds control *when* synthesis happens. Governance controls *what happens to understanding* after synthesis. Together they shape how a neuron learns.

**Thresholds are the intake valve.** `minImportance` filters what gets buffered. `maxObservations` and `maxTokens` control how much accumulates before the LLM synthesizes. Tight thresholds (high importance, low observation count) mean frequent, focused synthesis. Loose thresholds mean bigger, noisier batches synthesized less often.

**Governance is the memory policy.** It determines whether understanding grows forever (`continuous`), consolidates periodically (`cumulative`), or prioritizes recency (`decay`). This matters because understanding is what the neuron reads when answering queries — if it's too large, the LLM loses focus; if it's too compressed, nuance is lost.

**Common combinations:**

| Use case | Thresholds | Governance | Why |
|---|---|---|---|
| High-volume stream (logs, events) | `minImportance: 0.3`, `maxObservations: 20` | `decay` | Accept most data, keep recent detail, compress history |
| Low-volume, high-value (design decisions) | `minImportance: 0.5`, `maxObservations: 5` | `continuous` | Be selective, synthesize often, keep everything |
| Long-running tracker (feature requests) | `minImportance: 0.3`, `maxObservations: 10` | `cumulative` + `maxItems: 200` | Periodic consolidation, bounded collection |
| Session-scoped (single conversation) | `minImportance: 0.1`, `maxObservations: 5` | `continuous` | Capture everything, no need to compress — session ends soon |
