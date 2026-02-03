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
		.describe('The complete updated understanding. Empty string if status is dismissed.'),
	significance: significanceEnum.describe(
		'Importance of this change. Use "routine" if status is dismissed.',
	),
	evolution: z
		.string()
		.describe('What changed and why. Empty string if status is dismissed.'),
	reasoning: z.string().describe('Explanation of key decisions. Empty string if none.'),
	output: z
		.string()
		.describe('Explanation of why nothing changed. Empty string if status is synthesized.'),
})

export type SynthesizeSchemaOutput = z.infer<typeof synthesizeOutputSchema>
