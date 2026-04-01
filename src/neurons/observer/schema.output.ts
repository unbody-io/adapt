/**
 * Schema for observe phase output (shared across all neuron types)
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
		.array(z.string())
		.describe(
			'Array of discrete observations. Each string is one standalone fact or insight. Just state what you see — no markers, no importance ratings, no interpretation. Empty array if dismissed.',
		),
	importance: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'How important this observation is (0.0 to 1.0). Use 0.5 if dismissed.',
		),
	gaps: z
		.array(z.string())
		.describe(
			'When dismissed: briefly describe what topics or content you encountered but could not claim as relevant to your domain. One topic per string. Empty array if observed.',
		),
})

export type ObserveSchemaOutput = z.infer<typeof observeOutputSchema>

/**
 * Build a dynamic observe output schema using a JSON Schema for items.
 * When an observationSchema is provided, observation items match that schema
 * instead of being plain strings.
 */
export function buildObserveOutputSchema(observationSchema: Record<string, unknown>) {
	const itemSchema = z.fromJSONSchema(observationSchema)

	return z.object({
		status: observeStatusEnum.describe(
			"'observed' if relevant content was found, 'dismissed' if nothing relevant",
		),
		output: z
			.array(itemSchema)
			.describe(
				'Array of discrete observations. Each item follows the defined schema. Empty array if dismissed.',
			),
		importance: z
			.number()
			.min(0)
			.max(1)
			.describe(
				'How important this observation is (0.0 to 1.0). Use 0.5 if dismissed.',
			),
		gaps: z
			.array(z.string())
			.describe(
				'When dismissed: briefly describe what topics or content you encountered but could not claim as relevant to your domain. One topic per string. Empty array if observed.',
			),
	})
}
