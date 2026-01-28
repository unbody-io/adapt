/**
 * Template prompt for cumulative compression
 */
export function cumulativeCompressPromptTemplate(
	understanding: string,
	currentTokens: number,
	maxTokens: number,
): string {
	const targetTokens = Math.floor(maxTokens * 0.7)

	return `You are summarizing a learning agent's understanding to fit within token limits.

CURRENT UNDERSTANDING (${currentTokens} tokens, limit is ${maxTokens}):
${understanding}

TASK:
- Summarize this understanding to approximately ${targetTokens} tokens.
- Preserve the most important patterns, recent observations, and critical insights.
- Output ONLY the summarized understanding, nothing else.`
}
