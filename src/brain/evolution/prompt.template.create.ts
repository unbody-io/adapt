/**
 * Template for create action prompt
 *
 * Embeds the learner generation fragment with evolution-specific guidance.
 */

import type { LearnerTypeDescriptor } from '../../learners/types'
import { learnerGenerationFragment } from '../prompts/prompt.fragment.learner-generation'

/**
 * Format create prompt with joined guidance and Brain context
 */
export function createPromptTemplate(
	guidance: string,
	brainPrompt: string,
	descriptors: LearnerTypeDescriptor[],
): string {
	return `You are creating new learners for an existing learning system.

# Brain Purpose

${brainPrompt}

# Creation Guidance

${guidance}

# Learner Generation Principles

${learnerGenerationFragment(descriptors)}

Generate the learner configurations based on the guidance above.`
}
