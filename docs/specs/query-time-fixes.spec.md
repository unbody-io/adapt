# Query-Time Fixes Specification

Fixes for `brain.ask()` and `learner.query()` issues identified during manual testing sessions 1-5.

## Issues Addressed

| # | Issue | Severity | Layer |
|---|-------|----------|-------|
| #1/#6 | Pre-synthesis dead zone — learners say "I know nothing" despite having buffered observations | High | Learner |
| #25 | Verbose rejections — learners write essays explaining why they can't help | Medium | Learner |
| #8 | Empty learners in sources — zero-knowledge learners still queried and listed | Medium | Both |
| #20 | Architecture leaking — brain references learners, confidence scores, synthesis in responses | High | Brain |
| #21 | Ignoring user constraints — asked for "3 words", gets multi-paragraph essays | High | Brain |

### Dropped

| # | Issue | Reason |
|---|-------|--------|
| #7/#17 | Frustration learner dominates ambiguous queries | Not a query-time bug. The test query ("ok, so you have no idea right?") was a follow-up to a previous question, but `brain.ask()` is stateless — no conversation context. The frustration learner was the only one that could make sense of it as a standalone query. This is a missing feature (conversational context), not a bug. |

---

## Fix 1: Pre-Synthesis Dead Zone

**Problem:** `learner.query()` only passes `this.understanding` to the LLM. Before synthesis triggers, understanding is empty, so the learner says "I know nothing" even though it has buffered observations the user just injected.

**Fix:** When understanding is empty, include buffered observations verbatim in the query prompt as fallback context.

### Behavior

- If `understanding` is non-empty: use understanding (current behavior, unchanged)
- If `understanding` is empty AND buffer has observations: pass buffered observations verbatim as the knowledge context
- If both are empty: short-circuit (see Fix 3)

### Prompt Changes

Both query methods (direct and tool-based) receive a `context.understanding` string. The change is in how `TextLearner.query()` builds this context before passing it to the query method — not in the prompt templates themselves.

When understanding is empty but buffer has observations, format as:

```
Note: This knowledge has not been synthesized yet. These are raw observations.

---
[observation 1 content]
---
[observation 2 content]
---
...
```

The "not yet synthesized" note tells the LLM to treat the data as provisional and less structured than synthesized understanding.

### Implementation

In `TextLearner.query()`, before calling `this._queryMethod.query()`:

```typescript
// Build knowledge context for query
let knowledge = this.understanding
if (!knowledge && this.buffer.length > 0) {
  knowledge = 'Note: This knowledge has not been synthesized yet. These are raw observations.\n\n---\n'
    + this.buffer.map(obs => obs.content).join('\n---\n')
}
```

Pass `knowledge` as the understanding context to the query method.

---

## Fix 2: Verbose Rejections

**Problem:** When a query is outside a learner's scope, it writes a 50-100 word essay explaining its purpose and why it can't help. Across 4 learners, this burns ~25k tokens just to say "no."

**Fix:** Add a prompt instruction to both query methods telling the LLM to be brief when irrelevant.

### Prompt Addition — Direct Method

Add to the grounding rules in `prompt.system.ts`:

```
- If the query is outside your scope, set relevant to false and keep your insight to one brief sentence. Do not explain your purpose or capabilities.
```

### Prompt Addition — Tool-Based Method

Add to STEP 1 (ASSESS RELEVANCE) in `prompt.template.query.ts`:

```
- If outside your scope: skip to STEP 4 (complete) immediately. Set relevant to false, keep insight to one brief sentence. Do not explain your purpose or capabilities.
```

---

## Fix 3: Empty Learner Short-Circuit

**Problem:** Learners with no understanding AND no buffered observations still get queried, wasting an LLM call and appearing in source attribution.

**Fix:** Short-circuit at both layers.

### Learner Level

In `TextLearner.query()`, before any LLM call:

```typescript
if (!this.understanding && this.buffer.length === 0) {
  const emptyResult: QueryResult = {
    relevant: false,
    relevance: 0,
    confidence: 0,
    insight: '',
    gaps: '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  }
  // Still emit events and track metrics for consistency
  return emptyResult
}
```

### Brain Level

In `brain.ask()`, before querying learners in parallel, filter out empty ones:

```typescript
const queryableLearners = this.learners.filter(
  l => l.getUnderstanding() || /* has buffered observations */
)
```

