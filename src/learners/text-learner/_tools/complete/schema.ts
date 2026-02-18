import { z } from 'zod'

/**
 * Done tool for query handling - captures the final response
 */
export const completeParams = z.object({
	relevant: z
		.boolean()
		.describe('Is this query within your area of expertise/purpose?'),
	relevance: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'How related is this query to your domain/purpose? 0.0 = completely outside your scope, 1.0 = core to what you do',
		),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'How well could you answer from your understanding? 0.0 = you have nothing on this topic, 1.0 = you fully answered. If outside your scope, this should be 0.0',
		),
	insight: z.string().describe('The insight or response to the query'),
	gaps: z.array(z.string()).describe('What could not be answered'),
})

export type CompleteParams = z.infer<typeof completeParams>
