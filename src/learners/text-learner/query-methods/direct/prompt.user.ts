import type { QueryContext } from '../types'

/**
 * User prompt for learner query
 *
 * Provides the understanding and question.
 * Kept minimal - just the data needed.
 */
export function buildQueryUserPrompt(context: QueryContext): string {
	const hasUnderstanding = context.understanding?.trim()

	return `MY UNDERSTANDING:
${hasUnderstanding ? context.understanding : '(Empty - no data processed yet)'}

QUESTION:
${context.question}`
}
