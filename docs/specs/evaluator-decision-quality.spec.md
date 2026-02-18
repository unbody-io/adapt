# Evaluator Decision Quality

> **Status:** Implemented
> **Date:** 2026-02-17
> **Implemented:** 2026-02-18

## Problem

During evolution lifecycle testing (Session 7), the evaluator incorrectly deleted 3 healthy dormant learners. These learners had significant accumulated knowledge and were correctly rejecting irrelevant noise data. The evaluator saw "high dismissal + dormant" and concluded "broken/redundant" — when the correct diagnosis was "healthy, data stream shifted."

**Root cause:** The evaluator receives per-learner symptom signals but cannot distinguish "healthy dormancy" from "broken scope." It lacks:
1. Cross-learner context (can't see that ALL learners show the same symptom)
2. Investigation tools (can't see ingestion patterns or recent observations)
3. Diagnostic guidance (governance framework buries systemic check at step 4 of 5)

## Solution

Four coordinated fixes:

### A. Pre-Evaluation Signal Triage

Mechanical string-template step that annotates the signal buffer before the LLM sees it. Groups signals by type and generates a summary section.

**Input:** Raw signal buffer + total learner count
**Output:** Summary string injected into evaluation prompt

```typescript
function triageSignals(signals: Signal[], totalLearners: number): string
```

Example output:
```
## Signal Patterns
- 3 of 5 learners report high dismissal (architecture-patterns, code-quality, problem-solving)
- 1 of 5 learners reports stagnation (collaboration-communication)
```

Rules:
- Pure mechanical grouping — no LLM, no interpretation
- States facts only: "{N} of {total} learners report {signal type} ({learner ids})"
- Injected into evaluation prompt before individual signals
- Light triage: annotates, does not suppress or filter signals

### B. New Investigation Tools

Add two new tools to the evaluator's tool set (4 total):

#### `getLearnerActivity({ learnerIds: string[] })`

Returns ingestion metrics and recent observation samples per learner. Mechanical — just surfaces stored data.

```typescript
interface LearnerActivity {
  ingestion: {
    observationCount: number
    dismissalCount: number
    dismissalRate: number
    synthesisCount: number
    observationsSinceLastSynthesis: number
  }
  recentObservations: Array<{
    text: string
    importance: number
  }>
}
```

`recentObservations` are the currently buffered observations (from `ObservationBuffer`). If buffer is empty (post-synthesis), returns empty array.

**Why:** Lets the evaluator see what a learner has been capturing (or not capturing) — to judge whether dismissals are justified.

#### `getRecentHistory()`

Returns last N evolution decisions from an in-memory log.

```typescript
interface EvolutionHistoryEntry {
  timestamp: Date
  decisions: Array<{
    action: string
    targets: string[]
    reasoning: string
  }>
}
```

- In-memory array in the evaluator, appended after each evaluation
- Capped at last 10 evaluations
- No persistence (resets on restart)

**Why:** Prevents the evaluator from repeating bad decisions or acting on learners it recently modified.

#### Complete Tool Set

| Tool | Status | Purpose |
|------|--------|---------|
| `getUnderstandings({ learnerIds })` | Existing | Fetch accumulated knowledge text |
| `getLearnerActivity({ learnerIds })` | **New** | Fetch ingestion metrics + buffered observations |
| `getRecentHistory()` | **New** | Fetch last 10 evaluation decision sets |
| `finalizeDecisions({ decisions })` | Existing | Terminate evaluation with decisions |

### C. Reasoning-Based Evaluator (replaces fragment-based approach)

The original spec proposed composable governance fragments (`FRAGMENT_GOVERNANCE_PREAMBLE`, `FRAGMENT_DISMISSAL`, etc.). During implementation, this was replaced with a simpler reasoning-based approach:

- **Deleted `prompt.fragments.ts` entirely** — no more prescriptive diagnostic recipes
- **Rewrote system prompt** with principles instead of procedures:
  1. Investigate before deciding (use tools to gather evidence)
  2. Knowledge has value (irreversible to destroy)
  3. Proportionality (systemic patterns ≠ individual problems)
  4. Healthy dormancy is success (significant knowledge + high dismissal = correct filtering)
  5. No action is valid (empty decisions array is legitimate)
- **Simplified evaluation template** — presents context (learners with raw metrics), signals (with raw metric values), tools, and a generic 4-step task. No fragment injection, no signal type detection, no triage function.

**Why the shift:** The fragment approach was over-prescriptive — it told the LLM *what to check in what order*. The reasoning approach gives the LLM good tools, good principles, and raw data, then lets it reason from evidence. The structural fixes (better tools from sections A and B) were the real solution; the diagnostic recipes were constraining the LLM's reasoning rather than helping it.

### D. Additional Fixes (discovered during testing)

Two related issues found during stress testing:

1. **Observe output: string → string[]** — one LLM call per batch now produces multiple discrete observations, each becoming its own buffer entry. Fixes learners not reaching synthesis threshold (`maxObservations: 10`).

2. **Update handler** — removed `targets.length === 1` guard, now loops over all targets in a decision. Fixes crash when evaluator batches multiple learners in one update decision.

## Files Changed

| File | Change |
|------|--------|
| `src/brain/evaluator/prompt.system.ts` | Rewritten — principles-based system prompt |
| `src/brain/evaluator/prompt.template.evaluation.ts` | Simplified — presents data + tools, no fragments |
| `src/brain/evaluator/prompt.fragments.ts` | **Deleted** — prescriptive fragments removed |
| `src/brain/evaluator/tools/getLearnerActivity.ts` | **New** — tool implementation |
| `src/brain/evaluator/tools/getRecentHistory.ts` | **New** — tool implementation |
| `src/brain/evaluator/tools/index.ts` | Export new tools |
| `src/brain/evaluator/class.ts` | Add evolution history log, wire 4 tools |
| `src/brain/evaluator/types.ts` | Add `LearnerActivity`, `EvolutionHistoryEntry` types |
| `src/learners/text-learner/class.ts` | Expose `getActivity()` method |
| `src/brain/evolution/handlers/update.ts` | Fix multi-target update loop |
| `src/learners/text-learner/learning-methods/two-phase/observe/*` | Observe output string → string[] |

## Verification

1. **Type check**: `bun run build` — passes
2. **Stress test**: `tests/evaluator-stress.ts` — all 5 evolution actions verified passing
3. **Expected**: evaluator sees systemic pattern, identifies healthy dormancy, no destructive actions on learners with significant knowledge
