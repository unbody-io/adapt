import { z } from 'zod'

/**
 * Connect new information to existing knowledge
 */
export const connectParams = z.object({
	newInfo: z.string().describe('The new information'),
	relatesTo: z.string().describe('Existing knowledge this connects to'),
	relationship: z
		.enum(['supports', 'exemplifies', 'generalizes', 'contrasts', 'causes', 'caused_by'])
		.describe('How they relate'),
})

export type ConnectParams = z.infer<typeof connectParams>
