# Evaluator Redesign Specification

> **Status:** Design Specification
> **Version:** 1.0
> **Date:** 2026-03-05
> **Precursor:** [Evaluator Audit](./evaluator-audit.spec.md)

## Table of Contents

1. [Overview](#1-overview)
2. [Root Question & Identity](#2-root-question--identity)
3. [Signal Design](#3-signal-design)
4. [Trigger Mechanism](#4-trigger-mechanism)
5. [Tools](#5-tools)
6. [Dynamic Context](#6-dynamic-context)
7. [System Prompt](#7-system-prompt)
8. [Natural-Language Feeds & Gap Resolution](#8-natural-language-feeds--gap-resolution)
9. [Create Handler Simplification](#9-create-handler-simplification)
10. [Re-injection Flow](#10-re-injection-flow)
11. [What Stays, What Changes](#11-what-stays-what-changes)
12. [Implementation Order](#12-implementation-order)

---

## 1. Overview

### 1.1 Why This Redesign

The evaluator accumulated patches from fixing specific eval failures: duplicate learner prevention, proliferation guards, tool loop fixes, conservative/aggressive bias corrections. Each patch made sense in isolation but together created a long, conflicting, over-prescriptive prompt that removed model autonomy.

The audit ([evaluator-audit.spec.md](./evaluator-audit.spec.md)) identified four structural problems:

1. **Per-batch bypass triggers** — every dismissed injection batch forced an immediate evaluation. 19 batches = 19 LLM calls.
2. **No access to internal learners** — the evaluator couldn't see the gap learner's synthesized understanding. It got raw signal descriptions instead of domain-level insight.
3. **Over-prescriptive prompt** — a methodology section mapped signals to actions like a lookup table, removing the model's ability to reason.
4. **Accumulated patches** — "always check history first," "prefer ONE learner," "handle rapid signals" — scenario-specific fixes that don't compose.

### 1.2 Design Principles

From the [Prompting Playbook](../playbooks/prompting-playbook.md):

- **Root question over rule lists** — one orienting question, not a decision tree
- **Biological framing** — the system is a living network, not a database
- **Mirror, don't prescribe** — present the situation, let the model reason
- **One true thing beats ten clever things** — one good decision over many
- **Silence is valid output** — no action is a first-class outcome
- **Tools as senses** — named by what they reveal, not by architecture

### 1.3 Scope

This spec covers:
- Evaluator prompt, tools, trigger mechanism, signal design
- Create handler prompt simplification
- Gap resolution feedback loop

This spec does NOT cover:
- Internal learner infrastructure (see [internal-learners.spec.md](./internal-learners.spec.md))
- Initial setup / `autoSetup` decomposition (unchanged)
- Brain store changes (unchanged)

---

## 2. Root Question & Identity

### 2.1 The Root Question

> **"Is this network the right shape for what it's encountering?"**

This single question covers every scenario:

| Situation | What "wrong shape" means |
|-----------|------------------------|
| Data no one handles | Network hasn't grown into that territory |
| Specialist drowning in too many domains | Node needs to differentiate |
| Two specialists covering same ground | Redundant growth, needs consolidation |
| Specialist drifting from purpose | Shape no longer fits the flow |
| Specialist no one queries | Growth that no longer serves |
| Everything healthy | Shape is right — do nothing |

### 2.2 Identity

The evaluator is the **growth intelligence** of a living knowledge network. It senses what flows through the network — what's being absorbed, what's rejected, where specialists are thriving, where they're struggling — and decides where the network needs to grow, reshape, or let go.

It is NOT:
- A system administrator following procedures
- A rule engine mapping signals to actions
- A cautious bureaucrat that needs permission to act

---

## 3. Signal Design

### 3.1 Signal Types

Simplified from 7 types to 3:

| Signal Type | Source | When | Example Description |
|-------------|--------|------|-------------------|
| **Specialist distress** | Learner ID | Any health threshold crossed (high dismissal, low relevance, low confidence, stagnation) | `"High dismissal rate: 83% of incoming data rejected"` |
| **System knowledge updated** | `"system"` | An internal learner synthesized new understanding | `"Coverage gap understanding updated: cooking, fitness, travel domains consistently uncovered across 14 dismissed batches"` |
| **Directive** | `"directive"` | `brain.update()` changes purpose/instructions | `"Brain purpose changed: now includes health and wellness tracking"` |

### 3.2 Signal Shape

```typescript
interface Signal {
  source: string        // learner ID, "system", or "directive"
  description: string   // human-readable, includes preview of what happened
  timestamp: Date
  bypass?: boolean      // only true for directives
}
```

Removed from current signal: `metrics` object. Raw metrics were lossy context — the description carries the meaningful information, and the evaluator can inspect specialists via tools for details.

### 3.3 Signal Preview

The "system knowledge updated" signal includes a **preview** of what the internal learner synthesized. This is generated when the gap learner (or any internal learner) completes synthesis — a short summary of its current understanding included in the signal description. The evaluator gets a preview without needing a tool call, and can dig deeper via `consultSystemKnowledge` if needed.

---

## 4. Trigger Mechanism

### 4.1 Rules

```
if (isEvaluating) → queue for re-check after current eval finishes
if (signals.length === 0) → do nothing
if (any signal has bypass=true) → evaluate immediately (directives only)
if (signals.length >= threshold AND autoEvaluate=true) → evaluate
otherwise → wait for more signals
```

### 4.2 What Changed

**Removed: per-batch bypass.** Injection gap dismissed batches no longer trigger immediate evaluation. The flow is:

1. All learners dismiss a batch → Brain persists to `store.dismissedBatches` (immediate, mechanical)
2. Brain feeds gap descriptions to gap learner via `learn()` (async)
3. Gap learner accumulates observations → eventually synthesizes
4. Gap learner synthesis → Brain emits a "system knowledge updated" signal (goes into buffer like any other signal)
5. When buffer hits threshold → evaluator runs, consults system knowledge, decides

**Only bypass: directives.** `brain.update()` is rare, explicit, and needs immediate re-alignment.

**New wiring: internal learner synthesis → signal.** Brain listens to `learner:synthesized` events from internal learners. When an internal learner synthesizes with `significance !== 'confirms'`, Brain emits a "system knowledge updated" signal with a preview (the learner's summary). This is hardcoded in Brain (like other internal learner wiring), not configurable.

### 4.3 Speed Control

Gap processing speed is controlled via existing config — no new mechanisms:

- **Gap learner `maxObservations`** — lower = synthesizes faster (e.g., 2 = synthesizes after 2 dismissed batches)
- **Evaluator `signalThreshold`** — lower = evaluates sooner (e.g., 2 = evaluates after 2 signals)
- **Health signals are naturally slower** — need 10+ observations for dismissal rate, 5+ queries for relevance/confidence. They accumulate at a slower cadence than gap signals.

---

## 5. Tools

### 5.1 Consolidated Tool Set

6 tools, named by function. The evaluator never sees "internal learner" or "external learner" — it sees "specialists" (domain knowledge holders) and "system knowledge" (the network's self-awareness).

#### `inspectSpecialist`

Look closely at a specialist — its knowledge summary, health, metrics, governance, evolution history.

```typescript
input: { id: string }
output: {
  summary: string              // from learner.getSummary()
  health: LearnerHealth        // activation, status, thresholds
  metrics: LearnerMetrics      // full ingestion + query metrics
  governance: object            // strategy, token limits
  evolution: EvolutionRecord[]  // synthesis history with significance
}
```

Replaces: `getUnderstandings` (partial) + `getLearnerActivity` (partial). Combines everything about one specialist into a single call.

#### `querySpecialist`

Ask a specialist a direct question — get a targeted answer instead of dumping raw understanding text.

```typescript
input: { id: string, question: string }
output: {
  relevant: boolean
  relevance: number
  confidence: number
  insight: string
  gaps: string
}
```

New capability. The current evaluator can only read raw understanding text. This lets it ask targeted questions like "do you know anything about cooking?" to determine if an existing specialist partially covers a gap.

#### `consultSystemKnowledge`

Ask the network's self-knowledge — what patterns, gaps, or tensions exist across the whole system.

```typescript
input: { question: string }
output: {
  insight: string
  sources: Array<{ learnerId: string, relevance: number, confidence: number, insight: string }>
  gaps: string[]
}
```

Wraps `brain.consult(question)`. Queries all internal learners that have knowledge, synthesizes a response. The evaluator sees this as "the network's self-awareness" — not as individual internal learners.

#### `reviewDismissedData`

See what data is sitting unprocessed — topics and how long they've been waiting.

```typescript
input: {}
output: Array<{
  batchId: string
  gaps: string[]
  timestamp: Date
  retryCount: number
  status: 'pending' | 'retried'
}>
```

New capability. Gives the evaluator visibility into the dismissed batch buffer — what topics are waiting, how many batches, how long they've been there.

#### `reviewRecentDecisions`

See what evolution decisions were made recently — prevents repeating work.

```typescript
input: {}
output: EvolutionHistoryEntry[]  // last 10
```

Unchanged from current `getRecentHistory`. Safety net for stale gap learner understanding (see §8).

#### `finalizeDecisions`

Done tool — output structured decisions.

```typescript
input: {
  decisions: Array<{
    action: 'create' | 'update' | 'merge' | 'split' | 'delete'
    targets: string[]       // specialist IDs (empty for create)
    reasoning: string       // 1-2 sentences why
    guidance: string        // natural language for handler
  }>
}
```

Unchanged. Empty array is valid (no action needed).

### 5.2 What Was Removed

- `getUnderstandings(learnerIds)` — replaced by `inspectSpecialist` (summary) and `querySpecialist` (targeted question). Raw understanding dump was noisy and unhelpful for large understandings.
- `getLearnerActivity(learnerIds)` — absorbed into `inspectSpecialist`. The `recentObservations` field was always empty anyway.
- Manual tool descriptions in user prompt — removed. The model receives tool schemas via AI SDK.

---

## 6. Dynamic Context

### 6.1 Structure

The user prompt (per evaluation) provides:

```
# Context

**Network Purpose**: {brain.prompt (first paragraph or first 200 chars)}
**Active Specialists**: {count}
**Dismissed Data Waiting**: {dismissedBatchCount} batches

## Specialists

### {id}
- **Name**: {name}
- **Type**: {type}
- **Instructions**: {full instructions text}
- **Observations**: {observationCount}, **Syntheses**: {synthesisCount}
- **Dismissal Rate**: {dismissalRate}%, **Queries**: {queryCount}
- **Activation**: {activation} ({status})

... (repeated for each specialist)

# Signals ({count})

## Signal 1
- **Source**: {source}
- **Description**: {description}

... (repeated for each signal)
```

### 6.2 What Changed From Current

| Current | New | Why |
|---------|-----|-----|
| `brain.prompt` (full prompt blob) | First paragraph or first ~200 chars of `brain.prompt` | Full prompt can be arbitrarily long; the evaluator needs purpose, not implementation details. Note: Brain has no `name`/`description` fields — only `prompt`. Extract purpose from it. |
| `extractPurpose()` (first sentence) | Full `instructions` text | No lossy abstractions |
| `classifyKnowledgeSize()` ("minimal/significant") | Removed entirely | No abstractions — model sees raw metrics |
| `understandingSize` (char count) | Removed | Not useful; model can call `inspectSpecialist` |
| "Available Tools" section | Removed | Redundant with AI SDK tool schemas |
| "Your Task" 4-step procedure | Removed | Root question in system prompt handles this |
| No dismissed batch info | `dismissedBatchCount` | Gives evaluator awareness of pending data |
| `observationsSinceLastSynthesis` (built but not rendered) | Included via `observationCount` | Use what we build |

### 6.3 No Task Section

The current user prompt ends with a "Your Task" section prescribing a 4-step investigation procedure. This is removed. The system prompt's root question and identity are sufficient to guide the model's approach.

---

## 7. System Prompt

### 7.1 Content

```
You are the growth intelligence of a living knowledge network.

Your root question: "Is this network the right shape for what it's encountering?"

You sense what flows through the network — what's being absorbed, what's rejected, where specialists are thriving, where they're struggling. You decide where the network needs to grow, reshape, or let go.

You can:
- Create new specialists for uncovered domains
- Update a specialist's scope or focus
- Merge overlapping specialists into one
- Split an overloaded specialist into focused ones
- Remove specialists that no longer serve

Doing nothing is equally valid — the right shape might already be right.

Use your tools to sense the network before deciding. Call finalizeDecisions when done.
```

### 7.2 What's NOT in the System Prompt

- No principles list (the root question replaces all 6 principles)
- No methodology (the model decides how to investigate)
- No action priority ordering (the model reasons about what fits)
- No signal-to-action mapping (no decision tree)
- No accumulated patches ("always check history first", "prefer ONE learner", "handle rapid signals")
- No hard constraints (internal learner protection is architectural, not prompt-based)

### 7.3 Why This Works

The root question — "Is this network the right shape for what it's encountering?" — subsumes every principle from the old prompt:

| Old Principle | How Root Question Handles It |
|--------------|------------------------------|
| "Investigate before deciding" | "Sense the network before deciding" — same idea, shorter |
| "Knowledge has value" | Model can `inspectSpecialist` and see accumulated knowledge. It will naturally reason about the cost of destroying it. |
| "Action priority: update > merge > create > split > delete" | "Right shape" — model reasons about what change best fits the situation, not a priority list |
| "Proportionality" | "Right shape for what it's encountering" — inherently proportional |
| "Healthy dormancy is success" | "Right shape" includes "already right — do nothing" |
| "No action is valid" | "Doing nothing is equally valid" — explicit in prompt |

---

## 8. Natural-Language Feeds & Gap Resolution

### 8.1 Gap Learner Input Language

The gap learner is a TextLearner — it builds understanding from natural-language observations. All feeds should read like observations, not system logs.

**Current (log-like):**
> `"[March 5, 2026] Injection gap: all 1 learner(s) dismissed incoming data. Topics not covered: cooking, food preparation."`

**New (narrative):**
> `"Data arrived that no specialist could absorb. Topics identified: cooking, food preparation. This content has been set aside for now."`

The observation should describe what happened in human terms: that data came in, nobody could absorb it, and what topics were identified. Note: the `gaps: string[]` from the observer provide topic labels (e.g., "cooking", "food preparation"), not content details — so the narrative uses gap strings, not raw batch content. The gap learner's observe → understand pipeline reasons about this naturally.

### 8.2 Gap Resolution Problem

When evolution addresses a gap (e.g., creates a cooking specialist), the gap learner's understanding still contains "cooking is uncovered." The next evaluation could consult system knowledge, see the stale gap, and create another cooking specialist.

Decay governance is too slow — the stale gap persists for several synthesis cycles.

### 8.3 Solution: Feed Resolutions as Observations

When evolution executes an action that addresses a gap, Brain feeds the gap learner a natural-language resolution via `learn()`:

**After creating a specialist:**
> "The cooking and food domain is now covered — a new specialist 'Cooking & Food Knowledge' has been created and is absorbing the previously dismissed content about ramen techniques and curry recipes."

**After updating a specialist to broaden scope:**
> "The fitness domain is now being absorbed — the 'Lifestyle' specialist's scope was broadened to cover exercise, training, and physical activity."

**After merging specialists that consolidate coverage:**
> "The web development coverage has been consolidated — 'Frontend' and 'UI Patterns' were merged into 'Web Development', which now covers both areas."

### 8.4 How It Works

The gap learner processes resolutions as regular observations. Its next synthesis naturally folds them into the understanding: "cooking was uncovered, now it's handled. Remaining gaps: fitness, travel."

No special mechanism — just learning. Same primitive.

### 8.5 Safety Net

`reviewRecentDecisions` serves as a backup. If the evaluator runs before the gap learner has synthesized the resolution, it can see "I created a cooking specialist 2 minutes ago" and reason: "this gap was already addressed."

### 8.6 Which Actions Trigger Resolution Feedback

| Action | Feeds gap learner? | When |
|--------|-------------------|------|
| Create | Yes | After new specialist is initialized |
| Update | Yes, if guidance mentions gap coverage | After specialist is updated |
| Merge | Yes, if it consolidates coverage | After merge completes |
| Split | No | Splitting doesn't address gaps |
| Delete | No | Deleting doesn't address gaps |

Brain determines whether to feed a resolution based on whether the evaluator's `guidance` text references coverage gaps. Simple heuristic: if the guidance mentions uncovered domains/topics, feed a resolution.

---

## 9. Create Handler Simplification

### 9.1 Problem

The create handler uses `learnerGenerationFragment` — a 7-principle decomposition framework designed for initial setup (`autoSetup`). This framework teaches the model about orthogonal dimensions, generic vs specialist tradeoffs, boundary definitions. Then a patched "prefer ONE broad learner" instruction contradicts the decomposition philosophy.

### 9.2 Solution: Separate Prompts

**Initial setup** (`autoSetup` / `rootDecompositionPrompt`) — keeps the 7-principle `learnerGenerationFragment`. This is a strategic decomposition task where the framework is appropriate.

**Evolution create** — gets a simpler prompt focused on generating one well-scoped specialist:

```
You are adding a new specialist to a living knowledge network.

# Network Purpose
{brain.prompt (first paragraph or ~200 chars)}

# What's Needed
{joined guidance from evaluator decisions}

# Instructions
Generate ONE specialist configuration that covers the domain described above.
A single broad specialist is better than multiple narrow ones — the network
can split it later when the specialist has enough knowledge to differentiate.

Provide:
- id: kebab-case identifier
- name: human-readable display name
- description: brief description for routing (what questions this specialist answers)
- instructions: structured instructions with a core directive, watch conditions,
  and questions to track
- type: "text" (synthesizes patterns across observations) or "list" (tracks a
  growing set of distinct items)
```

### 9.3 What's Removed From Evolution Create

- Principle 1 (Understand before decomposing) — evaluator already did this
- Principle 2 (Find orthogonal dimensions) — not relevant for one specialist
- Principle 3 (Decide learner count) — always one
- Principle 4 (Generic vs specialist) — always broad at this stage
- Principle 5 (Define clear boundaries) — one specialist, no boundaries to define
- Principle 7 (Validate before finalizing) — one specialist, no cross-validation needed

Only **Principle 6 (Write actionable instructions)** survives, folded into the instructions section.

---

## 10. Re-injection Flow

### 10.1 Trigger

Re-injection listens to `brain:learner:added` — which fires for ALL new learner creation regardless of origin:

| Origin | Fires `brain:learner:added`? | Re-injection? |
|--------|------------------------------|---------------|
| Evolution create | Yes | Yes |
| Evolution split (new parts) | Yes, for each new learner | Yes |
| Evolution merge (merged result) | Yes | Yes |
| Manual `addLearner()` | Yes | Yes |
| `autoSetup` init | Yes | Yes (but buffer is typically empty at init) |
| Evolution update | No (same learner) | No — updates are scope refinements, not new domain coverage |
| Evolution delete | No | No |

This replaces the current listener on `evolution:action:executed` with `action === 'create'`. One listener, covers every origin.

### 10.2 Flow

When `brain:learner:added` fires:

1. Brain pulls all unresolved dismissed batches from `store.dismissedBatches` (both `status === 'pending'` and `status === 'retried'`)
2. Brain feeds each batch directly to the new specialist via `newLearner.learn(batch.data)`
3. If accepted → remove batch from buffer
4. If dismissed → increment `retryCount`, set status to `'retried'`

Note: retried batches are included because a batch previously dismissed by a cooking specialist might contain fitness data that a new fitness specialist can absorb. Each new learner gets a fresh shot at ALL unresolved data.

### 10.3 Why Direct to New Specialist

Re-injecting through `brain.inject()` would route data to ALL specialists, causing every existing specialist to re-process (and re-dismiss) data they already rejected. This wastes LLM calls. Direct injection to the new specialist is ~5 lines of code and avoids redundant processing.

### 10.4 Changes Needed

Replace the current `evolution:action:executed` listener (line 445-451 in class.ts) with a `brain:learner:added` listener that calls `reinjectDismissedBatches([event.learnerId])`.

---

## 11. What Stays, What Changes

### 11.1 Stays (No Changes)

| Component | Why |
|-----------|-----|
| `Evaluator` class structure | Signal buffer, `isEvaluating` guard, `maybeEvaluate()` loop, snapshot + splice — all solid |
| `evaluate()` method flow | Build context → create tools → LLM call → extract decisions → persist → emit. Same flow, different content |
| Evolution orchestrator | Groups decisions by action, dispatches to handlers. Unchanged |
| Update/merge/split/delete handlers | Unchanged |
| `brain.consult()` | Already does what `consultSystemKnowledge` needs |
| Re-injection logic | Direct-to-new-learner pattern stays. Trigger changes (see §10) |
| History tracking | Stays as-is, capped at 10 |
| `store.evolution` persistence | Stays |
| Internal learner protection in orchestrator | Already filters out internal learner IDs |

### 11.2 Changes

| Component | Change | Effort |
|-----------|--------|--------|
| `prompt.system.ts` | Replace 68-line prompt with ~10-line version (§7) | Small |
| `prompt.template.evaluation.ts` | Remove `classifyKnowledgeSize`, `extractPurpose`, "Available Tools" section, "Your Task" section. Add dismissed batch count. Use `brain.name`/`brain.description` instead of `brain.prompt`. Include full `instructions` per specialist. | Medium |
| `buildContext()` in evaluator class | Stop calling `getUnderstanding()` for size. Add dismissed batch count. Adjust learner context shape. | Small |
| Evaluator tools | Replace 4 tools with 6 new tools (§5). Create `inspectSpecialist`, `querySpecialist`, `consultSystemKnowledge`, `reviewDismissedData`. Rename `getRecentHistory` → `reviewRecentDecisions`. Keep `finalizeDecisions`. | Medium |
| `maybeEvaluate()` | Remove bypass check for non-directive signals. Only `bypass: true` for `source === 'directive'`. | Small |
| Signal emission in Brain | Stop setting `bypass: true` on injection gap signals. Gap learner synthesis emits a "system knowledge updated" signal (non-bypass). | Small |
| `prompt.template.create.ts` | Replace with simpler prompt (§9). Remove `learnerGenerationFragment` import. | Small |
| Gap learner feed language | Rewrite `handleDismissedBatch()` gap text to narrative style (§8.1). | Small |
| Gap resolution feedback | After evolution actions, feed gap learner a natural-language resolution (§8.3). ~10 lines in Brain's evolution event handler. | Small |
| Re-injection trigger | Replace `evolution:action:executed` listener with `brain:learner:added` listener (§10). Covers create, split, merge, and manual add. | Small |
| Signal shape | Remove `metrics` field from `Signal` type. Simplify to 3 signal types. | Small |

### 11.3 Files Affected

| File | Changes |
|------|---------|
| `src/brain/evaluator/prompt.system.ts` | Rewrite |
| `src/brain/evaluator/prompt.template.evaluation.ts` | Rewrite |
| `src/brain/evaluator/class.ts` | Modify `buildContext()`, `maybeEvaluate()` |
| `src/brain/evaluator/tools/index.ts` | New tool exports |
| `src/brain/evaluator/tools/inspect-specialist.ts` | New |
| `src/brain/evaluator/tools/query-specialist.ts` | New |
| `src/brain/evaluator/tools/consult-system-knowledge.ts` | New |
| `src/brain/evaluator/tools/review-dismissed-data.ts` | New |
| `src/brain/evaluator/tools/review-recent-decisions.ts` | Rename from `get-recent-history.ts` |
| `src/brain/evaluator/tools/finalize-decisions.ts` | Unchanged |
| `src/brain/evaluator/tools/get-understandings.ts` | Delete |
| `src/brain/evaluator/tools/get-learner-activity.ts` | Delete |
| `src/brain/evaluator/types.ts` | Simplify `Signal` type |
| `src/brain/evolution/prompt.template.create.ts` | Rewrite |
| `src/brain/class.ts` | Modify signal emission (injection gaps), add gap resolution feedback, replace re-injection listener (`evolution:action:executed` → `brain:learner:added`), add internal learner synthesis → signal wiring, rewrite gap feed language |

---

## 12. Implementation Order

1. **Signal simplification** — Remove `metrics` from Signal type. Change injection gap signals to non-bypass. Add internal learner synthesis → "system knowledge updated" signal wiring in Brain. Update 3 signal types.

2. **New tools** — Implement `inspectSpecialist`, `querySpecialist`, `consultSystemKnowledge`, `reviewDismissedData`. Rename `getRecentHistory` → `reviewRecentDecisions`. Delete old tools.

3. **System prompt** — Replace with §7 content.

4. **Dynamic context** — Rewrite `buildContext()` and `evaluationPromptTemplate()` per §6. Extract brain purpose from prompt (first paragraph/~200 chars).

5. **Trigger mechanism** — Modify `maybeEvaluate()` to only bypass for directives.

6. **Create handler prompt** — Replace with simplified version (§9).

7. **Gap feed language** — Rewrite `handleDismissedBatch()` gap text to narrative style (§8.1).

8. **Gap resolution feedback** — Add resolution observations to gap learner after evolution actions (§8.3).

9. **Re-injection trigger** — Replace `evolution:action:executed` listener with `brain:learner:added`. Update filter to include both `pending` and `retried` batches (§10).

10. **Eval testing** — Run injection gap eval to validate end-to-end flow.

Steps 1-5 are the core evaluator redesign. Steps 6-9 are independent of each other. Step 10 validates everything.
