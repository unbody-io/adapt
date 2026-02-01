type SkillDef = { key: string; meaning: string }

/**
 * Convert a skills object to prompt text
 */
export function skillsToPromptText(skills: Record<string, SkillDef>): string {
	return Object.values(skills)
		.map((s) => `- ${s.key.toUpperCase()}: ${s.meaning}`)
		.join('\n')
}
