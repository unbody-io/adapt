/**
 * Zod schema for merge action LLM output
 */

import { z } from 'zod'

/**
 * Schema for merge action output
 *
 * LLM synthesizes multiple learner configs and understandings into a unified learner
 */
export const mergeOutputSchema = z.object({
	config: z.object({
		name: z.string().describe('Name for the merged learner'),
		description: z
			.string()
			.describe('Description of the merged learner purpose'),
		instructions: z
			.string()
			.describe('Combined instructions defining scope and responsibilities'),
	}),
	understanding: z
		.string()
		.describe(
			'Merged understanding text combining knowledge from all source learners',
		),
})

export type MergeOutput = z.infer<typeof mergeOutputSchema>
