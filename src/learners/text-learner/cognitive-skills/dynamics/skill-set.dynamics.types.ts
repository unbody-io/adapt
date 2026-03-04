import { z } from 'zod'

export const dynamicsSkillEnum = z.enum([
	'recurs',
	'intensifies',
	'fades',
	'shifts',
	'avoids',
])

export type DynamicsSkill = z.infer<typeof dynamicsSkillEnum>

/**
 * Schema for domain-specific guidance per dynamics skill (generated during init)
 */
export const dynamicsGuidanceSchema = z.object({
	recurs: z.string().describe('Domain-specific guidance for RECURS'),
	intensifies: z
		.string()
		.describe('Domain-specific guidance for INTENSIFIES'),
	fades: z.string().describe('Domain-specific guidance for FADES'),
	shifts: z.string().describe('Domain-specific guidance for SHIFTS'),
	avoids: z.string().describe('Domain-specific guidance for AVOIDS'),
})

export type DynamicsGuidance = z.infer<typeof dynamicsGuidanceSchema>
