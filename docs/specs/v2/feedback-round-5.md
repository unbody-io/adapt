# Audit Feedback — Round 5 (Post Agentic Understand)

## Context

Round 4 flagged a critical architecture issue: ListLearner understand was a single-shot structured LLM call instead of the agentic tool-based flow specified in architecture-v2.spec.md. The implementer shipped the fix (commit `474540d`). This round verifies that fix and flags remaining gaps.

## What's Done Well

- **Agentic understand implemented correctly**: Tool-based flow with 7 store-backed tools (listItems, searchItems, getItem, addItem, updateItem, removeItem, complete). Matches the B8 spec.
- **Schema validation in write tools**: `addItem` and `updateItem` validate via `z.fromJSONSchema()` and return error messages for agent self-correction. Clean pattern.
- **`setUnderstanding()` is a pure setter**: No validation, no filtering. Just store + cache + event. Exactly what was asked for.
- **Two-layer dedup**: Agent searches before adding (smart), governance post-pass (mechanical safety net). Both layers wired.
- **`complete` tool is terminal**: No execute handler — AI SDK stops the loop naturally. `stepCountIs(30)` as safety net. Same proven pattern as query's ToolBasedMethod.

---

## Issues

### 1. No semantic eval for agentic understand (Medium)

The agentic understand rewrite has zero eval coverage. The existing evals (`list-learner-semantic-eval.ts`, `store-02-pipeline.ts`) use the old config shape (`synthesize` instead of `understand`, `governance: { dedup: true }` instead of `governance: { deduplication: 'strict' }`) and were never updated or run.

This is a significant gap. The agentic flow is the most complex part of the system — an LLM agent making iterative tool calls against a live store. It needs to be verified end-to-end.

**What needs to be eval'd:**

1. **Basic lifecycle**: init → learn (batch 1) → items appear in store → learn (batch 2) → items grow/update → query returns relevant answers
2. **Dedup via tools**: Feed duplicate observations. Verify the agent searches before adding and updates existing items instead of creating duplicates.
3. **Schema validation self-correction**: If the understanding schema expects specific fields/types, feed observations that would produce mismatched data. Verify the agent gets a validation error from the tool and retries with corrected data.
4. **Governance post-pass**: Feed enough items to exceed `maxItems`. Verify governance prunes after the agent completes.
5. **Dismissed status**: Feed irrelevant observations. Verify understand returns `dismissed` (no changes made).

**Action**: Write a new `evals/scripts/list-learner-agentic-eval.ts` that covers the above scenarios. The old evals are unusable — don't try to patch them. Start fresh with the current config shape.

**Notes on eval design:**
- Use `MemoryStore` directly (no Brain needed)
- Pick a concrete domain (e.g., restaurant tracker, book collection) — something with natural dedup cases
- Assert on store state, not just return values — verify `store.understanding.list()` has the right items
- Log tool calls if possible (via `onStepFinish`) to verify the agent is actually using search-before-add
- Keep it runnable standalone: `npx tsx evals/scripts/list-learner-agentic-eval.ts`

---

## Summary

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | No semantic eval for agentic understand | **Medium** | Write new eval covering lifecycle, dedup, validation, governance, dismissal |

The implementation itself is solid. This is about verification, not bugs.
