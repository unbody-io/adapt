import type { LearnContext } from '../types'

/**
 * User prompt template for learn() - data and current understanding
 */
export function learnPromptTemplate(context: LearnContext): string {
	const hasUnderstanding = context.currentUnderstanding?.trim()

	return `## Current Understanding
${hasUnderstanding ? context.currentUnderstanding : '(No understanding yet. This is your first exposure to data.)'}

## New Data
${JSON.stringify(context.data, null, 2)}

Process this data according to your purpose. Classify observations, update your understanding, and return your analysis.`
}
