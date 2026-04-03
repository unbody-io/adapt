---
title: Concepts
description: Architecture, learning pipeline, neuron types, evolution, and steering.
---

Adapt has two main building blocks: **Brain** (an orchestrator that manages multiple learning domains) and **Neurons** (individual specialists that each learn about one thing). This page explains how they work together.

## Architecture

A Brain contains neurons. Each neuron independently learns from data you feed it, building up its own understanding over time. The Brain coordinates them — routing data, synthesizing answers from multiple neurons, and evolving the neuron structure as needs change.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                              Brain                                   │
│  Routes data · Synthesizes answers · Evolves structure                │
│                                                                       │
│  ┌────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Evaluator     │  │  Evolution            │  │  Internal        │  │
│  │  Watches for    │  │  Orchestrator         │  │  Neurons         │  │
│  │  structural     │  │  Acts on evaluator    │  │  Track meta-     │  │
│  │  problems and   │  │  decisions: create,   │  │  knowledge:      │  │
│  │  suggests       │  │  merge, split,        │  │  gaps, query     │  │
│  │  changes        │  │  update, delete       │  │  patterns,       │  │
│  │                 │  │  neurons              │  │  cross-domain    │  │
│  │                 │  │                       │  │  understanding   │  │
│  └────────────────┘  └──────────────────────┘  └──────────────────┘  │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
          ┌──────────┐    ┌──────────┐    ┌──────────┐
          │Neuron A  │    │Neuron B  │    │Neuron N  │
          │  (Text)  │    │  (List)  │    │  (Text)  │
          └────┬─────┘    └────┬─────┘    └────┬─────┘
               │               │               │
               │  Observe → Buffer → Understand │
               └───────────────┬───────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼                     ▼
              ┌───────────┐        ┌───────────┐
              │  LLM      │        │  Storage   │
              │  (ai-sdk) │        │  (Memory/  │
              └───────────┘        │   SQLite)  │
                                   └───────────┘
