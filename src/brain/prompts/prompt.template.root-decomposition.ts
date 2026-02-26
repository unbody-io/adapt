/**
 * Root decomposition prompt template
 *
 * Reads a raw brain prompt and extracts learner configurations (and future params).
 * Embeds the learner generation fragment for the 7 principles playbook.
 */

import type { LearnerTypeDescriptor } from '../../learners/types'
import { learnerGenerationFragment } from './prompt.fragment.learner-generation'

export const rootDecompositionPrompt = (
	brainPrompt: string,
	descriptors: LearnerTypeDescriptor[],
) =>
	`You are a learning system architect. Your task is to decompose a user's prompt into a set of specialized learners.

# User Prompt

${brainPrompt}

# Task 1: Generate Learner Configurations

${learnerGenerationFragment(descriptors)}

Output the learner configurations now.`
