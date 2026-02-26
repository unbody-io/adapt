# Audit Feedback — Round 6 (Post Schema & Understand Fixes)

## Context

Round 5 flagged the missing eval. During eval development, two critical bugs were discovered and fixed:

1. **Schema generation produced empty `{}`** — `Output.object()` with `z.record()` gave no structural guidance to the model. Fixed by switching to plain text generation + manual JSON parsing with a reasoning-first prompt.

2. **Understand tools sent `data: {}` every call** — `z.record(z.string(), z.unknown())` in tool inputSchema produces `{"type":"object"}` with no properties. Models interpret this as "empty object". Fixed by using `z.fromJSONSchema(understandingSchema)` so the model sees exact fields in the tool definition.

Both fixes are committed. The full agentic eval now passes 3/4 scenarios. This round covers the remaining issue.

---

## What's Working

- **Lifecycle (Scenario 1)**: init → schema generated → batch 1 adds items → batch 2 updates existing + adds new → query returns relevant answers. Clean.
- **Governance (Scenario 3)**: Agent adds 5 restaurants, governance prunes to maxItems=3. Works.
- **Dismissed (Scenario 4)**: Weather data fed to restaurant tracker → `observe:dismissed`. Correct — irrelevant data never reaches understand.
- **Schema quality**: Flat schemas, semantic-only constraints, proper enums with "other" catch-all, no format/pattern.
- **Divergent schema handling**: Isolated eval confirmed the agent correctly maps observation fields to different understanding fields (food_type→cuisine, area→neighborhood, etc.).

---

## Issues

### 1. Dedup not working in agentic flow (Medium)

**Observed**: Scenario 2 feeds the same restaurants again. Expected: agent searches, finds existing items, skips or updates. Actual: agent adds duplicates (3→5 items).

**Root cause**: The agent IS instructed to search before adding (system prompt step 2), but it doesn't reliably do it. In the eval output, the agent added new items without searching first for the second batch of duplicates.

This is not a code bug — the search infrastructure works (MemoryStore.search does recursive string matching). It's an **agent reliability issue**.

**Possible fixes** (choose one):

**A. Force search in addItem** — Before adding, the `addItem` tool itself searches the collection for similar items and returns them as suggestions instead of blindly adding. This makes dedup mechanical rather than relying on agent behavior.

```typescript
// In addItem execute handler, before adding:
const existing = await collection.search(data.name || '')
if (existing.length > 0) {
  return {
    success: false,
    suggestion: 'Similar items exist. Use updateItem instead.',
    matches: existing.map(r => ({ id: r.id, data: (r.data as ListItem).data }))
  }
}
```

**B. Two-phase approach** — Split into a structured extraction call (observations → structured items) then an agentic write call (items → store CRUD). The extraction call doesn't need tools, just structured output. The write call receives pre-structured items so it only needs to decide add vs update vs skip.

**C. Better prompting** — Add a `listItems` call at the start of the system prompt (force listing existing items first), or add the current items to the user prompt so the agent sees them without needing to call a tool.

**Recommendation**: Option A is simplest and most reliable. It works regardless of model quality. The governance post-pass is already the safety net for count limits — this would be the safety net for dedup.

---

## Summary

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| 1 | Dedup not working reliably in agentic flow | **Medium** | Option A: force search in addItem tool handler |

Everything else is working. The pipeline is end-to-end functional.
