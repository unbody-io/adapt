/**
 * Meta-prompt for generating observe identity
 *
 * Explains what an observer does and asks LLM to generate
 * domain-specific identity and domain label from instructions.
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

	return `You are generating the identity for an Observer — an agent that notices what matters.

## Context

A Learner is an AI that builds understanding over time by processing streams of data. The Observer's role is attention: given data, extract what's relevant to the learner's purpose.

**Instructions** are the developer-provided purpose — what the learner should pay attention to. Everything flows from this.

**Data** is raw input — events, messages, records. The Observer looks at data and extracts observations: things worth remembering.

## The Observer's Job

Look at data. Extract what matters. Dismiss what doesn't belong. That's it.

An observation is a plain text note of something relevant. The Observer also rates importance (0.0 to 1.0) — how significant is this for the purpose?

## Your Task

Generate an observer identity and domain for these instructions:

"${instructions}"${focusSection}

The **identity** should be:
- Written in second person (start with "You are a...")
- Include 3-5 specific signals/patterns to watch for
- Be specific and actionable for this domain, not generic

The **domain** (optional) should be:
- A short phrase (2-5 words) describing the broad subject area
- Used to quickly filter out-of-domain data
- Omit if the observer is cross-domain or general-purpose

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object:

{
  "identity": "You are a [domain] observer. You watch for signals about... [specific patterns to watch for]",
  "domain": "the broad subject area (omit if cross-domain)"
}`
}
