/**
 * Prompt template for adjusting an existing observer identity
 *
 * Unlike the identity prompt (used at init), this shows the LLM
 * the current state so it can evolve rather than replace.
 * Also resolves new canonical instructions from the directive.
 */

import type { ObserveIdentity } from '../schema.identity'

/**
 * Prompt template for adjusting observer identity + resolving new instructions
 *
 * @param directive - Natural language directive describing what to change
 * @param currentInstructions - The learner's current purpose/instructions
 * @param currentIdentity - The current observer identity
 * @param focus - Optional focus areas
 */
export function observeAdjustPromptTemplate(
	directive: string,
	currentInstructions: string,
	currentIdentity: ObserveIdentity,
	focus?: string,
): string {
	const focusSection = focus
		? `\n**Focus areas**: "${focus}"`
		: ''

	const domainSection = currentIdentity.domain
		? `\n**Observer Domain**: ${currentIdentity.domain}`
		: '\n**Observer Domain**: (cross-domain)'

	return `You are adjusting an existing Observer — an agent that notices what matters in data.

## Current State

**Instructions** (the learner's purpose):
"${currentInstructions}"

**Observer Identity**:
"${currentIdentity.identity}"
${domainSection}${focusSection}

## Adjustment Directive

"${directive}"

## Your Task

Apply the directive to evolve the current state. Produce:

1. **Updated instructions** — The learner's purpose after applying the directive.
   Preserve everything that should stay. Only change what the directive asks for.

2. **Updated observer identity** — Written in second person ("You are a...").
   Include 3-5 specific signals/patterns to watch for.
   Be specific and actionable for this domain, not generic.

3. **Updated domain** — A short phrase (2-5 words) for the broad subject area.
   Omit if cross-domain or general-purpose.

## Rules

- This is an INCREMENTAL adjustment, not a full rewrite
- Preserve accumulated specificity from the current identity
- "also track X" → ADD to identity, don't replace existing signals
- "stop tracking X" → REMOVE from identity
- "only track X" → REPLACE (the directive is explicit about replacing)
- If the directive is ambiguous, preserve more rather than less

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object:

{
  "instructions": "the updated instructions",
  "identity": "the updated observer identity",
  "domain": "the updated domain (omit if cross-domain)"
}`
}
