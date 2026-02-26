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

# Important: Prefer Fewer, Broader Learners

This is an evolution create — you are adding coverage for a gap in the system. Unless the guidance explicitly requests multiple learners, create exactly ONE learner that broadly covers the domain. A single well-scoped learner is almost always better than multiple narrow specialists at this stage. The system can split a broad learner into specialists later once it has accumulated enough knowledge.

# Learner Generation Principles

${learnerGenerationFragment(descriptors)}

Generate the learner configurations based on the guidance above. Remember: prefer ONE broad learner per domain.`
}
