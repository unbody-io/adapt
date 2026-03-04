# Task: Align Learner Prompts with Playbook

## Why

Learner prompts (observer, understand, query) predate the prompting playbook. They're rule-heavy, prescriptive, and mechanical. The evaluator prompts already follow the playbook — learner prompts are the remaining inconsistency.

## What

Rewrite all learner prompt templates to follow playbook principles: root question framing, biological language, mirror don't prescribe, shorter prompts, silence is valid.

## Where

- `src/learners/observer/prompts/` — identity.ts, system.ts, user.ts, adjust.ts
- `src/learners/text-learner/understand/prompts/` — identity.ts, system.ts, adjust.ts
- `src/learners/list-learner/understand/index.ts` — inline prompts
- `src/learners/text-learner/class.ts` and `list-learner/class.ts` — query prompt builders

No architecture changes. Same function signatures, same schemas, just better prompt text.

## Verification (Phase 1 — before any changes)

Write `evals/scripts/learner-prompts-eval.ts`. For each learner phase (observe, understand, query), feed known inputs and log raw outputs. Save results to `evals/reports/`.

**Observer**: 3 relevant batches (expect observed) + 3 irrelevant batches (expect dismissed) + 2 edge cases (log for review).
**Understand**: 5 observations → check understanding coherence. Contradictory observations → check conflict handling.
**Query**: 3 in-domain questions (expect high relevance) + 3 out-of-domain (expect low relevance).

This captures the **baseline** with current prompts.

## Implementation (Phase 2 — combined with Instruction Flexibility if both verified)

Rewrite prompts. Re-run same eval. Compare baseline vs new results side by side. Check:
- Accept/dismiss accuracy (same or better)
- Understanding quality (read the dumps)
- Query relevance/confidence (same or better)
- Token usage (should decrease — shorter prompts)
