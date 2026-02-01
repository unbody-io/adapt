import type { Identity } from './schema.init'
import { compare, skillsToPromptText } from '../../cognitive-skills'

/**
 * Light cognitive guidance
 */
const COGNITIVE_HINTS = `## Processing Guidance
- Consider what you can infer beyond explicit data
- Flag uncertainties and contradictions
- Note confidence levels where relevant
- Resolve conflicts by weighing evidence`

/**
 * Understanding format guidance
 */
const UNDERSTANDING_FORMAT = `## Understanding Format
You maintain a living document - not a transcript. It captures patterns, hypotheses, uncertainties, and how your beliefs evolve. Keep it readable and organized for your domain.`

/**
 * Format classification guidance from identity
 */
function formatClassificationGuidance(guidance: Identity['classificationGuidance']): string {
	return Object.entries(guidance)
		.map(([key, tip]) => `- **${key.toUpperCase()}**: ${tip}`)
		.join('\n')
}

/**
 * System prompt template from generated identity and strategy
 */
export function systemPromptTemplate(
	identity: Identity,
	strategyPrompt: string,
): string {
	const focusAreas = identity.focusAreas.map((f) => `- ${f}`).join('\n')
	const skillsText = skillsToPromptText(compare.skills)
	const classificationGuidance = formatClassificationGuidance(identity.classificationGuidance)

	return `${identity.purpose}

## Focus Areas
${focusAreas}

## Significance Criteria
- **Routine**: ${identity.significanceCriteria.routine}
- **Notable**: ${identity.significanceCriteria.notable}
- **Critical**: ${identity.significanceCriteria.critical}

## Comparison (Cognitive Skill-Set)
${compare.skillSet.question}

${skillsText}

### Domain-Specific Guidance
${classificationGuidance}

## Update Strategy
${strategyPrompt}

${COGNITIVE_HINTS}

${UNDERSTANDING_FORMAT}`
}
