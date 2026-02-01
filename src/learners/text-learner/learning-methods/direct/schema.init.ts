import { z } from 'zod'
import { compare } from '../../cognitive-skills'

/**
 * Schema for generated identity parts (used in init)
 */
export const identitySchema = z.object({
	purpose: z
		.string()
		.describe('First-person statement of what you track (1-2 sentences)'),
	focusAreas: z
		.array(z.string())
		.describe('3-5 specific things to watch for'),
	significanceCriteria: z.object({
		routine: z.string().describe('What qualifies as routine/expected'),
		notable: z.string().describe('What qualifies as notable/interesting'),
		critical: z.string().describe('What qualifies as critical/urgent'),
	}),
	classificationGuidance: compare.compareGuidanceSchema.describe(
		'Domain-specific guidance for how to think about each skill',
	),
})

export type Identity = z.infer<typeof identitySchema>
