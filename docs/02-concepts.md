# Concepts

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                              Brain                                   │
│  Orchestration · Decomposition · Synthesis · Evolution                │
│                                                                       │
│  ┌────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Evaluator     │  │  Evolution            │  │  Internal        │  │
│  │  (signal →      │  │  Orchestrator         │  │  Neurons         │  │
│  │   decisions)    │  │  (create/merge/       │  │  (gaps, query    │  │
│  │                 │  │   split/update/       │  │   patterns,      │  │
│  │                 │  │   delete)             │  │   global         │  │
│  │                 │  │                       │  │   understanding) │  │
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

## Learning Pipeline

Data flows through two phases:

1. **Observe** — LLM filters incoming data, extracts relevant observations, scores importance (0–1). Irrelevant data is dismissed with gap tracking. Observations are buffered as "pending."

2. **Understand** — When buffer thresholds are met (observation count or token count), LLM synthesizes pending observations into compressed knowledge. TextNeuron produces narrative prose. ListNeuron uses CRUD tools to update a structured collection. Each synthesis produces a significance rating (`routine`, `notable`, `critical`).

Querying is separate: the LLM reads the neuron's understanding and answers questions with relevance/confidence scores.

## Brain vs Standalone

**Brain** orchestrates multiple neurons — auto-generates them from a prompt, routes data to all of them, synthesizes multi-neuron responses, and manages evolution. Use Brain when you want the system to decide its own structure.

**Standalone neurons** (`TextNeuron`, `ListNeuron`) work independently. You create them, feed them data, query them. Use standalone when you want direct control over a single domain.

## Text vs List

| | TextNeuron | ListNeuron |
|---|---|---|
| **Understanding** | Narrative prose (string) | Structured collection (items) |
| **Good for** | Patterns, philosophy, qualitative themes, behavioral tendencies | Entities, catalogs, inventories, tracking distinct things |
| **Synthesis** | LLM integrates observations into one evolving text | LLM agent uses CRUD tools to add/update/remove items |
| **Schema** | N/A | LLM-generated from instructions |
| **Confidence** | LLM-assigned per query (how well can I answer this?) | Mechanical — `touchCount / maxTouchCount` (evidence frequency) |
| **Cognitive skills** | Compare (confirms/contradicts/extends/new) + Dynamics (recurs/intensifies/fades/shifts/avoids) | None — CRUD tools only |
| **Governance** | Strategy (continuous, cumulative, decay) + maxTokens | Deduplication + maxItems + pruning |

**Choosing between them:**

Use **TextNeuron** when the domain is about *how things relate* — patterns, philosophy, evolving narratives, behavioral tendencies. The understanding is a living document that synthesizes across observations. Good for: coding philosophy, design principles, personal behavior patterns, research themes.

Use **ListNeuron** when the domain is about *tracking distinct things* — each item is independently identifiable and has its own lifecycle. The understanding is a structured collection where items are added, updated, and removed. Good for: feature requests, contact lists, recipe collections, inventory.

**Rule of thumb:** If the answer to "what do you know?" is a narrative → TextNeuron. If it's a table or list of items → ListNeuron.

## Evolution

Brain doesn't just process data — it reshapes its own structure over time. This happens through a signal → evaluate → act loop.

### Signals

Signals are observations about the system's health. They come from three sources:

- **Automatic** — Neurons emit signals when they detect problems: high dismissal rate (most data is irrelevant), low query relevance, low confidence, or observation stagnation.
- **Coverage gaps** — When all neurons dismiss a data batch, or when a query gets low relevance scores from every neuron, that's a gap signal.
- **Developer** — You can inject signals from your application: `brain.signal({ source: 'user', description: 'We need to track deployment patterns' })`.

### Evaluator

Signals accumulate in a buffer. When the buffer hits a threshold (default: 5 signals), the evaluator triggers. It's an LLM agent with tools to inspect neurons, query their knowledge, review dismissed data, and consult internal neurons. Based on what it finds, it makes decisions.

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

Brain maintains four internal neurons that feed the evolution system with meta-knowledge:

- **Global Understanding** — cross-domain patterns from all neuron knowledge
- **Global Query Understanding** — what users ask about, frequency, clusters
- **Injection Gaps** — data that no neuron could process
- **Query Gaps** — questions that no neuron could answer well

These are queried by the evaluator during evaluation, and can be queried directly via `brain.consult()`.

See [Evolution](./07-evolution.md) for configuration and manual control.

## Steering

Beyond automatic evolution, you can steer the system manually at two levels.

### Developer Signals

`brain.signal()` lets you inject external knowledge into the evolution loop — things the system can't detect on its own. Signals accumulate alongside automatic ones and feed into the evaluator.

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

`adjust()` is natural language steering for individual neurons. The LLM sees the neuron's current instructions, identity, and understanding, then evolves them incrementally. Existing knowledge is preserved — nothing is thrown away.

```typescript
// Standalone neuron
await neuron.adjust('Also track accessibility patterns')

// Brain-managed neuron
await brain.adjustNeuron('design', 'Focus only on mobile, stop tracking desktop')
```

This is different from `update()`, which replaces config mechanically. Adjust is a conversation with the neuron — it decides what to change based on what it already knows. If the directive is ambiguous, it preserves more rather than less.
