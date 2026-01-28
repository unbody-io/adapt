import { z } from 'zod'

export const identifyGapsParams = z.object({
	gaps: z
		.array(z.string())
		.describe('List of things that could not be answered'),
})

export type IdentifyGapsParams = z.infer<typeof identifyGapsParams>
