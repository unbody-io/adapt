# Evaluator System — Audit & Analysis

## Context: How We Got Here

We were implementing the **internal learners** feature — specifically making the **injection gap learner** work end-to-end. The flow: all external learners dismiss a batch → gap learner observes it → gap learner synthesizes → evaluator is triggered → evaluator decides to create new learner(s) → new learners cover the gap.

During this work we hit several issues with the evaluator that we fixed incrementally:

1. **Duplicate learner creation** — The evaluator created 6 cooking learners because of a race condition: `isEvaluating` flipped to `false` before the evolution execution (learner creation) completed. The next evaluation started before the new learner existed. Fixed by adding `getRecentHistory()` tool and instructing the evaluator to check it.

2. **Signal loss during evaluation** — `this.signals = []` wiped ALL signals including ones arriving during the LLM call. Fixed with `this.signals.splice(0, consumedCount)`.

3. **Evaluator stuck in tool loops** — With `toolChoice: 'required'`, Gemini Flash mechanically cycled through investigation tools (getUnderstandings → getLearnerActivity → getUnderstandings → ...) without reasoning, never calling `finalizeDecisions`. Zero text output between steps. Fixed by switching to `toolChoice: 'auto'`, which let the model actually reason.

4. **Learner proliferation** — A single "create a cooking learner" decision produced 4 sub-learners (culinary-skills, recipe-catalog, culinary-preferences, cooking-techniques). The create handler's LLM was over-decomposing. Patched with "prefer ONE broad learner" guidance.

5. **Evaluator too conservative / too CREATE-biased** — After fixing duplicates, the evaluator swung to doing nothing (0 decisions across 12 evaluations). After fixing that, it only used CREATE and forgot about update/merge/split/delete. Each fix was a patch on the system prompt.

These incremental fixes kept accumulating in the prompt. We stepped back to audit the whole evaluator from first principles.

---

## 1. Signal Sources — When & Why Evaluation Triggers

There are **7 signal sources** that feed into the evaluator. They fall into two categories: **learner-level health signals** (non-bypass, buffered) and **brain-level structural signals** (some bypass, some buffered).

### Learner-Level Signals (from `BaseLearner.checkAndEmitSignals()`)

These fire when a learner's performance metrics cross thresholds. They do NOT bypass — they accumulate in the buffer until the threshold is met.

| Signal | Condition | Default Threshold | Description Pattern |
|--------|-----------|-------------------|---------------------|
| **High dismissal** | `dismissalRate > maxDismissalRate` | 0.8 (80%) | "High dismissal rate: rejecting {%}% of observations" |
| **Low relevance** | Avg relevance over 5+ queries < min | 0.3 | "Low relevance: avg {score} over last {count} queries" |
| **Low confidence** | Avg confidence over 5+ queries < min | 0.3 | "Low confidence: avg {score} — has knowledge gaps" |
| **Stagnation** | Observations piling up without synthesis | 3 × maxObservations | "Stagnation: no synthesis in {count} observations" |

**Deduplication:** Each learner tracks `dismissal_signal_fired` and `stagnation_signal_fired` flags to avoid repeating the same signal. Cleared when the condition improves.

**Source field:** The learner's ID (e.g., `"dev-learner"`)

**File:** `src/learners/base/class.ts` lines 1153-1215

### Brain-Level Signals

| Signal | Trigger | Bypass? | Description Pattern |
|--------|---------|---------|---------------------|
| **Coverage gap** | Sliding window: N of last M queries had no relevant learner | No | "Coverage gap: {N} of last {M} queries had no relevant learner" |
| **Injection gap** | ALL learners dismiss an injected batch | **Yes** | "All learners dismissed batch {id}. Gaps: {topics}" |
| **System directive** | `brain.update()` changes instructions/name/description | **Yes** | "SYSTEM DIRECTIVE: {change summaries}" |

**Source field:** `"brain"` for coverage gap and system directive, `"brain:injection-gap"` for injection gap.

**Files:** `src/brain/class.ts` — `checkCoverageGap()` (line 1206), `handleDismissedBatch()` (line 1134), `update()` (line 1690)

### How Signals Reach the Evaluator

```
Learner emits 'learner:signal' event
  → Brain listener (class.ts:316) calls brain.signal()
    → brain.signal() (line 905) adds timestamp, emits 'brain:signal:received'
      → evaluator.signal(signalEvent) (line 918)
        → pushed to evaluator.signals[]
          → maybeEvaluate()

brain.triggerEvolution({ source, description })
  → brain.signal({ ...signal, bypass: true })
    → same path as above
```

### Trigger Logic (`maybeEvaluate()`)

```
if (isEvaluating) → wait (queued for re-check after current eval finishes)
if (signals.length === 0) → do nothing
if (any signal has bypass=true) → evaluate immediately
if (signals.length >= threshold AND autoEvaluate=true) → evaluate
otherwise → wait for more signals
```

After each evaluation, `maybeEvaluate()` is called again to handle any signals that arrived during the LLM call.

### Issue: Injection Gap Bypass Causes Over-Triggering

Every dismissed batch bypasses the threshold and forces an immediate evaluation. In a scenario with 19 dismissed batches, this means up to 19 evaluation attempts — each an LLM call. The evaluator processes fine-grained signals ("cooking ramen; cooking thai green curry") instead of getting a batched view of what domains are uncovered.

Meanwhile, the **gap learner** is already accumulating and synthesizing this information into a domain-level understanding. The evaluator could potentially use the gap learner's synthesized knowledge instead of reacting to each individual dismissed batch.

---

## 2. Evaluator Tools — What Can It See?

### Current Tools

