# Internal Learners Specification

> **Status:** Design Specification
> **Version:** 1.0
> **Date:** 2026-03-04

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Internal Learner Definitions](#3-internal-learner-definitions)
4. [Dismissed Batch Buffer](#4-dismissed-batch-buffer)
5. [Data Wiring](#5-data-wiring)
6. [Direct Evolution Trigger](#6-direct-evolution-trigger)
7. [Consult API](#7-consult-api)
8. [Ask Integration](#8-ask-integration)
9. [Configuration](#9-configuration)
10. [Implementation Order](#10-implementation-order)

---

## 1. Overview

### 1.1 Core Idea

Brain already has learners as its universal primitive — observe, understand, query. **Internal learners** are regular `TextLearner`/`ListLearner` instances that Brain creates and manages for its own self-knowledge. They are not exposed via `brain.inject()` or `brain.ask()` — they receive data from Brain's own operations and are queryable via `brain.consult()` and as tools during ask synthesis.

This is not a new system. It's the same learner primitive wired to different data sources.

### 1.2 Principles

- Internal learners are **regular learners** — same lifecycle, same observe → understand pipeline, same persistence
- They are **invisible to external APIs** — `inject()` and `ask()` skip them
- They are **protected from evolution** — the evaluator can read/consult them but never modify, delete, or merge them
- They are **fixed** — Brain always has the same set of internal learners (configurable on/off)

---

## 2. System Architecture

### 2.1 Separate Maps

Brain maintains two separate learner maps:

```typescript
readonly learners: Map<string, BaseLearner<unknown>>          // external
readonly internalLearners: Map<string, BaseLearner<unknown>>  // internal
```

- `getLearners()` returns external learners only (used by `inject()`, `ask()`)
- Internal learners have their own accessor (used by `consult()`, evaluator)
- No shared iteration — the two sets never mix in routing

### 2.2 Separate Store Namespace

`BrainStore` gets a new namespace:

```typescript
interface BrainStore {
	state: KeyValueStore
	learners: CollectionStore<{ id: string; type: string }>
	internalLearners: CollectionStore<{ id: string; type: string }>  // new
	evolution: CollectionStore<EvolutionRecord>
	dismissedBatches: CollectionStore<DismissedBatch>                // new (see §4)
}
```

Internal learner metadata (`{ id, type }`) is persisted separately from external learners. Each internal learner's own store (observations, understanding, state) uses the same `learnerStoreFactory` as external learners.

### 2.3 Lifecycle

Same as external learners:

- **Init:** If persisted internal learners exist in `store.internalLearners`, restore them. If not, create them from defaults.
- **Runtime:** Receive data via `learn()`, go through observe → understand, persist via their own stores.
- **Dispose:** Cleaned up on `brain.dispose()` like any learner.

No special sequencing — internal and external learners are initialized the same way.

---

## 3. Internal Learner Definitions

Brain has five fixed internal learners:

### 3a. Global Injection Understanding

- **Type:** `TextLearner`
- **Purpose:** Brain's own cross-domain understanding of what it knows from ingested data. Synthesized from all external learner knowledge.
- **Data source:** `learner:synthesized` events from external learners (where `significance !== 'confirms'`). Receives `{ learnerId, summary, significance, evolution }`.
- **What it builds:** Cross-domain connections, overarching themes, tensions, and patterns that no single learner can see. Uses `decay` governance (current understanding detailed, historical compresses gradually).
- **How it's used:**
  - Available as a tool in `ask()` synthesis (`consultGlobalUnderstanding`)
  - Evaluator consults it for richer evolution decisions
  - Survives individual learner governance compression

### 3b. Global Query Understanding

- **Type:** `ListLearner`
- **Purpose:** Tracks what users ask — query topics, frequency, clusters, coverage gaps, recurring themes.
- **Data source:** Every `brain.ask()` call. Receives `{ question, relevantLearners, gaps, timestamp }`.
- **What it builds:** LLM-generated schema tracking query patterns. The ListLearner's schema generation reasons about the domain ("tracking query patterns") and produces appropriate fields.
- **How it's used:**
  - Available as a tool in `ask()` synthesis (`consultQueryPatterns`)
  - Evaluator consults it: "what are users repeatedly asking that no learner covers?"

### 3c. Injection Gap Learner

- **Type:** `TextLearner`
- **Purpose:** Accumulates and reasons about injection gaps — data arriving that no external learner covers.
- **Data source:** When all external learners dismiss a batch in `inject()`, receives `{ batchId, gaps, timestamp }` where `gaps` are the `gaps: string[]` from each learner's dismissal output.
- **What it builds:** Understanding of what topics and content types are consistently not covered. Deduplicates naturally through observe → understand (e.g., "10 articles about quantum computing dismissed" becomes one insight).
- **How it's used:**
  - Evaluator consults it: "what topics are consistently missed?"
  - Brain may trigger direct evolution when dismissed batches are persisted (see §6)

### 3d. Query Gap Learner

- **Type:** `TextLearner`
- **Purpose:** Accumulates gaps from queries that external learners couldn't answer well.
- **Data source:** After `brain.ask()`, when all external learners have low relevance, receives `{ question, gaps, timestamp }`.
- **What it builds:** Understanding of what questions are consistently unanswerable — accumulates at its own pace (higher batch threshold than injection gaps).
- **How it's used:**
  - Evaluator consults it for coverage decisions
  - Available as a tool in `ask()` synthesis (`consultQueryGaps`)

### 3e. ~~Behavioral Monitor~~ — Dropped

System health metrics (dismissal rates, synthesis counts, etc.) are better handled by simple metrics/thresholds, not a learner. Not included.

---

## 4. Dismissed Batch Buffer

### 4.1 Purpose

When all external learners dismiss an injection batch, Brain persists the original input data so it can be re-injected after evolution creates a new learner to handle it.

### 4.2 Schema

```typescript
interface DismissedBatch {
	batchId: string            // existing batch ID from inject()
	data: unknown[]            // original raw input items
	gaps: string[]             // gap strings from learner dismissals
	timestamp: Date
	retryCount: number         // starts at 0
	status: 'pending' | 'retried'
}
```

### 4.3 Buffer Management

- **Storage:** `store.dismissedBatches` (new namespace in BrainStore)
- **Size cap:** Configurable max number of batches (default: 100). When full, oldest batches are evicted first.
- **Cleanup after re-injection:** If re-injected batch is accepted by a learner, remove from buffer. If dismissed again, keep it but increment `retryCount` and set status to `'retried'`.
- **Batch ID as reference:** The `batchId` travels through the entire pipeline — gap learner observations, evolution signals, re-injection — as the reference to look up original data.

---

## 5. Data Wiring

Hardcoded in Brain — no declarative event mapping needed since internal learners are fixed.

### 5.1 Injection Flow

In `inject()`, after each batch completes (line 559-567 area):

```
learnerResults collected
  → check: all results have status === 'observe:dismissed'?
  → if yes:
    1. Persist dismissed batch to store.dismissedBatches
    2. Collect gaps from all learner results
    3. Call injectionGapLearner.learn([{ batchId, gaps, timestamp }])
    4. Optionally trigger direct evolution (see §6)
```

### 5.2 Ask Flow

In `ask()`, after learner queries complete:

```
learnerResults collected
  → feed globalQueryUnderstanding.learn([{ question, relevantLearners, gaps, timestamp }])
  → check: all learners have low relevance?
  → if yes:
    1. Call queryGapLearner.learn([{ question, gaps, timestamp }])
```

### 5.3 Synthesis Events

Brain listens to `learner:synthesized` from external learners:

```
event fires with significance !== 'confirms'
  → call globalInjectionUnderstanding.learn([{ learnerId, summary, significance, evolution }])
```

---

## 6. Direct Evolution Trigger

### 6.1 Method

```typescript
brain.triggerEvolution(signal: EvolutionSignal): Promise<void>
```

Bypasses the signal buffer and sends the signal directly to the evaluator. Same evaluator, same logic — the signal is just richer (includes batch IDs, gap descriptions, context from internal learners).

### 6.2 When Brain Calls It

Brain decides when to trigger direct evolution. For injection gaps, this happens right after persisting a dismissed batch — Brain calls `triggerEvolution` with a signal containing the batch ID, gap descriptions, and any relevant context.

### 6.3 Re-injection After Evolution

After evolution creates a new learner:

1. Brain is notified (via existing evolution events)
2. Brain looks up pending dismissed batches in `store.dismissedBatches`
3. Brain re-injects them into the new learner
4. If accepted → remove from buffer
5. If dismissed again → increment `retryCount`, set status to `'retried'`

Re-injection is **Brain's responsibility**, not the evaluator's. The evaluator's job is purely: receive signal → decide action (e.g., create learner).

---

## 7. Consult API

### 7.1 Interface

```typescript
// Query all internal learners, synthesize response
brain.consult(query: string): Promise<ConsultResult>

// Query a specific internal learner
brain.consult(query: string, { learner: string }): Promise<ConsultResult>
```

- Works like `ask()` scoped to internal learners
- When targeting all: queries all internal learners in parallel, synthesizes
- When targeting one: queries that specific internal learner, returns directly (no synthesis needed)

### 7.2 Evaluator Access

The evaluator can call `brain.consult()` to get richer context for evolution decisions. For example:

- "What topics are consistently missed?" → consults injection gap learner
- "What are users repeatedly asking?" → consults global query understanding
- "What cross-domain patterns exist?" → consults global injection understanding

---

## 8. Ask Integration

### 8.1 Tools in Synthesis

Each internal learner is exposed as a **named tool** in the `ask()` synthesis step:

- `consultGlobalUnderstanding` — queries the Global Injection Understanding learner
- `consultQueryPatterns` — queries the Global Query Understanding learner
- `consultInjectionGaps` — queries the Injection Gap Learner
- `consultQueryGaps` — queries the Query Gap Learner

### 8.2 Usage Instructions

The synthesis LLM is instructed:

- **Do not use these tools as primary sources.** First work with external learner responses.
- **Use when:** External learners didn't fully answer the query, or the query implies cross-referencing knowledge across domains.
- The tools are always available — the LLM decides relevance.

---

## 9. Configuration

### 9.1 Config Shape

```typescript
interface BrainConfig {
	// ... existing config ...
	internalLearners?: {
		globalInjectionUnderstanding?: boolean | LearnerConfig
		globalQueryUnderstanding?: boolean | LearnerConfig
		injectionGaps?: boolean | LearnerConfig
		queryGaps?: boolean | LearnerConfig
	}
	dismissedBatchBuffer?: {
		maxSize?: number  // default: 100
	}
}
```

- `true` = enabled with default learner config
- `LearnerConfig` = enabled with custom settings (batch size, models, governance, etc.)
- `false` = disabled
- All internal learners are **enabled by default**

### 9.2 Per-Learner Config

Each internal learner accepts the same config shape as any external learner. For example, configuring the injection gap learner to react quickly:

```typescript
{
	internalLearners: {
		injectionGaps: { observer: { batchSize: 1 } },
		queryGaps: { observer: { batchSize: 10 } },
	}
}
```

---

## 10. Implementation Order

1. **BrainStore changes** — Add `store.internalLearners` and `store.dismissedBatches` namespaces. Update `MemoryBrainStore` and `SQLiteBrainStore`.
2. **Brain class: two maps** — Add `this.internalLearners` map, separate from `this.learners`. Ensure `getLearners()` returns external only. Init/restore/dispose internal learners.
3. **Config** — Add `internalLearners` and `dismissedBatchBuffer` to `BrainConfig`. Wire defaults.
4. **Dismissed batch buffer** — Persist dismissed batches in `inject()` when all learners dismiss. Size-based eviction. Retry tracking.
5. **Internal learner creation** — Create the five internal learners during init with appropriate prompts/configs. Persist metadata to `store.internalLearners`.
6. **Data wiring** — Hardcode the feeds: injection dismissals → injection gap learner, ask queries → global query understanding, low-relevance queries → query gap learner, synthesis events → global injection understanding.
7. **`brain.triggerEvolution(signal)`** — Direct evaluator entry point bypassing buffer.
8. **Re-injection flow** — After evolution creates a learner, Brain re-injects pending dismissed batches.
9. **`brain.consult()`** — Query internal learners (all or specific).
10. **Ask synthesis tools** — Add per-internal-learner tools to the ask synthesis step with secondary-use instructions.
11. **Evolution protection** — Ensure evaluator can consult but never modify/delete/merge internal learners.
