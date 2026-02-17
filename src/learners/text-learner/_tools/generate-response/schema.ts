import { z } from 'zod'

export const generateResponseParams = z.object({
	response: z.string().describe('The generated response to the query'),
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
})

export type GenerateResponseParams = z.infer<typeof generateResponseParams>
