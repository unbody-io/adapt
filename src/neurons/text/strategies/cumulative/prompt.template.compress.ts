/**
 * Template prompt for cumulative cycle reset
 * Creates a seed for the next learning cycle
 */
export function cumulativeSeedPromptTemplate(
	understanding: string,
	maxTokens: number,
): string {
	const targetTokens = Math.floor(maxTokens * 0.7)

	return `You are distilling a learning agent's understanding into a seed for a new learning cycle.

CURRENT UNDERSTANDING:
${understanding}

TASK:
Create a seed (approximately ${targetTokens} tokens) that captures:
- Core patterns and facts discovered
- Key insights worth preserving
- Foundation for continued learning

The seed should be self-contained — a fresh starting point, not a continuation.
Write it as if beginning a new document that builds on established knowledge.

Output ONLY the seed, nothing else.`
}
