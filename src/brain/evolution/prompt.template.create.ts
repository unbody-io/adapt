/**
 * Template for create action prompt
 *
 * Formats guidance with Brain context for LLM to generate learner config
 */

/**
 * Format create prompt with guidance and Brain context
 */
export function createPromptTemplate(
	guidance: string,
	brainPrompt: string,
	learnerCount: number,
): string {
	return `Brain Purpose: ${brainPrompt}

Current Learners: ${learnerCount}

Task: ${guidance}

Generate a learner configuration that fulfills this need.`
}
