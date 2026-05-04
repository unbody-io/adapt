---
title: Evolution
description: Signal-driven self-organization — how Brain adapts its neuron structure.
---

As a Brain processes data and answers queries, its initial neuron structure may not be the right one forever. Some neurons get overloaded, some overlap, some domains emerge that no neuron covers. Evolution is how the Brain detects these problems and restructures itself — creating, merging, splitting, updating, or deleting neurons as needed.

For an overview of the concepts, see [Concepts — Evolution](./concepts#evolution). This page covers configuration and manual control.

## Signal Flow

```text
Signal Sources                  Evaluator              Orchestrator
─────────────────              ─────────              ────────────
Neuron health signals      ───►  Buffer signals    ───►  Execute decisions
Coverage gaps              ───►  (threshold: 5)    ───►  create / merge /
Developer signals          ───►  LLM evaluates     ───►  split / update /
System events              ───►  with tools        ───►  delete neurons
```

**Signal sources:**

- **Automatic** — Neurons emit signals on: high dismissal rate (>80%), low query relevance (avg < 0.3), low confidence (avg < 0.3), observation stagnation.
- **Coverage gaps** — Queries where all neurons score low relevance. Also: injection batches dismissed by all neurons.
- **Developer** — `brain.signal({ source, description })` with custom signals from your application.

## Evolution Config

```typescript
evolution: {
  enabled: true,                    // Master switch (default: true)
  model: openai('gpt-4o'),         // Evaluation model (falls back to brain.model)
  evaluatorSignalThreshold: 5,      // Signals before auto-evaluation (default: 5)
  autoEvaluate: true,               // Auto-trigger on threshold (default: true)
  coverageGap: {
    relevanceThreshold: 0.3,        // Below this = "not relevant" (default: 0.3)
    gapCountThreshold: 5,           // Gaps before signaling (default: 5)
    windowSize: 20,                 // Rolling window (default: 20)
  },
}
```

## Manual Control

```typescript
// Inject custom signal
brain.signal({
  source: 'analytics',
  description: 'Users asking about deployment patterns but no neuron covers it',
})

// Force immediate evaluation (bypass threshold)
brain.signal({
  source: 'admin',
  description: 'Restructure neurons for new product direction',
  bypass: true,
})

// Manually trigger evaluation
const { decisions } = await brain.evaluateEvolution()

// Dry run — see what the evaluator would decide without executing
const { decisions: preview } = await brain.evaluateEvolution({ dryRun: true })

// Stream evolution evaluation
const { stream, decisions } = await brain.evaluateEvolutionStream({ dryRun: true })

for await (const part of stream.fullStream) {
  // See evaluator tool calls: inspectSpecialist, querySpecialist, finalizeDecisions, etc.
}

const { decisions: d, results } = await decisions // resolves after stream completes
```

The evaluator is an LLM agent with tools to inspect neurons, query their knowledge, consult [internal neurons](./brain#consulting-internal-neurons) (gap tracking, cross-domain patterns), review dismissed data, and review past decisions — all before making structural choices.

## Evolution vs Basic Neuron Management

| Operation | Requires Evolution | What happens |
|---|---|---|
| `addNeuron(config)` | No | Add neuron with explicit config |
| `removeNeuron(id)` | No | Remove neuron and dispose store |
| `adjustNeuron(id, directive)` | No | LLM-driven incremental steering |
| `createNeuron(guidance)` | Yes | LLM designs the neuron from natural language |
| `deleteNeuron(id)` | Yes | Delete via evolution system |
| `mergeNeurons(ids, guidance)` | Yes | Merge 2+ neurons into one |
| `splitNeuron(id, guidance)` | Yes | Split neuron into multiple |
| `updateNeuron(id, guidance)` | Yes | LLM-driven config update |

## When to Enable/Disable

**Enable** (default) when the Brain is long-lived and the domain may shift over time. Evolution lets the system adapt — creating neurons for uncovered domains, merging overlaps, splitting overloaded neurons — without you having to monitor and restructure manually.

**Disable** when the neuron structure is known upfront and shouldn't change. For example: session-scoped brains that process a single conversation, or brains with carefully hand-crafted neurons where automatic restructuring would be counterproductive.

```typescript
// Long-term brain: let it evolve
const clientBrain = await Brain.create({
  prompt: '...',
  model,
  evolution: { enabled: true },
})

// Session brain: fixed structure
const sessionBrain = await Brain.create({
  prompt: '...',
  model,
  evolution: { enabled: false },
  autoSetup: false,
  neurons: [...],
})
```
