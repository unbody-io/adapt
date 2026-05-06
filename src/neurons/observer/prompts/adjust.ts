/**
 * Prompt template for adjusting an existing observer identity
 */

import type { ObserveIdentity } from '../schema.identity'

/**
 * Prompt template for adjusting observer identity + resolving new instructions
 *
 * @param directive - Natural language directive describing what to change
 * @param currentInstructions - The neuron's current purpose/instructions
 * @param currentIdentity - The current observer identity
 * @param focus - Optional focus areas
 */
export function observeAdjustPromptTemplate(
	directive: string,
	currentInstructions: string,
	currentIdentity: ObserveIdentity,
	focus?: string,
): string {
	const focusSection = focus ? `\n**Focus areas**: "${focus}"` : ''

	const domainSection = currentIdentity.domain
		? `\n**Domain**: ${currentIdentity.domain}`
		: '\n**Domain**: (cross-domain)'

	return `You are adjusting an Observer's identity.

## Current State

**Instructions**: "${currentInstructions}"
**Identity**: "${currentIdentity.identity}"${domainSection}${focusSection}

## Directive

"${directive}"

Apply the directive incrementally — preserve what should stay, change what the directive asks for. Keep 3-5 specific signals. Preserve specificity from the current identity.

If the directive is ambiguous, preserve more rather than less.

Respond with JSON only:

{
  "instructions": "the updated instructions",
  "identity": "the updated observer identity",
  "domain": "the updated domain (omit if cross-domain)"
}`
}
