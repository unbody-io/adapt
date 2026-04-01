/**
 * Utility functions for neurons
 */

/**
 * Estimate token count for a string
 * Uses a simple heuristic: ~4 characters per token on average
 * This is a rough estimate - actual tokenization depends on the model
 */
export function estimateTokens(text: string): number {
	if (!text) return 0
	// Average of ~4 characters per token for English text
	return Math.ceil(text.length / 4)
}
