/**
 * Zod schema for split action LLM output
 */

import { z } from 'zod'

/**
 * Schema for split action output
 *
 * LLM divides one learner into multiple focused learners
 */
export const splitOutputSchema = z.object({
	learners: z
		.array(
			z.object({
				name: z.string().describe('Name for the split learner'),
				description: z
					.string()
					.describe('Description of this split learner purpose'),
				instructions: z
					.string()
					.describe('Focused instructions defining scope and responsibilities'),
				understanding: z
					.string()
					.describe('Understanding text for this split learner'),
			}),
		)
		.min(2)
		.describe('Array of 2 or more focused learners'),
})

export type SplitOutput = z.infer<typeof splitOutputSchema>
