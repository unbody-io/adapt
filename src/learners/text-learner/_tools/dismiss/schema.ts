import { z } from 'zod'

/**
 * Done tool for dismissing irrelevant data - no understanding update needed
 */
export const dismissParams = z.object({
	reason: z
		.string()
		.describe(
			'Brief explanation of why the data is irrelevant to the learner purpose',
		),
})

export type DismissParams = z.infer<typeof dismissParams>
