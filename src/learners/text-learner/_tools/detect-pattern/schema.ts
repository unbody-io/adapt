import { z } from 'zod'

export const detectPatternParams = z.object({
	pattern: z.string().optional().describe('The emerging pattern, if detected'),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe('Confidence in the pattern detection'),
})

export type DetectPatternParams = z.infer<typeof detectPatternParams>
