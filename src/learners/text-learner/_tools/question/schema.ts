import { z } from 'zod'

/**
 * Express doubt or uncertainty about information
 */
export const questionParams = z.object({
	claim: z.string().describe('The claim or information being questioned'),
	concern: z
		.enum(['contradicts_other_data', 'seems_unlikely', 'needs_verification', 'incomplete'])
		.describe('Why this is being questioned'),
	explanation: z.string().describe('Brief explanation of the doubt'),
})

export type QuestionParams = z.infer<typeof questionParams>
