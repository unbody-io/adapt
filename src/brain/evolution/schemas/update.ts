/**
 * Zod schema for update action LLM output
 *
 * Decomposes guidance into:
 * - mechanical: specific field values (name, description, thresholds)
 * - behavioral: directive for neuron.adjust() (incremental evolution)
 */

import { z } from 'zod'

export const updateOutputSchema = z.object({
	mechanical: z
		.object({
			name: z
				.string()
				.nullable()
				.describe('Updated name (null if not changing)'),
			description: z
				.string()
				.nullable()
				.describe('Updated description (null if not changing)'),
			thresholds: z
				.object({
					minImportance: z
						.number()
						.min(0)
						.max(1)
						.nullable()
						.describe('Updated importance threshold (null if not changing)'),
					maxObservations: z
						.number()
						.int()
						.min(1)
						.nullable()
						.describe('Updated max buffer size (null if not changing)'),
				})
				.nullable()
				.describe('Updated synthesis thresholds (null if not changing)'),
		})
		.describe('Mechanical config changes — specific field values'),
	behavioral: z
		.string()
		.describe(
			'Directive for incremental behavioral evolution (for adjust()). ' +
				'Describes how the neuron should evolve its focus, instructions, and prompts. ' +
				'Empty string if no behavioral change needed.',
		),
	reasoning: z
		.string()
		.describe('Explanation of what changed and why (1-2 sentences)'),
})

export type UpdateOutput = z.infer<typeof updateOutputSchema>
