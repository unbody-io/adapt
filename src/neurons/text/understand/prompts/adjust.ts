/**
 * Prompt template for adjusting an existing text synthesizer identity
 */

import { compare, dynamics, skillsToPromptText } from '../../cognitive-skills'
import type { UnderstandIdentity } from '../schema.identity'

/**
 * Prompt template for adjusting text understand identity
 *
 * @param directive - Natural language directive describing what to change
 * @param newInstructions - The already-resolved new instructions
 * @param currentIdentity - The current understand identity (with skills)
 */
export function understandAdjustPromptTemplate(
	directive: string,
	newInstructions: string,
	currentIdentity: UnderstandIdentity,
): string {
	const compareSkillsText = skillsToPromptText(compare.skills)
	const dynamicsSkillsText = skillsToPromptText(dynamics.skills)

	const currentSkills = currentIdentity.skills
		.map((s) => `- **${s.skill}**: ${s.description}`)
		.join('\n')

	const currentDynamicsSkills = currentIdentity.dynamicsSkills
		.map((s) => `- **${s.skill}**: ${s.description}`)
		.join('\n')

	return `You are adjusting a Synthesizer's cognitive skill prompts.

## Current State

**Instructions**: "${newInstructions}"
**Content Skills**:
${currentSkills}
**Dynamics Skills**:
${currentDynamicsSkills}

## Directive

"${directive}"

## Cognitive Skills

### Content Relationship
${compareSkillsText}

### Dynamics
${dynamicsSkillsText}

Adjust incrementally — preserve skills that still apply, update only the skill questions needed for the new scope. If the directive is ambiguous, preserve more rather than less.

Respond with JSON only:

{
  "skills": [
    { "skill": "confirms", "description": "..." },
    { "skill": "contradicts", "description": "..." },
    { "skill": "extends", "description": "..." },
    { "skill": "new", "description": "..." },
    { "skill": "irrelevant", "description": "..." }
  ],
  "dynamicsSkills": [
    { "skill": "recurs", "description": "..." },
    { "skill": "intensifies", "description": "..." },
    { "skill": "fades", "description": "..." },
    { "skill": "shifts", "description": "..." },
    { "skill": "avoids", "description": "..." }
  ]
}`
}
