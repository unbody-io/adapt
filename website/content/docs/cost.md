---
title: Cost & Performance
description: LLM call counts per operation, model-slot routing, and tuning for production workloads.
---

Adapt's cost is dominated by LLM calls. This page gives you the exact call count per operation so you can estimate spend and latency, and points to the levers that move the most.

## Quick Reference

Typical cost for common workflows:

| Scenario | Neurons | Calls per `inject` | Calls per `ask` |
|---|---|---|---|
| Simple (3 neurons, no understand trigger) | 3 | 3 | 5 |
| Medium (5 neurons, understand triggers on 1) | 5 | 6 | 7 |
| Large (10 neurons, understand triggers on 3) | 10 | 13 | 12 |
| Deep mode ask (5 neurons) | 5 | — | 2–12 |

> **Cost tip:** The observe phase runs on every inject and scales linearly with neurons. This is where a fast/cheap model pays off the most. Understand and query run less frequently but need higher quality — use a smarter model there. See [Configuration — Model Cascade](./configuration#model-cascade) for the cost-optimized cascade setup.

## Detailed Call Counts

N = number of neurons, B = number of batches.

### Core Operations

| Operation | LLM Calls | Model Slot | Notes |
|---|---|---|---|
| **`inject(data)`** | | | |
| → Observe | `N × B` | `learning.observer` | 1 call per neuron per batch. Skipped if `skipObservation: true` |
| → Understand | `0 – N` | `learning.understand` | Only triggers when buffer exceeds `maxObservations` or `maxTokens`. Always skipped if `skipUnderstand: true` |
| **`ask(question)`** | | | |
| → Neuron selection | `1` | `query` | Skipped if only 1 neuron has knowledge |
| → Neuron queries | `N` | `learning.query` | Parallel. N = relevant neurons, not all |
| → Synthesis | `1` | `query` | Combines neuron results into final answer |
| **`ask(question, { mode: 'deep' })`** | `2–12` | `query` | Agentic — LLM decides which neurons to query and when to stop |
| **`query(question)`** | `1` | `learning.query` | Standalone neuron query (single call) |

### Lifecycle Operations

| Operation | LLM Calls | Model Slot | Notes |
|---|---|---|---|
| **`Brain.create()`** | | | |
| → Decomposition | `1` | `init` | Only with `autoSetup: true`. Determines neuron structure |
| → Prompt parsing | `1` | `blueprintModel` | Extracts purpose and synthesis directives |
| → Neuron init | `0 – N` | `blueprintModel` | Up to 1 call per neuron. TextNeuron: cognitive-skill customization — always, unless `skipUnderstand` (then `0`). ListNeuron: schema generation — `0` when a custom `observationSchema` is supplied. Observe and understand prompts are assembled deterministically — no LLM call. |
| **`adjust(directive)`** | `1–3` | `blueprintModel` | 1 classify + (if config changes) 1 instruction-rewrite + 1 prompt/schema regen. Observe and understand prompts are re-assembled deterministically — TextNeuron spends the extra call on skill regen, ListNeuron on schema regen |
| → + Understanding rewrite | `+1–15` | `learning.understand` | Only if directive changes what the neuron knows, not just how it behaves |
| **`update(config)`** | `0–1` | `blueprintModel` | 0 if mechanical (model/threshold changes). 1 if instructions changed (schema/skill regen — the observe/understand prompts themselves regenerate without an LLM call) |

### Evolution Operations

| Operation | LLM Calls | Model Slot | Notes |
|---|---|---|---|
| **`signal()`** | `0` | — | Buffers only. No immediate LLM call |
| **Evaluator trigger** | `1–12` | `evolution` | Agentic — inspects neurons, reviews gaps, makes decisions |
| → Create N neurons | `1 + N` | `blueprintModel` | 1 generation + 1 per neuron init |
| → Merge neurons | `1` | `blueprintModel` | Single generation call |
| → Split into N | `1 + (N-1)` | `blueprintModel` | 1 generation + 1 init per new neuron |
| → Update neuron | `1–15` | `blueprintModel` | 1 guidance + optional adjust cascade |
| → Delete neuron | `0` | — | Mechanical removal |

## Where to spend the smarter model

Routing the right model to the right slot is the cheapest performance win. Some heuristics:

- **`learning.observer`** — runs on every batch, every neuron. Use the cheapest model that can follow the observation schema. A relevance-classification call doesn't need a frontier model.
- **`learning.understand`** — runs less often but is what determines knowledge quality. Use a smart model.
- **`learning.query`** — runs once per ask per neuron. Smart model recommended; the answer the user sees is shaped here.
- **`query` (brain ask synthesis)** — final integration step. Smart model.
- **`init` / `blueprintModel`** — one-time and rare (decomposition, per-neuron skill/schema generation). Smart model. Cost is amortized.
- **`evolution`** — runs when signals accumulate. Smart model with tool-calling support is required.

See [Configuration — Model Cascade](./configuration#model-cascade) for the full cascade and the `Cost-optimized setup` example.

## Latency

Per-call latency is dominated by the model and provider, not Adapt. A few observations:

- Observe phase runs in parallel across neurons within a batch.
- Synthesize runs once per neuron when its buffer crosses a threshold — not every batch.
- Internal neurons run a second pass after user-facing neurons. They use queries that resolve asynchronously and often complete on the next inject.
- Deep-mode ask is variable: 2–12 calls depending on the agent's path.

For a step-by-step lifecycle with timing estimates, see [Events — Brain lifecycle timing](./events#timing-expectations).
