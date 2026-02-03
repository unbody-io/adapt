/**
 * Zod schema for update action LLM output
 */

import { z } from 'zod'

/**
 * Schema for update action output
 *
 * LLM generates partial config updates for a learner
 * Only includes fields that should be modified
 */
export const updateOutputSchema = z.object({
	updates: z.object({
		name: z.string().optional().describe('Updated name (if needed)'),
		description: z
			.string()
			.optional()
			.describe('Updated description (if needed)'),
		instructions: z
			.string()
			.optional()
			.describe('Updated instructions (if scope needs refinement)'),
		thresholds: z
			.object({
				minImportance: z
					.number()
					.min(0)
					.max(1)
					.optional()
					.describe('Updated importance threshold'),
				maxObservations: z
					.number()
					.int()
					.min(1)
					.optional()
					.describe('Updated max buffer size'),
			})
			.optional()
			.describe('Updated synthesis thresholds (if needed)'),
	}),
	reasoning: z
		.string()
		.describe('Explanation of what changed and why (1-2 sentences)'),
})

export type UpdateOutput = z.infer<typeof updateOutputSchema>
