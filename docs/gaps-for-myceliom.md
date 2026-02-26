# Brain Improvements for Mycelium

Mapped to use cases from the [MEMORY-EVAL doc](../../mycelium/docs/MEMORY-EVAL.md).

---

## Core Idea: Internal Learners

Brain already has learners as its universal primitive — observe, understand, query. The gap isn't missing features; it's that learners are only used in one place (external data injection). Most of what Mycelium needs is solved by reusing learners in new contexts.

**Internal learners** are regular `TextLearner`/`ListLearner` instances that:

- Are NOT exposed via `brain.inject()` / `brain.ask()` — they're Brain's own
- Are created by Brain during init (configurable)
- Receive data from Brain operations (injection results, queries, learner events)
- Can be queried by Brain internally (consult) for evolution decisions, ask enrichment, or explicit developer access
- Persist via their own stores, go through observe → understand like any learner
- Participate in evolution like any learner

This is not a new system. It's the same learner primitive wired to different data sources.

---

## 1. Injection-Time Coverage Gap Signal

**Problem:** When data arrives that no learner finds relevant, it's silently dismissed. The existing coverage gap signal is query-windowed only (`checkCoverageGap` in `brain.ask()`). New topics are invisible until enough queries fail.

**What exists:**

- `inject()` collects `LearnOutput` from each learner — status `'observe:dismissed'` is already returned
- Results are emitted via `brain:inject:batch:completed` but never analyzed
- No per-injection gap check

**What to build:** After each injection batch, if ALL learners dismissed the data, emit a coverage gap signal.

**Mechanism:**

