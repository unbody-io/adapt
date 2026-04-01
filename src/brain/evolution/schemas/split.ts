/**
 * Zod schema for split action LLM output
 */

import { z } from 'zod'

/**
 * Schema for split action output
 *
 * LLM divides one neuron into multiple focused neurons
 */
export const splitOutputSchema = z.object({
	neurons: z
		.array(
			z.object({
				name: z.string().describe('Name for the split neuron'),
				description: z
					.string()
					.describe('Description of this split neuron purpose'),
				instructions: z
					.string()
					.describe('Focused instructions defining scope and responsibilities'),
				understanding: z
					.string()
					.describe('Understanding text for this split neuron'),
			}),
		)
		.min(2)
		.describe('Array of 2 or more focused neurons'),
})

export type SplitOutput = z.infer<typeof splitOutputSchema>
