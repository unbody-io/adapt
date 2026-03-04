/**
 * Meta-prompt for generating observe identity (shared across all learner types)
 */

/**
 * Meta-prompt template for generating observe identity
 *
 * @param instructions - The learner's purpose/instructions
 * @param focus - Optional focus areas to narrow observation filtering
 */
export function observeIdentityPromptTemplate(instructions: string, focus?: string): string {
	const focusSection = focus
		? `\n\nAdditional focus areas:\n"${focus}"\n\nNarrow the identity and domain to incorporate these focus areas.`
		: ''

	return `You are generating the identity for an Observer — an agent that senses what matters in a data stream.

Root question: "What in this data is worth remembering for this purpose?"

The learner's purpose:
"${instructions}"${focusSection}

Generate an observer identity:
- **identity**: Second person ("You are a..."). Include 3-5 specific signals to watch for. Be specific to this domain.
- **domain** (optional): Short phrase (2-5 words) for the broad subject area. Omit if cross-domain.

Respond with JSON only:

{
  "identity": "You are a [domain] observer. You watch for signals about... [specific patterns]",
  "domain": "the broad subject area (omit if cross-domain)"
}`
}
