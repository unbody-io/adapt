/**
 * Schema for synthesize phase output
 *
 * Synthesize updates understanding based on observations.
 */

import { z } from 'zod'

/**
 * Significance levels
 */
export const significanceEnum = z.enum(['routine', 'notable', 'critical'])

/**
 * Status enum for synthesize output
 */
export const synthesizeStatusEnum = z.enum(['synthesized', 'dismissed'])

/**
 * Schema for synthesize phase output
 *
 * - synthesized: understanding was updated
 * - dismissed: observations didn't change understanding
 */
export const synthesizeOutputSchema = z.object({
	status: synthesizeStatusEnum.describe(
		"'synthesized' if understanding was updated, 'dismissed' if no changes needed",
	),
	newUnderstanding: z
		.string()
		.optional()
		.describe('The complete updated understanding. Only present if status is synthesized.'),
	significance: significanceEnum
		.optional()
		.describe('Importance of this change. Only present if status is synthesized.'),
	evolution: z
		.string()
		.optional()
		.describe('What changed and why. Only present if status is synthesized.'),
	reasoning: z
		.string()
		.optional()
		.describe('Optional explanation of key decisions.'),
	output: z
		.string()
		.optional()
		.describe('Explanation of why nothing changed. Only present if status is dismissed.'),
})

export type SynthesizeSchemaOutput = z.infer<typeof synthesizeOutputSchema>