```

Don't worry about the Evaluator, Evolution, and Internal Neurons boxes yet — they're covered in the [Evolution](#evolution) section below. The important thing is the data flow: you inject data → neurons observe and learn → you ask questions → Brain synthesizes answers.

## Learning Pipeline

When you feed data into a neuron (via `learn()` on a standalone neuron, or `inject()` on a Brain), it goes through two phases:

1. **Observe** — The neuron decides what's relevant. An LLM reads each incoming item against the neuron's purpose and filters out what doesn't belong. Relevant items become observations, each scored by importance (0–1). Irrelevant items are dismissed — but tracked, so the system can detect coverage gaps over time. Observations are buffered until there are enough to synthesize.

2. **Understand** — Once enough observations have accumulated (controlled by configurable thresholds — observation count or token count), the neuron synthesizes them into knowledge. How this works depends on the neuron type: a TextNeuron produces an evolving narrative, while a ListNeuron uses an LLM agent with add/update/remove tools to maintain a structured collection. Each synthesis also produces a significance rating (`routine`, `notable`, `critical`) so you can react to important changes.

**Querying** is separate from learning: when you ask a question, the LLM reads the neuron's accumulated understanding and answers with relevance and confidence scores. It doesn't re-process raw data — it reads the synthesized knowledge.

## Brain vs Standalone

**Brain** orchestrates multiple neurons — auto-generates them from a prompt, routes data to all of them, synthesizes multi-neuron responses, and manages evolution. Use Brain when you want the system to decide its own structure.

**Standalone neurons** (`TextNeuron`, `ListNeuron`) work independently. You create them, feed them data, query them. Use standalone when you want direct control over a single domain.

## Neuron Types

Adapt ships two neuron types, each suited to a different kind of knowledge:

**TextNeuron** builds a narrative — a single evolving body of prose that synthesizes patterns across observations. Use it when the domain is about *how things relate*: coding philosophy, design principles, behavioral tendencies, research themes. When you ask "what do you know?", the answer reads like a document.

**ListNeuron** maintains a structured collection — individual items that are added, updated, and removed over time. Use it when the domain is about *tracking distinct things*: feature requests, contacts, recipes, inventory. When you ask "what do you know?", the answer is a table of items.

**Rule of thumb:** narrative answer → TextNeuron. Table or list of items → ListNeuron.

When Brain auto-decomposes your prompt into neurons, the LLM chooses between these two types per domain. When in doubt, it defaults to TextNeuron.

| | TextNeuron | ListNeuron |
|---|---|---|
| **Understanding format** | Narrative prose (string) | Structured collection (items with schema) |
| **How synthesis works** | LLM integrates observations into one evolving text | LLM agent uses add/update/remove tools to manage items |
| **Schema** | N/A | Auto-generated from instructions (or provided manually) |
| **Confidence scoring** | LLM-judged per query ("how well can I answer this?") | Evidence-based — items referenced more often score higher |
| **Pattern recognition** | Detects confirmation, contradiction, recurrence, intensification, avoidance, and other dynamics | N/A — item management only |
| **Growth control** | Strategy (continuous, cumulative, or decay) + token limit | Deduplication + max items + pruning policy |

See [Neurons](./neurons) for the full details on each type.

## Evolution

So far, the neuron structure is static — you (or the Brain's initial decomposition) define what neurons exist, and they learn within those boundaries. But what happens when the data doesn't fit? Maybe a neuron is getting overloaded with too many concerns. Maybe users keep asking questions that no neuron can answer. Maybe two neurons overlap so much they should be one.

Evolution lets the Brain reshape its own neuron structure over time. It works through a **signal → evaluate → act** loop.

### Signals

Signals are observations that something in the system might need to change. They come from three sources:

- **Automatic** — Neurons emit signals when they detect problems in their own health: high dismissal rate (most incoming data is irrelevant to them), low query relevance, low confidence, or stagnation (no new observations for a while).
- **Coverage gaps** — When *all* neurons dismiss a data batch (nothing was relevant to anyone), or when a query gets low relevance from every neuron (nobody could answer well), those gaps are tracked as signals.
- **Developer** — You can inject signals from your application logic: `brain.signal({ source: 'user', description: 'We need to track deployment patterns' })`. This is how you feed external knowledge into the evolution loop — things the system can't detect on its own.

### Evaluator

Signals accumulate in a buffer. When enough signals build up (default threshold: 5), the evaluator triggers. The evaluator is an LLM agent that can inspect neurons, query their knowledge, review dismissed data, and consult internal neurons (described below). Based on what it finds, it decides what structural changes to make.

### Decisions

The evaluator can make five types of structural decisions:

| Decision | What happens |
|---|---|
| **Create** | A new neuron is designed and added to cover an uncovered domain |
| **Merge** | Two or more overlapping neurons are combined into one |
| **Split** | An overloaded neuron is divided into multiple focused ones |
| **Update** | A neuron's instructions or config are refined |
| **Delete** | A neuron that's no longer useful is removed |

After each decision, the orchestrator executes it — creating, merging, splitting, updating, or deleting neurons as needed.

### Internal Neurons

Beyond the neurons that learn from your data (called "external" neurons), Brain maintains four **internal neurons** that track meta-knowledge — information *about* how the system is performing, not the data itself:

- **Global Understanding** — cross-domain patterns synthesized from all neuron knowledge (what themes connect different domains?)
- **Global Query Understanding** — what users ask about, how often, and in what clusters (what does the audience care about?)
- **Injection Gaps** — data that no neuron could process (what are we missing?)
- **Query Gaps** — questions that no neuron could answer well (where are the blind spots?)

The evaluator consults these internal neurons when deciding whether to create, merge, split, update, or delete neurons. You can also query them directly via `brain.consult()` to understand how the system is performing.

See [Evolution](./evolution) for configuration and manual control.

## Steering

Evolution is automatic by default, but you're not limited to watching — you can steer the system manually at two levels: structural signals and individual neuron adjustment.

### inject() vs signal()

These two methods serve different purposes. `inject()` feeds **data** to neurons for learning — it flows through the observe → understand pipeline and builds knowledge. `signal()` feeds **metadata** to the evolution system — it tells the Brain that something needs to change structurally (like "we need a new neuron for X" or "these two neurons overlap"). Data goes through `inject()`. Steering goes through `signal()`.

### Developer Signals

`brain.signal()` lets you pass external knowledge into the evolution loop — things the system can't detect on its own. Signals accumulate alongside automatic ones and feed into the evaluator.

```typescript
// Tell the brain about a domain shift
brain.signal({ source: 'product', description: 'We pivoted from B2C to B2B — restructure accordingly' })

// Flag a gap from your analytics
brain.signal({ source: 'analytics', description: 'Users keep asking about deployment but nothing covers it' })

// Force immediate evaluation (bypass the signal threshold)
brain.signal({ source: 'admin', description: 'Restructure now', bypass: true })
```

Signals are the bridge between your application logic and the brain's self-organization.

### Neuron Adjustment

Sometimes you don't need to change the Brain's structure — you just want to refine how a single neuron behaves. `adjust()` is natural language steering for individual neurons. You describe what should change in plain English, and the LLM sees the neuron's current instructions, identity, and understanding, then evolves them incrementally. Existing knowledge is preserved — nothing is thrown away.

```typescript
// Standalone neuron
await neuron.adjust('Also track accessibility patterns')

// Brain-managed neuron
await brain.adjustNeuron('design', 'Focus only on mobile, stop tracking desktop')
```

This is different from `update()`, which replaces config values mechanically. `adjust()` is a conversation with the neuron — it decides what to change based on what it already knows. If the directive is ambiguous, it preserves more rather than less. See [Brain — Update vs Adjust](./brain#update-vs-adjust) for a detailed comparison.
