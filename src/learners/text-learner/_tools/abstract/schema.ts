import { z } from 'zod'

/**
 * Extract a general principle from specific observations
 */
export const abstractParams = z.object({
	principle: z.string().describe('The general principle or abstraction'),
	derivedFrom: z.array(z.string()).describe('Specific observations this generalizes'),
})

export type AbstractParams = z.infer<typeof abstractParams>
