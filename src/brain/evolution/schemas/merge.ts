/**
 * Zod schema for merge action LLM output
 */

import { z } from 'zod'

/**
 * Schema for merge action output
 *
 * LLM synthesizes multiple neuron configs and understandings into a unified neuron
 */
export const mergeOutputSchema = z.object({
	config: z.object({
		name: z.string().describe('Name for the merged neuron'),
		description: z
			.string()
			.describe('Description of the merged neuron purpose'),
		instructions: z
			.string()
			.describe('Combined instructions defining scope and responsibilities'),
	}),
	understanding: z
		.string()
		.describe(
			'Merged understanding text combining knowledge from all source neurons',
		),
})

export type MergeOutput = z.infer<typeof mergeOutputSchema>