- After `learnerResults` are collected in `inject()` ([class.ts:559-567](src/brain/class.ts#L559-L567)), check if every result has `status === 'observe:dismissed'`
- If so:

  ```typescript
  this.signal({
    source: 'brain:coverage',
    description: 'Injected data dismissed by all learners: <batch summary>',
  })
  ```

- Configurable: `evolution.coverageGap.onInject: boolean` (default: true)

**Mycelium use cases:**

- **#1 "Three threads pulling"** — new thread emerges, no existing learner covers it → signal fires → evaluator creates a new learner
- **#10 "Saved 4 local-first tools"** — new topic arrives, repeated dismissals accumulate signals → new learner created

---

## 2. Queries as Learner Input

**Problem:** Queries are purely extractive. When a user asks something, no learner learns from it. The gap between what users ask and what learners know is invisible.

**What exists:**

- `ask()` already queries all learners, gets relevance/confidence/insight
- `checkCoverageGap()` exists but is windowed (default: 5 gaps in 20 queries). Setting `windowSize: 1, gapCountThreshold: 1` gives per-query detection, but the signal lacks query context
- `learner.learn()` accepts `unknown[]` — can already receive any data including queries

**What to build:** After `brain.ask()`, feed the query + responses back through learners via `learn()`.

**Mechanism:**

- After `ask()` completes synthesis, optionally call `learner.learn()` on each learner with:

  ```typescript
  { type: 'query', question: query, response: result.insight, learnerRelevance: X }
  ```

- Learners process this through their normal observe → understand pipeline
- Learners that found the query relevant will incorporate it; others will dismiss it (below `minImportance`)
- Also pass query context into `checkCoverageGap()` so the signal includes what was asked
- Configurable: `learning.observeQueries: boolean` (default: false)

**Feeds into internal learners too:** An internal learner tracking query patterns (see §3) receives ALL queries — building understanding of what users ask, how often, what gaps exist.

**Mycelium use cases:**

- **#3 "What have I been avoiding?"** — queries about neglected topics become observations; learners build understanding of "user keeps asking about X"
- **#6 "You've been here before"** — query patterns are data; a behavioral learner sees "user asked about energy 3 times this week"
- **#10 "Still exploring or decided?"** — query frequency informs learner understanding of user intent
- **#11 "Same gesture means different things"** — query patterns (what, when, how often) are behavioral data

---

## 3. Internal Learners — Specific Roles

Brain spins up internal learners during init. Each is a standard learner wired to a different data source. Configurable: `internalLearners: { [role]: boolean | config }`.

### 3a. Global Understanding

An internal `TextLearner` that gives Brain its own growing understanding — a knowledge layer above individual learners.

Each learner knows its own domain. Brain's global understanding is what Brain itself knows by looking at the whole picture. Not "how do learner A and B relate" but "what do I understand about everything my learners have learned, taken together."

**Data source:** Listens to `learner:synthesized` events where `significance !== 'confirms'`. When any learner's understanding changes meaningfully, this internal learner receives:

```typescript
{ learnerId, summary: await learner.getSummary(), significance, evolution }
```

via its own `learn()` call. Over time, it builds an increasingly rich understanding by continuously absorbing what all learners know.

**What it builds:** Brain's own persistent, growing understanding of the world — synthesized from all learner knowledge. This includes cross-domain connections, overarching themes, tensions, and patterns that no single learner can see. Uses `decay` governance (current understanding detailed, historical compresses gradually).

**How Brain uses it:**

- `brain.ask()` synthesis includes this understanding as additional context — Brain answers from its own knowledge, not just by stitching learner responses together
- Evolution evaluator uses it for richer decision-making
- Survives individual learner governance compression — even if a learner prunes a detail, Brain's global understanding may have already absorbed it

**Mycelium use cases:**

- **#1 "Three threads pulling"** — tracks "here are the active threads across learners and how they relate"
- **#4 "Wedding + Daylight Computer"** — cross-domain connections survive individual learner compression
- **#6 "You've been here before"** — notices "builder thread and recovery thread are in tension"
- **#7 "Five names, same idea"** — tracks continuity: "idea in learner X also appearing in learner Y under different name"
- **#8 "A quote connected to nothing"** — identifies significant items that don't connect to any learner's main narrative

### 3b. Query Pattern Tracker

An internal `ListLearner` that tracks what users ask.

**Data source:** Receives every query from `brain.ask()`:

```typescript
{ question: query, relevantLearners: [...], gaps: [...], timestamp }
```

**What it builds:** LLM-generated schema tracking query topics, frequency, clusters, coverage gaps, recurring themes. The ListLearner's schema generation reasons about the domain ("tracking query patterns") and produces appropriate fields.

**How Brain uses it:**

- Evolution evaluator consults it: "what are users repeatedly asking that no learner covers?"
- Feeds into coverage gap decisions with rich context (not just "X of Y queries had low relevance")

**Mycelium use cases:**

- **#3 "What have I been avoiding?"** — tracks query topics and gaps over time
- **#10 "Still exploring or decided?"** — query clustering reveals intent
- **#11 "Same gesture means different things"** — query tempo and patterns

### 3c. Coverage Gap Learner

An internal `TextLearner` that accumulates and reasons about coverage gaps — what data is arriving or being asked about that no learner covers.

**Prerequisite:** §1 extends the observer schema to produce `gaps: string[]` on dismissal. This learner consumes those gaps.

**Data sources:**

- **Injection gaps:** When all learners dismiss a batch during `inject()`, Brain collects their `gaps: string[]` from observer output and feeds them to this learner via `learn()`
- **Query gaps:** After `brain.ask()`, when all learners have low relevance, the existing `gaps` from query responses are fed to this learner

**What it builds:** Understanding of what topics, domains, and content types are consistently not covered by any learner. Deduplicates naturally through its observe → understand cycle (e.g., "10 articles about quantum computing dismissed" becomes one insight, not 10 entries).

**Signaling:** The gap learner signals when its understanding reveals meaningful patterns — replaces the need for windowed counters in Brain. No mechanical thresholds; the learner decides when a gap is significant enough to signal.

**Evaluator access:** Evaluator gets a tool to consult the gap learner: "what topics are consistently missed?" This gives the evaluator rich context for decisions (e.g., create a new learner for quantum computing).

**What this absorbs from §1:** Per-batch all-dismissed check in `inject()`, per-query gap routing from `ask()`, evaluator tool for gap inspection. These were deferred from §1 because they require internal learner infrastructure.

**Mycelium use cases:**

- **#1 "Three threads pulling"** — new thread emerges, no learner covers it → gap learner accumulates evidence → signals → evaluator creates a new learner
- **#3 "What have I been avoiding?"** — query gaps reveal neglected topics
- **#10 "Saved 4 local-first tools"** — repeated injection dismissals about a new topic → gap learner detects pattern

### 3d. Behavioral Monitor (optional)

An internal `ListLearner` that tracks Brain/learner system behavior.

**Data source:** Receives metrics from learner events:

```typescript
{ learnerId, dismissalRate, synthesisCount, queryCount, observationsSinceLastSynthesis }
```

**What it builds:** Understanding of system health patterns — which learners are stagnating, which are overloaded, tempo changes, anomalies.

**How Brain uses it:**

- Evolution evaluator consults it: richer context than raw metrics
- Can detect patterns like "learner X dismissal rate spiked after data type Y started arriving"

**Mycelium use cases:**

- **#2 "You're accelerating again"** — tempo awareness lives here (intake velocity tracking)
- **#12 "Silence as a valid response"** — signal quality judgment informed by behavioral context

---

## 4. Consult

Brain can query its internal learners. This is just `learner.query()` — no new API shape needed.

**Mechanism:**

- `brain.consult(query)` queries internal learners only, returns synthesized response
- `brain.ask()` optionally includes internal learner insights in synthesis (configurable)
- Evolution evaluator calls `consult()` to get richer context for decisions

**Why it's not redundant with brain.ask():**

- `brain.ask()` queries external learners (user-facing knowledge)
- `brain.consult()` queries internal learners (system self-knowledge)
- Different data, different purpose

**Mycelium use cases:**

- **#5 "You reflect extensively — just not here"** — consult the cross-learner understanding to get meta-level insight
- **#9 "Merge these, split that"** — developer consults Brain before making structural changes

---

## Implementation Order

1. **Observer gap reflections (§1)** — Extend observer dismissal output to include `gaps: string[]`. No dependencies. ✅ Done.
2. **Internal learners infrastructure** — Brain creates/manages internal learners during init. Separate from external learners in routing (inject/ask skip them). Stores, persistence, event wiring.
3. **Coverage gap learner (3c)** — Wire injection dismissals + query gaps → gap learner. Evaluator tool to consult it. Depends on §1 (gap reflections exist) and step 2 (infra).
4. **Cross-learner understanding (3a)** — Wire `learner:synthesized` → internal learner. Include in `ask()` synthesis.
5. **Queries as learner input (§2)** — Feed queries to external + internal learners via `learn()`.
6. **Consult method (§4)** — `brain.consult()` queries internal learners. Wire into evaluator.
7. **Query pattern tracker (3b)** and **Behavioral monitor (3d)** — additional internal learners, same infrastructure.
8. **Signal cleanup (post-§3)** — Convert mechanical learner signals (dismissal rate, etc.) to events; let internal learners own signaling.

Step 1 is independent. Steps 2-6 are the core. Steps 7-8 are follow-ups.

---

## What Changed From Previous Spec

The previous spec proposed 3 separate features with 3 different mechanisms. This spec has **one mechanism** (internal learners) that solves all of them:

| Previous                                                                     | Now                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Brain-level understanding via bespoke synthesis function + BrainState field  | Internal TextLearner (3a) — same observe → understand pipeline               |
| Queries as observations via custom post-ask injection                        | Just `learn()` on internal + external learners (§2)                          |
| "Internal meta-learners — NOT in scope"                                      | They ARE the scope — the whole point                                         |
| "Consult method — NOT in scope, redundant"                                   | The interface to internal learners (§4)                                      |
| 3 separate mechanisms to implement                                           | 1 primitive reused in 3 places                                               |
