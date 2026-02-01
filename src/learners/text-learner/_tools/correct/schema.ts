import { z } from 'zod'

/**
 * Correct a previous mistake in understanding
 */
export const correctParams = z.object({
	incorrect: z.string().describe('What was previously understood incorrectly'),
	corrected: z.string().describe('The corrected understanding'),
	evidence: z.string().describe('What evidence led to this correction'),
})

export type CorrectParams = z.infer<typeof correctParams>
