/**
 * Zod schema for update action LLM output
 *
 * Decomposes guidance into:
 * - mechanical: specific field values (name, description, thresholds)
 * - behavioral: directive for learner.adjust() (incremental evolution)
 */

import { z } from 'zod'

export const updateOutputSchema = z.object({
	mechanical: z.object({
		name: z.string().optional().describe('Updated name (if needed)'),
		description: z
			.string()
			.optional()
			.describe('Updated description (if needed)'),
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
	}).describe('Mechanical config changes — specific field values'),
	behavioral: z
		.string()
		.describe(
			'Directive for incremental behavioral evolution (for adjust()). ' +
			'Describes how the learner should evolve its focus, instructions, and prompts. ' +
			'Empty string if no behavioral change needed.',
		),
	reasoning: z
		.string()
		.describe('Explanation of what changed and why (1-2 sentences)'),
})

export type UpdateOutput = z.infer<typeof updateOutputSchema>
