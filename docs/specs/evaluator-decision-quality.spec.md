# Evaluator Decision Quality

> **Status:** Design Specification
> **Date:** 2026-02-17

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

### C. Governance Framework Refactor

Replace single `FRAGMENT_GOVERNANCE` with composable fragments:

#### Shared Governance Preamble

Always injected when governance signals are present. Contains:

1. **Systemic check** (first diagnostic — before any per-signal reasoning):
   - Are multiple learners showing the same signal type?
   - If majority show same symptom → likely data stream shift, not individual learner issues
   - Default bias: no action for systemic patterns

2. **Healthy dormancy check**:
   - Does the learner have significant accumulated knowledge AND high dismissal?
   - Significant knowledge + high dismissal = learner built its understanding and is correctly filtering irrelevant data
   - This is healthy behavior — no action needed

3. **Cost principle** (moved from current governance fragment):
   - Accumulated knowledge is irreversible to destroy
   - The more knowledge, the higher the cost of destructive action

4. **Available actions** reference (update, merge, split, delete, no action)

#### Per-Signal-Type Fragments

Only the relevant fragments are injected based on which signal types are present in the buffer. Each fragment contains:
- Metric definition (what the number means)
- Diagnostic steps specific to that signal type
- Recommended actions for each diagnosis

**`FRAGMENT_DISMISSAL`** — injected when buffer contains high-dismissal signals:
- `dismissalRate`: ratio of dismissed observations to total observations (0.0-1.0)
- Diagnostics: scope too narrow? scope mismatched with brain purpose? overlap with other learner?
- If systemic pattern already identified in preamble → likely no action

**`FRAGMENT_STAGNATION`** — injected when buffer contains stagnation signals:
- `observationsSinceLastSynthesis`: count of observations processed since last synthesis
- Diagnostics: topic exhausted (finite topic fully captured)? scope too narrow (nothing passes filter)? data stream dried up?
- Topic exhaustion = success, not failure

**`FRAGMENT_LOW_CONFIDENCE`** — injected when buffer contains low-confidence signals:
- `avgConfidence`: rolling average of query confidence scores (0.0-1.0)
- Diagnostics: understanding too thin? scope too broad (trying to answer everything)? consistently out-of-domain queries?

#### Fragment Composition

For a mixed batch (dismissal + stagnation signals):
```
[Shared Governance Preamble]
[FRAGMENT_DISMISSAL]
[FRAGMENT_STAGNATION]
```

For a pure dismissal batch:
```
[Shared Governance Preamble]
[FRAGMENT_DISMISSAL]
```

This follows the existing pattern where `FRAGMENT_SYSTEM_DIRECTIVE` and `FRAGMENT_GOVERNANCE` are composed based on signal types — just more granular within governance.

### D. Evaluation Prompt Template Updates

**File:** `src/brain/evaluator/prompt.template.evaluation.ts`

Changes to `evaluationPromptTemplate()`:

1. **Add triage summary section** — injected after context, before individual signals
2. **Replace single governance fragment** — use `detectGovernanceSignalTypes()` to determine which per-type fragments to inject
3. **Update tool descriptions** — add `getLearnerActivity` and `getRecentHistory` to the available tools section
4. **Update task instructions** — reference systemic check as first step for governance signals

## System Prompt

No changes to `src/brain/evaluator/prompt.system.ts`. The system prompt (role, actions, cost principle) remains stable.

## Files Changed

| File | Change |
|------|--------|
| `src/brain/evaluator/prompt.fragments.ts` | Replace `FRAGMENT_GOVERNANCE` with preamble + per-type fragments |
| `src/brain/evaluator/prompt.template.evaluation.ts` | Add triage summary, compose per-type fragments, update tool descriptions |
| `src/brain/evaluator/tools/getLearnerActivity.ts` | **New** — tool implementation |
| `src/brain/evaluator/tools/getRecentHistory.ts` | **New** — tool implementation |
| `src/brain/evaluator/class.ts` | Add evolution history log, wire new tools, add triage step |
| `src/brain/evaluator/types.ts` | Add LearnerActivity, EvolutionHistoryEntry types |
| `src/learners/text-learner/class.ts` | Expose `getActivity()` method (returns metrics + buffered observations) |

## Verification

1. **Type check**: `bun run build`
2. **Re-run evolution lifecycle test** — inject noise after building understanding
3. **Expected**: evaluator sees systemic pattern, identifies healthy dormancy, takes no destructive action on learners with significant knowledge
4. **Regression**: purpose change (FRAGMENT_SYSTEM_DIRECTIVE) decisions should be unaffected
