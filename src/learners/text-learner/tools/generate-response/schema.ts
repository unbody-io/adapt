import { z } from 'zod'

export const generateResponseParams = z.object({
	response: z.string().describe('The generated response to the query'),
	confidence: z.number().min(0).max(1).describe('Confidence in the response'),
})

export type GenerateResponseParams = z.infer<typeof generateResponseParams>
