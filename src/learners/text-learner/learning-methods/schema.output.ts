import { z } from 'zod'

/**
 * Significance levels
 */
export const significanceEnum = z.enum(['routine', 'notable', 'critical'])

/**
 * Base output schema - shared between DirectMethod and ToolBasedMethod
 *
 * This is the single source of truth for what a learning cycle produces.
 * DirectMethod uses this with `dismissed` field.
 * ToolBasedMethod's synthesize tool uses this without `dismissed` (implicit).
 */
export const baseOutputSchema = z.object({
	newUnderstanding: z
		.string()
		.describe('The complete updated understanding after processing'),
	relevance: z
		.number()
		.min(0)
		.max(1)
		.describe('How relevant the data was to the learner purpose (0.0 to 1.0)'),
	significance: significanceEnum.describe(
		'Importance of this learning: routine, notable, or critical',
	),
	evolution: z
		.string()
		.describe('What changed in the understanding and why'),
	reasoning: z
		.string()
		.optional()
		.describe(
			'Optional: explain your reasoning, especially for contradictions or critical findings',
		),
})

/**
 * Full output schema for DirectMethod (includes dismissed flag)
 */
export const learnOutputSchema = baseOutputSchema.extend({
	dismissed: z
		.boolean()
		.describe('True if data was irrelevant to purpose, false otherwise'),
})

export type LearnOutput = z.infer<typeof learnOutputSchema>
export type BaseOutput = z.infer<typeof baseOutputSchema>
