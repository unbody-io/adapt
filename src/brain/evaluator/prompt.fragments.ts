/**
 * Decision framework fragments for the Evaluator prompt.
 *
 * Each fragment is injected into the user prompt based on what signal types
 * are present in the buffer. The template in prompt.template.evaluation.ts
 * selects which fragments to include.
 */

import { EVOLUTION_ACTIONS } from './types'

const A = EVOLUTION_ACTIONS

/**
 * Injected when the signal buffer contains a SYSTEM DIRECTIVE (source: "brain").
 * Guides the evaluator through intent classification and per-intent action selection.
 */
export const FRAGMENT_SYSTEM_DIRECTIVE = `# Decision Framework: Purpose Change

The signal buffer contains a SYSTEM DIRECTIVE indicating the brain's purpose has changed. You must decide what to do with existing learners.

## Step 1: Classify the change intent

| Intent | How to identify | Example |
|---|---|---|
| **Related pivot** | Same professional/knowledge domain, different focus | "therapist profiling" → "ADHD therapist focus" |
| **Unrelated pivot** | Completely different domain, zero overlap | "therapist profiling" → "JavaScript bundlers" |
| **Expansion** | Old purpose is subset of new purpose | "track React" → "track React and Vue" |
| **Narrowing** | New purpose is subset of old purpose | "all sports news" → "only tennis news" |
| **Refinement** | Rewording without changing scope | "track news" → "monitor news updates" |
| **Reset** | Signal explicitly says "start over" or "forget everything" | — |

**Classification test**: If the new purpose mentions topics the old learners could plausibly cover (even partially), it's a **related pivot**, not unrelated.

## Step 2: Apply the matching rules

| Intent | Action for EACH learner | After processing all |
|---|---|---|
| **Related pivot** | **${A.update}** — refocus toward new purpose | **${A.merge}** if learners now overlap |
| **Unrelated pivot** | **${A.delete}** — knowledge is useless | **${A.create}** — describe new purpose for decomposer |
| **Expansion** | Keep as-is (no action) | **${A.create}** for new scope areas only |
| **Narrowing** | **${A.update}** if in-scope, **${A.delete}** if out-of-scope | **${A.merge}** if learners now overlap |
| **Refinement** | **${A.update}** only if scope changed, else no action | — |
| **Reset** | **${A.delete}** all | **${A.create}** — describe new purpose for decomposer |

## Critical rules for related pivot

1. **${A.update} ALL learners** — do not ${A.create} new ones. The decomposer will restructure if needed after updates.
2. **NEVER ${A.delete}** a learner with >0 chars of accumulated knowledge during a related pivot.
3. A learner tracking "voice/personality" or "brand/differentiators" IS related to an ADHD therapist focus — these are still about the same therapist.

## Critical rules for unrelated pivot

1. **${A.delete} ALL learners** — their knowledge is genuinely useless.
2. **${A.create} exactly ONE decision** describing the new purpose. The decomposer will determine how many learners to create.

## The cost principle

| Learner knowledge | ${A.delete} cost | Guidance |
|---|---|---|
| None (0 chars) | Free | Safe to delete if purpose is irrelevant |
| Some knowledge | Medium | Prefer ${A.update} unless truly unrelated |
| Significant knowledge | High | Only ${A.delete} for unrelated pivot |

Any learner with accumulated knowledge should be preserved if there's ANY thematic connection to the new purpose.`

/**
 * Injected when the signal buffer contains governance signals (source: learner ID).
 * Guides the evaluator through diagnostic investigation using tools.
 */
export const FRAGMENT_GOVERNANCE = `# Decision Framework: Governance Signals

The signal buffer contains learner performance signals. **Use getUnderstandings() to investigate before deciding.**

## Signal Types

| Signal | What it means |
|---|---|
| **High dismissal** | Learner rejects most data as irrelevant |
| **Low confidence** | Learner uncertain when answering |
| **Stagnation** | Learner hasn't synthesized new knowledge recently |

## Diagnostic Process

For each signal, investigate to find the **root cause**:

### 1. Is the topic exhausted? (Common for stagnation)
- Fetch the learner's understanding
- If it covers a **finite topic** (credentials, bio, founding story) that seems complete → **no action needed** (success, not failure)

### 2. Is the scope too narrow?
- Fetch the learner's understanding
- If understanding is empty or very sparse despite data flowing → **${A.update}** to broaden scope

### 3. Is there overlap with another learner?
- If multiple learners have similar signals (especially high dismissal), fetch their understandings
- If they're capturing similar knowledge → **${A.merge}** them

### 4. Is this a systemic issue?
- If ALL or most learners show the same signal → data stream may have changed
- Consider if the problem is external, not with individual learners → may need no action

### 5. Is the learner misaligned with the brain's purpose?
- Compare learner purpose to brain purpose
- If fundamentally unrelated → **${A.delete}**

## Severity Guide

| Severity | What it means |
|---|---|
| **minor** | Just past threshold — investigate but likely no action needed |
| **moderate** | Clearly past threshold — likely needs action after investigation |
| **severe** | Way past threshold — definitely needs action |

## Available Actions

| Action | When to use |
|---|---|
| **${A.update}** | Refine scope, sharpen instructions, broaden focus |
| **${A.merge}** | Two learners have significant overlap |
| **${A.split}** | One learner is trying to do too much (rare) |
| **${A.delete}** | Learner is fundamentally misaligned (rare for governance signals) |
| **no action** | Topic exhausted, systemic issue, or minor severity |

## Important

- **Investigate before deciding** — use getUnderstandings() to see what learners know
- **Stagnation often means success** — a learner tracking "credentials" that stops synthesizing after capturing all credentials is working correctly
- **Empty array is valid** — if investigation shows no action is needed, return empty decisions`
