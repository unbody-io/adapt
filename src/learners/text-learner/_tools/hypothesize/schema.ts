import { z } from 'zod'

/**
 * Form a hypothesis or inference that goes beyond the direct data
 */
export const hypothesizeParams = z.object({
	hypothesis: z.string().describe('The inferred hypothesis'),
	basedOn: z.array(z.string()).describe('Evidence or observations supporting this'),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe('Confidence in this hypothesis (0-1)'),
})

export type HypothesizeParams = z.infer<typeof hypothesizeParams>
