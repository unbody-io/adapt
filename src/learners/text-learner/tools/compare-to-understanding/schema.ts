import { z } from 'zod'

export const compareToUnderstandingParams = z.object({
	relation: z
		.enum(['confirms', 'contradicts', 'extends', 'new', 'irrelevant'])
		.describe(
			'How data relates to understanding: confirms (supports existing), contradicts (conflicts), extends (adds detail), new (relevant but unknown), irrelevant (off-purpose)',
		),
	explanation: z.string().describe('Brief explanation of the classification'),
})

export type CompareToUnderstandingParams = z.infer<typeof compareToUnderstandingParams>
