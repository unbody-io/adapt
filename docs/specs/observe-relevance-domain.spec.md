# Observe Phase: Domain-Aware Relevance

## Problem

During evolution lifecycle testing (Session 7), we injected ~900 noise items (recipes, sports scores, nature facts) into a brain with 5 software-engineering learners. Expected: high dismissal rates → signals → evolution. Actual: learners accepted ~5% of noise via abstract pattern-matching.

Evidence: `problem-solving-approach` learner's understanding contains "mirroring the precision required in complex culinary arts (e.g., detailed, time-bound, temperature-dependent processes like croissants or espresso)" — cooking data absorbed as metaphor for engineering precision.

### Root Cause

The observe system prompt template (`prompt.template.system.ts`) has a weak relevance section:

```
## Relevance
Data is relevant when it directly relates to your focus areas.
Dismiss data that doesn't connect to what you're tracking.
```

One vague sentence for dismissal. Meanwhile the observation guidelines say "Be exhaustive", "Miss nothing" — biasing the LLM toward acceptance. The per-learner identity paragraphs ARE domain-specific, but the generic framework undermines them by not anchoring relevance to a concrete domain.

## Changes

### 1. Add `domain` to observe identity schema

**File:** `src/learners/text-learner/learning-methods/two-phase/observe/schema.identity.ts`

Add a `domain` field alongside `identity`:

```typescript
export const observeIdentitySchema = z.object({
  identity: z
    .string()
    .describe(
      'Plain text identity: who you are (second person) and what you focus on when observing data',
    ),
  domain: z
    .string()
    .describe(
      'The broad subject area this observer covers',
    ),
})

export type ObserveIdentity = { identity: string; domain: string }
```

### 2. Update identity generation prompt to produce `domain`

**File:** `src/learners/text-learner/learning-methods/two-phase/observe/prompt.template.identity.ts`

Update the meta-prompt:
- Ask for `domain` alongside `identity` in the task description
- Update the response format JSON to include `domain`
- Remove the domain-specific example (the "Track coding preferences" example) — it biases generation toward that specific domain. If an example is needed, keep it purely structural (showing shape, not content)

Response format becomes:

```json
{
  "identity": "You are a [domain] observer...",
  "domain": "the broad subject area"
}
```

### 3. Rewrite observe system prompt relevance section

**File:** `src/learners/text-learner/learning-methods/two-phase/observe/prompt.template.system.ts`

The function signature stays the same (`observeSystemPromptTemplate(identity: ObserveIdentity): string`) — it already receives the full identity object.

**Relevance section** — replace the current 2-line section with domain-anchored guidance:

```
## Relevance
Your domain: ${identity.domain}

Data may be fully relevant, partly relevant, or entirely outside your domain.
Evaluate whether the content literally relates to your domain.
Do not draw abstract parallels or metaphorical connections —
if the data is not directly about your domain, dismiss it.
```

**Observation guidelines** — tone down acceptance bias:

```
**Be selective**: Only extract facts that directly relate to your domain.
**Be literal**: Quote or closely paraphrase what the source actually says.
**Be direct**: One fact per line, no commentary.
```

Remove "Be exhaustive", "Miss nothing."

### 4. Add optional `focus` parameter

Thread an optional `focus` field through the learner config to give developers (or the evolution system) explicit control over what a learner pays attention to, separate from its purpose/instructions.

**Where `focus` flows:**

a. **Config types** — add `focus?: string` to:
   - `GeneratedLearnerConfig` (in `src/learners/schema.config.ts`)
   - `TextLearnerConfig` (in `src/learners/text-learner/types.ts`)
   - `TwoPhaseUpdateConfig` (in `src/learners/text-learner/learning-methods/two-phase/types.ts`)

b. **TextLearner** — store `focus` as a field (like `instructions`), pass to TwoPhaseMethod:
   - `src/learners/text-learner/class.ts`: store `this.focus = rawConfig.focus`, pass to `init()` and `update()`

c. **TwoPhaseMethod** — store `focus`, use as regen trigger:
   - `src/learners/text-learner/learning-methods/two-phase/index.ts`
   - In `update()`: if `config.focus` changed → `needsObserveRegen = true`
   - In the regen block: `initObserve(blueprintModel, this.instructions, this.focus)`

d. **initObserve** — accept optional `focus`:
   - `src/learners/text-learner/learning-methods/two-phase/observe/index.ts`
   - Signature: `initObserve(model, instructions, focus?)`
   - Pass `focus` to `observeIdentityPromptTemplate(instructions, focus)`

e. **Identity prompt template** — use `focus` when provided:
   - `src/learners/text-learner/learning-methods/two-phase/observe/prompt.template.identity.ts`
   - When `focus` is present, include it in the prompt: "The developer has specified these focus areas: ..."
   - When absent, behavior is unchanged (identity generated purely from instructions)

**Runtime behavior of `learner.update({focus: "..."})`:**

1. Focus value stored on TwoPhaseMethod
2. `needsObserveRegen = true` — triggers blueprint LLM call
3. `initObserve()` generates new identity + domain incorporating focus
4. New system prompt replaces cached one
5. Next `learn()` call uses new prompt
6. Buffer and understanding are NOT affected — only future observations change

## Verification

After applying changes:

1. Re-run the evolution lifecycle test (5 phases, 500+ items)
2. Phase 4 (noise) should show significantly higher dismissal rates — close to 100%
3. No noise should leak into learner understandings
4. Higher dismissal rates should trigger governance signals → evaluator → evolution decisions
5. Test with a broad-domain learner (e.g. "daily habits across activities") to confirm it doesn't over-filter
