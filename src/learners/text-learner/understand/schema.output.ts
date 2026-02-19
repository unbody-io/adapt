/**
 * Schema for text understand phase output
 */

import { z } from 'zod'

export const significanceEnum = z.enum(['routine', 'notable', 'critical'])
export const understandStatusEnum = z.enum(['synthesized', 'dismissed'])

export const understandOutputSchema = z.object({
	status: understandStatusEnum.describe(
		"'synthesized' if understanding was updated, 'dismissed' if no changes needed",
	),
	newUnderstanding: z
		.string()
		.describe(
			'The complete updated understanding. Empty string if status is dismissed.',
		),
	significance: significanceEnum.describe(
		'Importance of this change. Use "routine" if status is dismissed.',
	),
	evolution: z
		.string()
		.describe('What changed and why. Empty string if status is dismissed.'),
	reasoning: z
		.string()
		.describe('Explanation of key decisions. Empty string if none.'),
	output: z
		.string()
		.describe(
			'Explanation of why nothing changed. Empty string if status is synthesized.',
		),
})

export type UnderstandSchemaOutput = z.infer<typeof understandOutputSchema>