The brain needs a way to check if a learner has buffered observations. Options:
- Use `getMetrics().ingestion.observationCount > getMetrics().ingestion.synthesisCount * maxObservations` (indirect)
- More simply: check `getUnderstanding()` — if it's truthy, the learner has been through at least one synthesis. If falsy, check `getMetrics().ingestion.observationCount > getMetrics().ingestion.dismissalCount` (has non-dismissed observations in buffer)

The simplest check: a learner is "empty" if it has no understanding AND `metrics.ingestion.observationCount === metrics.ingestion.dismissalCount` (every observation was dismissed, or no observations at all).

---

## Fix 4: Synthesis Prompt Rewrite

**Problem:** The synthesis system prompt says "You synthesize responses from multiple specialized learners" and the user prompt formats responses as `[learner-name] (confidence: 85%)`. The LLM narrates this: "Based on synthesized learner insights...", "The frustration-tracking learner notes..."

**Fix:** Rewrite both synthesis prompts to eliminate all internal architecture references.

### New System Prompt (`prompt.synthesis.system.ts`)

```typescript
export function buildSynthesisSystemPrompt(brainPrompt: string): string {
  return `You are a knowledgeable assistant.

YOUR PURPOSE:
${brainPrompt}

RULES:
- Answer the user's question directly
- Use ONLY the knowledge provided below — do not add information from outside
- If knowledge sources conflict, note the disagreement
- If no knowledge is relevant, say so plainly
- Match the user's requested format exactly — if they ask for 3 words, give 3 words
- Be concise. Do not pad answers with unnecessary context or qualifications
- NEVER mention sources, knowledge sections, confidence scores, or your internal structure
- NEVER reference how your answer was constructed`
}
```

### New User Prompt (`prompt.synthesis.user.ts`)

```typescript
export function buildSynthesisUserPrompt(
  query: string,
  responses: LearnerResponse[],
): string {
  const relevant = responses.filter((r) => r.relevant)

  let knowledgeText: string
  if (relevant.length > 0) {
    knowledgeText = relevant
      .map(
        (r) =>
          `KNOWLEDGE (relevance: ${(r.relevance * 100).toFixed(0)}%, confidence: ${(r.confidence * 100).toFixed(0)}%):
${r.insight}${r.gaps.length > 0 ? `\nGaps: ${r.gaps.join(', ')}` : ''}`,
      )
      .join('\n\n')
  } else {
    knowledgeText = '(No relevant knowledge available)'
  }

  return `QUESTION:
${query}

${knowledgeText}`
}
```

Key changes:
- System prompt reframed from "synthesizer" to "knowledgeable assistant"
- No learner names in user prompt — anonymous `KNOWLEDGE` sections
- Confidence AND relevance labels retained for LLM weighting
- Explicit "match the user's requested format" instruction
- Explicit "do not mention sources or internal structure" instruction
- Irrelevant learner list removed from prompt (was noise)

---

## Files Changed (Summary)

| File | Changes |
|------|---------|
| `src/learners/text-learner/class.ts` | Add empty short-circuit in `query()`, add buffer fallback for understanding |
| `src/learners/text-learner/query-methods/direct/prompt.system.ts` | Add brevity instruction for irrelevant queries |
| `src/learners/text-learner/query-methods/tool-based/prompt.template.query.ts` | Add skip-to-complete instruction for irrelevant queries |
| `src/brain/class.ts` | Filter empty learners before querying in `ask()` |
| `src/brain/prompts/prompt.synthesis.system.ts` | Rewrite — knowledgeable assistant framing |
| `src/brain/prompts/prompt.synthesis.user.ts` | Rewrite — anonymous knowledge sections with relevance + confidence |

---

## Verification

1. **Dead zone**: Create brain, inject data (don't trigger synthesis), query immediately — should get answers from buffered observations
2. **Verbose rejections**: Ask out-of-scope question — learner insight should be 1 sentence max, not an essay
3. **Empty learners**: Create empty learner, query brain — empty learner should NOT appear in sources, no LLM call should be made for it
4. **Architecture leaking**: Ask any question — response should NOT mention learners, confidence scores, synthesis, or internal structure
5. **Format constraints**: Ask "describe X in 3 words" — response should be 3 words, not a paragraph
