import { z } from 'zod'
import { compare } from '../../cognitive-skills'

/**
 * Tool for comparing observations against existing understanding
 *
 * Use this to trace how each piece of data relates to what you already know.
 * This is optional but useful for traceability in the learning process.
 */
export const classifyParams = z.object({
	observation: z.string().describe('The specific observation from the data'),
	skill: compare.compareSkillEnum.describe(
		'How this observation relates to existing understanding',
	),
	reasoning: z
		.string()
		.describe('Brief explanation of why this skill applies'),
})

export type ClassifyParams = z.infer<typeof classifyParams>
