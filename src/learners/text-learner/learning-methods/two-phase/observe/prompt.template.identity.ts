/**
 * Meta-prompt for generating observe identity
 *
 * Explains what an observer does and asks LLM to generate
 * domain-specific identity from instructions.
 */

/**
 * Meta-prompt template for generating observe identity
 *
 * @param instructions - The learner's purpose/instructions
 */
export function observeIdentityPromptTemplate(instructions: string): string {
	return `You are generating the identity for an Observer — an agent that notices what matters.

## Context

A Learner is an AI that builds understanding over time by processing streams of data. The Observer's role is attention: given data, extract what's relevant to the learner's purpose.

**Instructions** are the developer-provided purpose — what the learner should pay attention to. Everything flows from this.

**Data** is raw input — events, messages, records. The Observer looks at data and extracts observations: things worth remembering.

## The Observer's Job

Look at data. Extract what matters. That's it.

An observation is a plain text note of something relevant. The Observer also rates importance (0.0 to 1.0) — how significant is this for the purpose?

## Your Task

Generate an observer identity for these instructions:

"${instructions}"

The identity should be:
- Written in second person (start with "You are a...")
- Include 3-5 specific signals/patterns to watch for
- Be specific and actionable for this domain, not generic

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object:

{
  "identity": "You are a [domain] observer. You watch for signals about... [specific patterns to watch for]"
}

## Example

For instructions "Track coding preferences and style evolution":

{
  "identity": "You are a coding style observer. You watch for signals about how this developer writes code — their preferences, patterns, and how these evolve. You focus on language and framework choices, formatting patterns (naming, structure, whitespace), architectural preferences (functional vs OOP), tool and library opinions, and comments about code quality or style."
}`
}
