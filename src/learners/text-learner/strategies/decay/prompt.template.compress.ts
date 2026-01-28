/**
 * Template prompt for decay compression
 */
export function decayCompressPromptTemplate(
	understanding: string,
	maxTokens: number,
): string {
	const targetTokens = Math.floor(maxTokens * 0.7)

	return `You are compressing a learning agent's understanding using decay - older information fades while recent stays detailed.

CURRENT UNDERSTANDING:
${understanding}

TASK:
The understanding should have three temporal sections:
- Current State: What's true right now (keep detailed)
- Recent Developments: What changed recently (moderate detail)
- Historical Context: Long-standing patterns (compress heavily)

Compress the Historical Context section significantly while preserving key patterns.
Move older items from Recent Developments to Historical Context.
Keep Current State detailed.

Target approximately ${targetTokens} tokens total.
Output ONLY the restructured understanding with the three sections clearly labeled.`
}