| Tool | What It Does | Data Source |
|------|-------------|-------------|
| `getUnderstandings(learnerIds)` | Returns accumulated knowledge text per learner | `learner.getUnderstanding()` — external learners only |
| `getLearnerActivity(learnerIds)` | Returns ingestion metrics + recent observations | `learner.getActivity()` — external learners only |
| `getRecentHistory()` | Returns last 10 evaluation decision sets | In-memory history array |
| `finalizeDecisions()` | Output structured decisions (done tool, no execute) | N/A |

### What the Context Provides (in the user prompt)

For each external learner:
- ID, type, purpose (first sentence of instructions)
- Knowledge size classification (none/minimal/some/significant)
- Health status + activation score
- Query count, dismissal rate, synthesis count

### Gaps in Tool Access

| Missing Capability | Why It Matters |
|--------------------|----------------|
| **Can't query a learner** ("what do you know about X?") | Can only read raw understanding text. For large understandings, this is noise. A targeted query would give the evaluator what it actually needs. |
| **No access to internal learners** | The injection gap learner has a synthesized cross-domain view of ALL gaps. The evaluator can't see it — it only gets individual batch-level signal descriptions. |
| **No dismissed batch data** | Evaluator sees "Gaps: cooking ramen; thai green curry" but can't see the actual content that was dismissed or how many batches were dismissed. |
| **Limited health data** | Only dismissal rate and synthesis count in context. No activation history, no signal threshold state, no governance config. |

---

## 3. Prompt Engineering — Current State Assessment

### System Prompt Structure (68 lines)

```
Identity (1 paragraph)
System Architecture (description of learners)
Available Actions (table: create/update/merge/split/delete)
Principles (6 numbered rules)
Methodology (6-step procedure + special case note)
```

### Issues

**Over-prescriptive methodology.** The methodology section maps signal types to specific actions like a decision tree:
- "Coverage gap → create"
- "Scope drift → update"
- "Overlap → merge"

This removes the model's autonomy. Real situations are messier — a "coverage gap" might be better addressed by updating an existing learner's scope rather than creating a new one. The model should reason about this, not follow a lookup table.

**Accumulated patches.** Several rules were added to fix specific eval failures:
- "Always call getRecentHistory() first" — added to prevent duplicate creations
- "Start with ONE broad learner per domain" — added to prevent proliferation
- "Don't micro-specialize upfront" — added for same reason
- "You may be called rapidly with signals from different domains" — added for injection gap scenario

Each patch made sense in isolation but together they make the prompt long and scenario-specific.

**Redundant content.** The user prompt's "Available Tools" section manually describes tools that the model already receives via AI SDK tool schemas. This wastes tokens.

**Lossy context.** `classifyKnowledgeSize()` converts character count to labels (none/minimal/some/significant) with arbitrary thresholds. `extractPurpose()` takes only the first sentence of instructions. Both lose useful information.

**Principle conflicts.** "Investigate before deciding" + "No action is valid" create a cautious bias that conflicts with injection gap signals that need immediate action. "Knowledge has value" + "Action priority" create a preservation bias that may prevent necessary restructuring.

---

## 4. Summary of Findings

### What Works
- Signal sources cover the right scenarios (health degradation, coverage gaps, structural changes)
- Tool-based evaluation lets the model investigate before deciding
- `toolChoice: 'auto'` lets the model reason between tool calls
- Signal snapshot + splice preserves signals arriving during evaluation
- `maybeEvaluate()` retry loop handles buffered signals correctly

### What Needs Rethinking

1. **Injection gap trigger strategy** — Per-batch bypass is too granular. Consider: let the gap learner accumulate, trigger evaluation on gap learner synthesis instead (or on a debounced schedule).

2. **Tool access** — The evaluator needs access to the gap learner's synthesized knowledge to make informed decisions about what domains need coverage. A `consultInternalLearner` tool or including gap understanding in context would help.

3. **Prompt length and rigidity** — The system prompt should provide identity + actions + constraints, not a step-by-step procedure. Let the model decide when to investigate and what action fits. Shorter prompt = better reasoning.

4. **Create handler prompt** — The "prefer ONE learner" instruction competes with the detailed 7-principle decomposition framework in `learnerGenerationFragment`. These pull in opposite directions.

---

## Appendix: Key Files

| File | What |
|------|------|
| `src/brain/evaluator/class.ts` | Evaluator class — signal buffering, evaluation loop, LLM call |
| `src/brain/evaluator/types.ts` | Signal, EvolutionDecision, EvaluatorEventMap |
| `src/brain/evaluator/prompt.system.ts` | System prompt (identity, principles, methodology) |
| `src/brain/evaluator/prompt.template.evaluation.ts` | User prompt template (context, signals, tools, task) |
| `src/brain/evaluator/tools/` | getUnderstandings, getLearnerActivity, getRecentHistory, finalizeDecisions |
| `src/brain/class.ts` | Brain — signal routing (line 905), injection gap handling (line 1134), coverage gap (line 1206) |
| `src/learners/base/class.ts` | Learner — health signal emission (line 1153) |
| `src/brain/evolution/orchestrator.ts` | Groups decisions by action, dispatches to handlers |
| `src/brain/evolution/handlers/create.ts` | Create handler — guidance → LLM → learner configs |
| `src/brain/evolution/prompt.template.create.ts` | Create prompt — includes "prefer ONE learner" guidance |
| `src/brain/prompts/prompt.fragment.learner-generation.ts` | 7-principle decomposition framework |
| `src/brain/types.ts` | EvolutionConfig (thresholds, coverageGap settings) |
| `src/brain/config.defaults.ts` | Default config values |
