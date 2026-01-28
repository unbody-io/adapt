import { z } from 'zod'

/**
 * Done tool for query handling - captures the final response
 */
export const completeParams = z.object({
	relevant: z
		.boolean()
		.describe('Whether this learner can help with the query'),
	confidence: z.number().min(0).max(1).describe('Confidence in the response'),
	insight: z.string().describe('The insight or response to the query'),
	gaps: z.array(z.string()).describe('What could not be answered'),
})

export type CompleteParams = z.infer<typeof completeParams>
