# Evolution Mechanics Fixes Specification

> **Status:** Design Specification
> **Version:** 1.0
> **Date:** 2026-02-17
> **References:** [living-brain.spec.md](living-brain.spec.md), [manual-testing-feedback.md](../manual-testing-feedback.md)

## Table of Contents

1. [Overview](#1-overview)
2. [Fix: Confidence Semantics Split](#2-fix-confidence-semantics-split)
3. [Fix: Auto-Evaluate Execution Pipeline](#3-fix-auto-evaluate-execution-pipeline)
4. [Fix: Metrics Restructure](#4-fix-metrics-restructure)
5. [Fix: Stagnation Threshold](#5-fix-stagnation-threshold)
6. [New: Brain-Level Coverage Gap Signal](#6-new-brain-level-coverage-gap-signal)
7. [New: Learner-Level Gap Accumulation Signal](#7-new-learner-level-gap-accumulation-signal)
8. [Removal: Dead successRate Field](#8-removal-dead-successrate-field)
9. [Updated Signal System Summary](#9-updated-signal-system-summary)
10. [Implementation Order](#10-implementation-order)

---

## 1. Overview

Manual testing (sessions 1-5) revealed that the evolution pipeline is broken at every stage:

- **Detection**: Confidence semantics are inverted (#22/#26), stagnation threshold is unreachable (#32), coverage gaps are undetected (#24)
- **Data**: Metrics are hidden (#27), `successRate` is dead code (#23), no query/ingestion separation
- **Execution**: Auto-evaluate generates decisions but never executes them (#29)

This spec addresses all three layers while introducing two new signal types identified during testing.

### Issues Addressed

| Issue # | Severity | Summary |
|---------|----------|---------|
| #22/#26 | Critical | Confidence = 1.0 on "I can't help" responses; inverts signal model |
| #29 | Critical | Auto-evaluate decisions are generated but never executed |
| #23 | Medium | `successRate` is dead code, misleads evaluator |
| #24 | Medium | Query gaps accumulated but never tracked or surfaced |
| #27 | Medium | Dismissal counters are private, not exposed via API |
| #32 | Low | Stagnation threshold (100) is practically unreachable |

---

## 2. Fix: Confidence Semantics Split

### Problem

The LLM interprets confidence as "certainty about my response." When a learner is certain it cannot help, it reports `confidence: 1.0`. The signal system expects confidence to mean "how well could I answer" — so the signal (`< 0.3`) never fires on failures, and in-scope queries produce *lower* confidence than out-of-scope ones.

### Solution

Split the single `confidence` field into two independent fields:

```typescript
interface QueryResponse {
  relevance: number    // 0.0-1.0: How related is this query to my domain/purpose?
                       // 0.0 = completely outside my scope
                       // 1.0 = core to what I do
  confidence: number   // 0.0-1.0: How well could I answer from my understanding?
                       // 0.0 = I have nothing on this
                       // 1.0 = I fully and completely answered
  insight: string
  gaps: string[]
}
```

### Changes Required

**1. Query schema (both direct and tool-based methods)**

Update Zod schema descriptions to be explicit:

```typescript
// Direct method schema
const queryResponseSchema = z.object({
  relevant: z.boolean().describe(
    'Is this query within your area of expertise/purpose?'
  ),
  relevance: z.number().min(0).max(1).describe(
    'How related is this query to your domain/purpose? 0.0 = completely outside your scope, 1.0 = core to what you do'
  ),
  confidence: z.number().min(0).max(1).describe(
    'How well could you answer this from your understanding? 0.0 = you have nothing on this topic, 1.0 = you fully answered the question. If the query is outside your scope, this should be 0.0'
  ),
  insight: z.string().describe('Your answer based on your understanding'),
  gaps: z.string().describe('What you could not answer (empty if none)'),
})
```

The `relevant` boolean is kept for backwards compatibility and fast filtering. `relevance` adds the continuous score.

**2. Tool-based schemas (`complete/schema.ts`, `generate-response/schema.ts`)**

Same field split with explicit descriptions.

**3. Signal thresholds**

Two independent thresholds, two independent signals:

```typescript
signalThresholds: {
  // Existing (renamed for clarity)
  maxDismissalRate: number              // Default: 0.8

  // Replaced — was single minConfidence
  minRelevance: number                  // Default: 0.3 — fires when avg relevance < threshold
  minConfidence: number                 // Default: 0.3 — fires when avg confidence < threshold

  // Existing (updated default)
  maxObservationsWithoutSynthesis: number  // Default: 3 * maxObservations
}
```

**4. Signal detection in `checkAndEmitSignals()`**

```typescript
// Track separately
private queryRelevanceScores: number[] = []
private queryConfidenceScores: number[] = []

// After each query:
this.queryRelevanceScores.push(result.relevance)
this.queryConfidenceScores.push(result.confidence)

// Keep rolling window of last 10
if (this.queryRelevanceScores.length > 10) this.queryRelevanceScores.shift()
if (this.queryConfidenceScores.length > 10) this.queryConfidenceScores.shift()

// Check relevance signal (independent)
if (this.queryRelevanceScores.length >= 5) {
  const avgRelevance = avg(this.queryRelevanceScores)
  if (avgRelevance < this.governance.signalThresholds.minRelevance) {
    this.emit('learner:signal', {
      learnerId: this.id,
      description: `Low relevance: avg ${avgRelevance.toFixed(2)} over last ${this.queryRelevanceScores.length} queries`,
      timestamp: new Date(),
      metrics: { avgRelevance },
    })
  }
}

// Check confidence signal (independent)
if (this.queryConfidenceScores.length >= 5) {
  const avgConfidence = avg(this.queryConfidenceScores)
  if (avgConfidence < this.governance.signalThresholds.minConfidence) {
    this.emit('learner:signal', {
      learnerId: this.id,
      description: `Low confidence: avg ${avgConfidence.toFixed(2)} over last ${this.queryConfidenceScores.length} queries — has knowledge gaps in its domain`,
      timestamp: new Date(),
      metrics: { avgConfidence },
    })
  }
}
```

**5. `AskResult` type update**

```typescript
export interface AskResult {
  relevant: boolean
  relevance: number   // NEW
  confidence: number  // FIXED semantics
  insight: string
  gaps: string[]
}
```

**6. Event payload update**

```typescript
'learner:query:completed': {
  learnerId: string
  insight: string
  relevant: boolean
  relevance: number   // NEW
  confidence: number  // FIXED semantics
  gaps: string[]
  usage: TokenUsage
}
```

---

## 3. Fix: Auto-Evaluate Execution Pipeline

### Problem

`evaluator.signal()` calls `this.evaluate()` which returns decisions and emits `evaluator:evaluation:completed`, but nobody executes the decisions. The manual path (`brain.evaluateEvolution()`) works because it calls evaluate + execute sequentially.

### Solution

Brain listens to the `evaluator:evaluation:completed` event and executes decisions. This keeps the evaluator decoupled from the brain.

### Changes Required

**In `Brain` constructor or initialization (where evaluator events are wired):**

```typescript
this.evaluator.on('evaluator:evaluation:completed', async (event) => {
  if (event.decisions.length > 0) {
    await this.executeEvolutionDecisions(event.decisions)
  }
})
```

**Guard against double execution:**

When `brain.evaluateEvolution()` is called manually, it already calls `this.evaluator.evaluate()` then `this.executeEvolutionDecisions()`. The event listener would also fire. To prevent double execution:

```typescript
// In brain.evaluateEvolution():
const decisions = await this.evaluator.evaluate()
// Skip event-based execution since we're handling it directly
await this.executeEvolutionDecisions(decisions, { source: 'manual' })

// In the event listener:
this.evaluator.on('evaluator:evaluation:completed', async (event) => {
  // Only auto-execute for signal-triggered evaluations
  if (event.source === 'auto' && event.decisions.length > 0) {
    await this.executeEvolutionDecisions(event.decisions, { source: 'auto' })
  }
})
```

The evaluator should include a `source` field in the event payload to distinguish auto-triggered from manually-triggered evaluations:

```typescript
'evaluator:evaluation:completed': {
  source: 'auto' | 'manual'
  decisionCount: number
  decisions: EvolutionDecision[]
}
```

---

## 4. Fix: Metrics Restructure

### Problem

Signal-tracking counters (`dismissalCount`, `observationCount`, `queryConfidences`) are private fields on TextLearner, not exposed via `getGovernance()` or the API. Metric naming doesn't distinguish query-time vs ingestion-time data. `successRate` is dead code that misleads the evaluator.

### Solution

Introduce a separate `LearnerMetrics` interface with explicit `ingestion` and `query` namespaces. Keep governance focused on state and config.

### New Types

```typescript
interface LearnerMetrics {
  ingestion: {
    observationCount: number          // Total observations received
    dismissalCount: number            // Total dismissed at observe phase
    dismissalRate: number             // Derived: dismissalCount / observationCount
    synthesisCount: number            // How many times synthesis ran successfully
    observationsSinceLastSynthesis: number  // For stagnation detection
  }
  query: {
    count: number                     // Total queries (replaces retrievalCount)
    relevanceScores: number[]         // Rolling window of last 10
    confidenceScores: number[]        // Rolling window of last 10
    gaps: string[]                    // Accumulated gap descriptions
  }
}
```

### Governance (Simplified)

```typescript
interface LearnerGovernance {
  activation: number          // 0.0-1.0 EMA
  threshold: number           // Gates participation
  status: LearnerStatus       // 'active' | 'dormant'
  lastAccessed: Date

  // Config only — no runtime counters
  signalThresholds: {
    maxDismissalRate: number
    minRelevance: number
    minConfidence: number
    maxObservationsWithoutSynthesis: number
  }
}
```

### Learner Interface Addition

```typescript
interface Learner<TUnderstanding = unknown> {
  // Existing
  getGovernance(): LearnerGovernance
  // New
  getMetrics(): LearnerMetrics
}
```

### Changes Required

1. Move private counters to a metrics object on TextLearner
2. Expose via `getMetrics()` method
3. Remove `retrievalCount` from governance (moved to `metrics.query.count`)
4. Remove `successRate` from governance (see section 8)
5. Update evaluator context builder to include metrics
6. Update API endpoints to expose metrics
7. Update event payloads that reference these fields

---

## 5. Fix: Stagnation Threshold

### Problem

Default `maxObservationsWithoutSynthesis: 100` is practically unreachable. With `maxObservations: 10`, a learner would need 100+ observations where synthesis triggers but produces no understanding change.

### Solution

Make the stagnation threshold relative to the synthesis buffer size:

```
defaultStagnationThreshold = 3 * maxObservations
```

This means "3 full synthesis cycles with no understanding change," regardless of buffer configuration.

### Changes Required

**Default calculation:**

```typescript
// When creating a learner, if no explicit stagnation threshold is set:
const defaultStagnationThreshold = 3 * (config.synthesize?.thresholds?.maxObservations ?? 10)
// Default: 3 * 10 = 30
```

**Still overridable** via `signalThresholds.maxObservationsWithoutSynthesis` in learner config.

**Update `lastSynthesisObservationCount` tracking:**

Currently `lastSynthesisObservationCount` is only updated on successful synthesis. This is correct — stagnation means "observations accepted, synthesis attempted, but no understanding change." No code change needed for the counter logic, only the default threshold.

---

## 6. New: Brain-Level Coverage Gap Signal

### Problem

When all learners return low relevance on a query, no signal fires. The brain cannot detect that users are repeatedly asking things no learner covers.

### Solution

Brain tracks coverage gaps after `brain.ask()` completes. Simple counter with threshold.

### Design

**Tracking state (on Brain):**

```typescript
private coverageGapCount = 0
private recentQueryCount = 0
private readonly coverageGapConfig = {
  relevanceThreshold: 0.3,   // Below this = "not relevant"
  gapCountThreshold: 5,      // Fire signal after N gaps
  windowSize: 20,            // In last N queries
}
```

**Detection (after `brain.ask()` collects all learner responses):**

```typescript
this.recentQueryCount++

const allLowRelevance = learnerResponses.every(
  r => r.relevance < this.coverageGapConfig.relevanceThreshold
)

if (allLowRelevance) {
  this.coverageGapCount++
}

// Reset window
if (this.recentQueryCount >= this.coverageGapConfig.windowSize) {
  if (this.coverageGapCount >= this.coverageGapConfig.gapCountThreshold) {
    this.signal({
      source: 'brain',
      description: `Coverage gap: ${this.coverageGapCount} of last ${this.recentQueryCount} queries had no relevant learner`,
    })
  }
  this.coverageGapCount = 0
  this.recentQueryCount = 0
}
```

### Configuration

```typescript
interface EvolutionConfig {
  enabled: boolean
  evaluatorSignalThreshold: number
  autoEvaluate: boolean
  // NEW
  coverageGap?: {
    relevanceThreshold?: number   // Default: 0.3
    gapCountThreshold?: number    // Default: 5
    windowSize?: number           // Default: 20
  }
}
```

---

## 7. New: Learner-Level Gap Accumulation Signal

### Problem

Every query response includes a `gaps` array describing what the learner couldn't answer. These gaps are returned but never tracked over time or fed into evolution.

### Solution

Each learner accumulates gaps in `metrics.query.gaps`. When gaps accumulate past a threshold, emit a signal with the accumulated gaps for the evaluator to analyze.

### Design

**Tracking (in TextLearner, after each query):**

```typescript
if (result.gaps && result.gaps.length > 0) {
  this.metrics.query.gaps.push(...result.gaps)

  // Cap at reasonable size
  if (this.metrics.query.gaps.length > 50) {
    this.metrics.query.gaps = this.metrics.query.gaps.slice(-50)
  }
}
```

**Signal emission (in `checkAndEmitSignals()`):**

```typescript
// Check gap accumulation
if (this.metrics.query.gaps.length >= this.governance.signalThresholds.minGapCount) {
  this.emit('learner:signal', {
    learnerId: this.id,
    description: `Knowledge gaps accumulating: ${this.metrics.query.gaps.length} gaps recorded. Recent gaps: ${this.metrics.query.gaps.slice(-5).join('; ')}`,
    timestamp: new Date(),
    metrics: { gapCount: this.metrics.query.gaps.length },
  })
  // Reset after signaling
  this.metrics.query.gaps = []
}
```

**Threshold config:**

```typescript
signalThresholds: {
  // ... existing
  minGapCount: number    // Default: 10 — emit signal after this many gaps accumulated
}
```

---

## 8. Removal: Dead successRate Field

### Problem

`successRate` is defined in `LearnerGovernance`, initialized to 0, read by the evaluator in its context, but never written to anywhere in the codebase.

### Changes Required

1. Remove `successRate` from `LearnerGovernance` interface
2. Remove initialization (`successRate: 0`) from TextLearner constructor
3. Remove from evaluator context builder (the template that feeds learner info to the evaluator LLM)
4. Remove any references in evaluator prompts

With the new `relevance` and `confidence` split, plus gap accumulation, success tracking is covered by richer, actually-functioning metrics.

---

## 9. Updated Signal System Summary

### Learner-Level Signals

| Signal | Metric Source | Threshold | Default | Description |
|--------|--------------|-----------|---------|-------------|
| High dismissal | `metrics.ingestion.dismissalRate` | `> maxDismissalRate` with 10+ obs | 0.8 | Learner rejects most observations |
| Low relevance | `metrics.query.relevanceScores` avg | `< minRelevance` over 5+ queries | 0.3 | Queries aren't in learner's domain |
| Low confidence | `metrics.query.confidenceScores` avg | `< minConfidence` over 5+ queries | 0.3 | Learner has knowledge gaps in its domain |
| Stagnation | `metrics.ingestion.observationsSinceLastSynthesis` | `> maxObservationsWithoutSynthesis` | `3 * maxObservations` | Understanding plateaued |
| Gap accumulation | `metrics.query.gaps.length` | `>= minGapCount` | 10 | Learner can't answer specific topics |

### Brain-Level Signals

| Signal | Metric Source | Threshold | Default | Description |
|--------|--------------|-----------|---------|-------------|
| Coverage gap | All learner relevance scores per query | N gaps in last M queries | 5 in 20 | No learner covers what users are asking |

### Signal → Evaluate → Execute Pipeline

```
Learner signals ──┐
                  ├──→ Evaluator buffer ──→ threshold crossed ──→ evaluate()
Brain signals ────┘                                                   │
                                                                      ▼
                                                        evaluator:evaluation:completed
                                                                      │
                                                              Brain listens (auto)
                                                                      │
                                                                      ▼
                                                        executeEvolutionDecisions()
```

---

## 10. Implementation Order

Suggested order based on dependencies:

1. **Metrics restructure** (section 4) — foundation for everything else
2. **Remove successRate** (section 8) — cleanup, no dependencies
3. **Confidence split** (section 2) — requires metrics in place
4. **Auto-evaluate fix** (section 3) — independent, can parallel with 2-3
5. **Stagnation threshold** (section 5) — small, independent
6. **Gap accumulation signal** (section 7) — requires metrics.query.gaps
7. **Coverage gap signal** (section 6) — requires relevance field from step 3

---

**End of Specification**
