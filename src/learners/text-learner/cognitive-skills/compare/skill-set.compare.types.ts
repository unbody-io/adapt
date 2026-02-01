import { z } from 'zod'

export const compareSkillEnum = z.enum([
	'confirms',
	'contradicts',
	'extends',
	'new',
	'irrelevant',
])

export type CompareSkill = z.infer<typeof compareSkillEnum>

/**
 * Schema for domain-specific guidance per skill (generated during init)
 * Note: excludes irrelevant since that leads to dismiss, not guidance
 */
export const compareGuidanceSchema = z.object({
	confirms: z.string().describe('Domain-specific guidance for CONFIRMS'),
	contradicts: z.string().describe('Domain-specific guidance for CONTRADICTS'),
	extends: z.string().describe('Domain-specific guidance for EXTENDS'),
	new: z.string().describe('Domain-specific guidance for NEW'),
})

export type CompareGuidance = z.infer<typeof compareGuidanceSchema>
