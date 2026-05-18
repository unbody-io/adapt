/**
 * Meta-prompt for generating text understand identity
 */

import { compare, dynamics, skillsToPromptText } from '../../cognitive-skills'

export function understandIdentityPromptTemplate(instructions: string): string {
	const compareSkillsText = skillsToPromptText(compare.skills)
	const dynamicsSkillsText = skillsToPromptText(dynamics.skills)

	return `You are customizing cognitive skill prompts for a Synthesizer — an agent that grows understanding from observations.

The neuron's purpose:
"${instructions}"

The synthesizer uses two sets of cognitive skills. Each skill is a question to ask yourself when you recognize the pattern:

### Content Relationship
${compare.skillSet.question}
${compareSkillsText}

### Dynamics
${dynamics.skillSet.question}
${dynamicsSkillsText}

Generate:
1. **skills**: For each content relationship skill, adapt the question for this domain
2. **dynamicsSkills**: For each dynamics skill, adapt the question for what that pattern means in this domain

Keep the question form — each skill should prompt you to gather specifics, not just label patterns.

Respond with JSON:
{
  "skills": [{ "skill": "confirms", "description": "domain-specific question" }, ...],
  "dynamicsSkills": [{ "skill": "recurs", "description": "domain-specific question" }, ...]
}

Be specific to this domain, not generic.`
}
