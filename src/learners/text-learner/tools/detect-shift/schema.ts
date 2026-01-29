import { z } from 'zod'

export const detectShiftParams = z.object({
	shifted: z.boolean().describe('Whether a fundamental shift was detected'),
	from: z
		.string()
		.optional()
		.describe('What the understanding was shifting from'),
	to: z.string().optional().describe('What the understanding is shifting to'),
})

export type DetectShiftParams = z.infer<typeof detectShiftParams>
