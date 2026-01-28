import { z } from 'zod'

/**
 * Done tool for data processing - captures the synthesized understanding
 */
export const synthesizeParams = z.object({
	newUnderstanding: z
		.string()
		.describe('The updated understanding after processing the data'),
	relevance: z
		.number()
		.min(0)
		.max(1)
		.describe('How relevant the data was to the learner purpose'),
	entry: z.object({
		summary: z.string().describe('Brief description of what changed and why'),
		significance: z
			.enum(['routine', 'notable', 'critical'])
			.describe(
				'routine = normal refinement, notable = new pattern or meaningful shift, critical = watched condition triggered',
			),
	}),
})

export type SynthesizeParams = z.infer<typeof synthesizeParams>
