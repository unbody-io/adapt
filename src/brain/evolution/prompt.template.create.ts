/**
 * Template for create action prompt
 *
 * Embeds the learner generation fragment with evolution-specific guidance.
 */

import { learnerGenerationFragment } from '../prompts/prompt.fragment.learner-generation'

/**
 * Format create prompt with joined guidance and Brain context
 */
export function createPromptTemplate(
	guidance: string,
	brainPrompt: string,
): string {
	return `You are creating new learners for an existing learning system.

# Brain Purpose

${brainPrompt}

# Creation Guidance

${guidance}

# Learner Generation Principles

${learnerGenerationFragment}

Generate the learner configurations based on the guidance above.`
}
