import { z } from 'zod'

/**
 * Mark something as more or less important in the understanding
 */
export const prioritizeParams = z.object({
	item: z.string().describe('The piece of knowledge being prioritized'),
	level: z
		.enum(['core', 'important', 'peripheral', 'trivial'])
		.describe('Importance level'),
	reason: z.string().describe('Why this level of importance'),
})

export type PrioritizeParams = z.infer<typeof prioritizeParams>
