/**
 * Schema for observe phase output
 *
 * Observe extracts what's relevant to purpose.
 * No classification, no comparison to understanding - just extraction.
 */

import { z } from 'zod'

/**
 * Status enum for observe output
 */
export const observeStatusEnum = z.enum(['observed', 'dismissed'])

/**
 * Schema for observe phase output
 *
 * - observed: relevant content found
 * - dismissed: nothing relevant to purpose
 */
export const observeOutputSchema = z.object({
	status: observeStatusEnum.describe(
		"'observed' if relevant content was found, 'dismissed' if nothing relevant",
	),
	output: z
		.string()
		.describe(
			'Plain text observations, one per line. Just state what you see — no markers, no importance ratings, no interpretation. Empty string if dismissed.',
		),
	importance: z
		.number()
		.min(0)
		.max(1)
		.describe('How important this observation is (0.0 to 1.0). Use 0.5 if dismissed.'),
})

export type ObserveSchemaOutput = z.infer<typeof observeOutputSchema>
