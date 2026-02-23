# Audit Feedback — Effort A + B (Round 1)

## What's Done Well

- **Zero `any` usage** across the entire implementation. Types are clean and consistent.
- **Observer as a functional module** — good call. It's stateless (just `initObserve` + `observe`), so a class would be ceremony for no benefit. Matches the spec's intent.
- **Thin subclasses** — TextLearner (202 lines) and ListLearner (173 lines) are genuinely thin. BaseLearner owns the pipeline correctly.
- **Store types match spec exactly** — `metadata_***` prefix, universal `UnderstandingRecord`, no type parameter on `Store`.
- **Old directories deleted** — `learning-methods/` and `base/learning-method/` are gone as spec required.

---

## Issues

### 1. Understanding is NOT stored in the store (Critical)

This is the biggest gap. The spec's core principle is **"Store is single source of truth"** (PLAN.md Decision Log: "One source of truth, period"). The learner-refactor.spec.md B4 section shows explicit code for `store.understanding.get()` and `store.understanding.update()`.

What actually happened:
- `text-learner/class.ts:26`: `private understanding = ''` — in-memory property
- `list-learner/class.ts:27`: `private items: ListItem[] = []` — in-memory property
- `store.understanding` is **never read or written** by either subclass

The store's `understanding` collection exists but sits empty. This means understanding is lost if we ever swap to a persistent adapter — which is the whole point of the store layer.

**Action**: Wire `getUnderstanding()` and `setUnderstanding()` to `store.understanding` as the spec shows in B4.

---

### 2. No Effort B eval scripts (Required by Implementation Requirements)

Rule 5 in PLAN.md: *"Test at three levels for every phase/milestone: build test, programmatic test, real-world evals."*

Only `store-01-standalone.ts` exists (Effort A). There are no new eval scripts for the learner-store integration (Effort B). The existing 26 eval scripts may or may not still work — but either way, there's no eval that verifies:
- Observations land in `store.observations` with correct `metadata_status`
- Observations get marked `processed` after understand
- Understanding reads/writes go through the store
- Evolution records are stored correctly

**Action**: Create at minimum one Effort B eval script that exercises the full pipeline (init → learn → verify store contents → query) and does semantic validation of outputs.

---

### 3. `update()` silently no-ops on missing record (`memory.ts:53-54`)

```typescript
if (idx === -1) return  // silent no-op
```

But `delete()` throws on missing record (as spec requires). This is inconsistent. If a caller passes a wrong ID to `update()`, it silently succeeds — a hard-to-debug situation. The spec doesn't explicitly say `update()` should throw, but the inconsistency is a design smell.

**Action**: Either make `update()` throw on not-found (matching `delete()` behavior) or document why the asymmetry is intentional.

---

### 4. `getSynthesizeSystemPrompt()` backward compat (`base/class.ts:292-295`)

```typescript
// Keep old name for backward compat
getSynthesizeSystemPrompt(): string | null {
    return this.understandSystemPrompt
}
```

The spec says event names and status strings are preserved for backward compat — but **method names** are explicitly renamed (`synthesize` → `understand`). Adding a backward compat alias for a method was not asked for. Who calls `getSynthesizeSystemPrompt()` externally? If nothing, remove it. Rule 1: "Write code only when needed."

**Action**: Search for callers. If none exist, delete it.

---

### 5. `query-method/` → `query/` move didn't happen

learner-refactor.spec.md target directory structure shows `base/query/` (moved from `base/query-method/`). But:
- `src/learners/base/query-method/` still exists (3 files)
- 12 import statements across the codebase still reference `../base/query-method`
- `src/learners/base/query/` does not exist

This is a B7 item (file cleanup). If it was intentionally deferred, note it. If missed, do it.

**Action**: Move `query-method/` → `query/` and update all imports, or explain why it was deferred.

---

### 6. Store eval is mechanical, not semantic

`store-01-standalone.ts` has 146 tests — but they're all mechanical CRUD checks (add record, verify it's there, delete it, verify it's gone). The spec's Implementation Requirements say evals should *"do semantic analysis and validation of actual LLM outputs, not just check that functions return without errors."*

For a standalone store eval this is acceptable (no LLM involved). But this means the semantic eval obligation is fully on the Effort B eval (which doesn't exist yet — see issue #2).

---

## Summary

| # | Issue | Severity | Spec Reference |
|---|-------|----------|----------------|
| 1 | Understanding not in store | **Critical** | learner-refactor.spec B4, PLAN.md "single source of truth" |
| 2 | No Effort B eval scripts | **High** | PLAN.md Rule 5 |
| 3 | `update()` silent no-op | Medium | Inconsistent with `delete()` behavior |
| 4 | `getSynthesizeSystemPrompt()` | Low | Not in spec, unnecessary code |
| 5 | `query-method/` not moved | Low | learner-refactor.spec B7, target dir structure |
| 6 | No semantic evals | Covered by #2 | PLAN.md Rule 5 |

**Issues 1 and 2 need to be resolved before Effort B can be considered complete. Issues 3-5 are cleanup.**
