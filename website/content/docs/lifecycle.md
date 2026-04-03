---
title: Lifecycle
description: How Brain executes from initialization through learning — the event flow, phases, and timing.
---

When you call `brain.init()` followed by `brain.inject()`, a predictable sequence of events unfolds. This page describes that sequence — what happens, in what order, and why. Understanding the lifecycle is especially useful if you're building real-time UIs on top of Brain events, debugging timing issues, or reasoning about performance.

For the full list of events and their payloads, see [Events](./events). This page focuses on *flow*, not individual event shapes.

## Overview

A Brain's lifecycle has two main phases:

```text
BIRTH                          LEARN (repeats per source)
─────                          ─────
 Config generation              Observe (parallel)
 Neuron setup (sequential)      Synthesize
 Internal neuron setup          Internal cascade
 Ready                          Evolve (optional)
```

Birth happens once. Learning repeats every time you call `inject()`.

## Birth

When you call `brain.init()`, the Brain goes through three stages:

### 1. Config generation

The Brain sends your prompt to an LLM, which decomposes it into neuron configurations — deciding how many neurons to create, what type each should be (Text or List), and what instructions each should have.

```text
brain:init:started
brain:init:config:generating
brain:init:config:generated          → N neuron configs
```

This typically takes 2–4 seconds. If you provide explicit neuron configs via `learners` in your BrainConfig, this step is skipped.

### 2. Neuron setup

Each neuron is initialized **sequentially** — the Brain creates them one at a time. Each neuron generates its own system prompt and cognitive tools during init, which requires an LLM call.

```text
neuron:init:started                  → neuron 1
neuron:init:completed                → 4–10s
brain:neuron:added                   → neuron 1 visible

neuron:init:started                  → neuron 2
neuron:init:completed                → 4–10s
brain:neuron:added                   → neuron 2 visible
```

`brain:neuron:added` fires after each neuron completes — this is when the neuron becomes visible to the outside world. If you're building a UI, this is the event to show a new neuron appearing.

### 3. Internal neuron setup

After all user-facing neurons are ready, the Brain initializes its four [internal neurons](./concepts#internal-neurons) (Global Understanding, Global Query Understanding, Injection Gaps, Query Gaps). These are also initialized sequentially but do **not** emit `brain:neuron:added` — they're internal to the Brain.

```text
neuron:init:started                  → internal neuron 1
neuron:init:completed                → 3–8s
neuron:init:started                  → internal neuron 2
neuron:init:completed                → 3–8s
neuron:init:started                  → internal neuron 3
neuron:init:completed                → 3–8s
neuron:init:started                  → internal neuron 4
neuron:init:completed                → 3–8s

brain:init:completed                 → Brain is ready
```

**Total birth time** depends on neuron count and LLM latency. Expect 30–60 seconds for a typical Brain with 2–3 neurons.

## Learning

Each call to `brain.inject()` feeds data through the observe → synthesize pipeline. The Brain processes injections in **batches**, and each batch follows the same pattern.

### The injection cycle

```text
brain:inject:started
 └─ Batch 1 ─────────────────────────────────────
     neuron:observe:started (×N)        ← parallel
     neuron:observe:thinking            ← per neuron
     neuron:observed                    ← observation recorded
     neuron:synthesize:started          ← begins when observe completes
     neuron:synthesized                 ← understanding updated
     neuron:health:updated              ← always follows synthesize
     brain:inject:batch:completed

 └─ Batch 2 (internal cascade) ──────────────────
     neuron:observe:started (×M)        ← internal neurons
     neuron:synthesize:started
     neuron:synthesized
     neuron:health:updated
     neuron:query:started               ← internal global query
     brain:inject:batch:completed

brain:inject:completed
```

Key things to notice:

**Observe is parallel.** All neurons in a batch begin observing at the same time. Each neuron independently decides what's relevant and buffers its observations.

**Synthesize follows observe.** As soon as a neuron finishes observing, it checks whether its buffer has enough observations to trigger synthesis. If so, synthesis starts immediately — it doesn't wait for other neurons to finish observing.

**`neuron:health:updated` always follows `neuron:synthesized`.** Every synthesis updates the neuron's health metrics (activation level, status). This is a reliable pair.

**Internal neurons run in a second batch.** After the user-facing neurons process the data, internal neurons (like Global Understanding) observe the updated state of the system and synthesize their own meta-knowledge. This is why you often see two batches per injection.

### The async cascade

Internal neurons use queries to gather knowledge from user-facing neurons. These queries are **asynchronous** — they often complete during the *next* injection rather than the current one:

```text
Injection 1:
  ... neuron:synthesized
  neuron:query:started               ← internal query begins
  brain:inject:completed             ← injection finishes, query still running

Injection 2:
  brain:inject:started
  neuron:observe:started (×N)
  neuron:query:completed             ← previous query finishes mid-injection
  neuron:observe:started             ← internal neuron re-observes with new data
  ...
```

This overlap is normal. Internal queries don't block injections — they complete in the background and feed their results into the next batch. If you're tracking events in a UI, you'll see query completions from prior injections interleaved with the current one.

### Evolution signals

During injection, neurons may emit signals indicating structural problems — high dismissal rates, coverage gaps, or low relevance. When a signal fires, you'll see:

```text
neuron:synthesized
brain:signal:received                ← evolution signal
neuron:health:updated
```

Signals accumulate in a buffer. When enough signals build up (configurable threshold, default 5), the evaluator triggers automatically and may restructure the Brain. See [Evolution](./evolution) for details.

## Timing expectations

These are rough ranges based on typical LLM latency. Actual times vary by model, provider, and data volume.

| Phase | Typical duration |
|---|---|
| Config generation | 2–4s |
| Per neuron init | 3–10s |
| Full birth (2–3 neurons) | 30–60s |
| Observe (per batch) | 2–4s |
| Synthesize (per neuron) | 2–10s |
| Internal query | 3–6s |
| Single injection | 8–30s |

The largest variance comes from synthesis — a neuron integrating many observations into a complex understanding takes longer than one processing routine data. Injections with evolution signals also take longer, as synthesis may trigger restructuring.

## Putting it together

Here's a complete timeline for a Brain with 2 neurons processing 3 data sources:

```text
BIRTH ──────────────────────────────────────────
  0s   brain:init:started
  0s   brain:init:config:generating
  3s   brain:init:config:generated          → 2 neurons
  3s   neuron:init (×2 sequential)          → ~12s
 15s   brain:neuron:added (×2)
 15s   internal neuron:init (×4 sequential) → ~20s
 35s   brain:init:completed

INJECTION 1 ────────────────────────────────────
 35s   brain:inject:started
 35s   neuron:observe (×2 parallel)
 37s   neuron:synthesize → neuron:health:updated
 44s   neuron:query:started (internal)
 44s   brain:inject:completed

INJECTION 2 ────────────────────────────────────
 44s   brain:inject:started
 44s   neuron:observe (×2 parallel)
 48s   neuron:query:completed (from injection 1)
 48s   internal neuron re-observes
 50s   neuron:synthesize → neuron:health:updated
 55s   brain:signal:received (maybe)
 58s   brain:inject:completed

INJECTION 3 ────────────────────────────────────
 58s   brain:inject:started
       ... same pattern ...
 68s   brain:inject:completed
```

The pattern is consistent: **birth is sequential, learning is parallel with async internal cascades.** Once you internalize this flow, Brain event logs become easy to read.
