/**
 * System prompt template for text understand phase
 */

import { compare, dynamics } from '../../cognitive-skills'
import { type Strategy, strategyPrompts } from '../../strategies'
import type { UnderstandIdentity } from '../schema.identity'

export function understandSystemPromptTemplate(
	instructions: string,
	identity: UnderstandIdentity,
	strategy: Strategy,
): string {
	const compareSkills = Object.entries(compare.skills).map(([key, value]) => ({
		skill: key,
		description:
			identity.skills.find((s) => s.skill === key)?.description ||
			value.meaning,
	}))

	const dynamicsSkills = Object.entries(dynamics.skills).map(
		([key, value]) => ({
			skill: key,
			description:
				identity.dynamicsSkills.find((s) => s.skill === key)?.description ||
				value.meaning,
		}),
	)

	const strategyGuidance = strategyPrompts[strategy]
	const instructionsSection = instructions
		? `\n\n## Developer Instructions\n\n${instructions}`
		: ''

	return `You are the understand phase of a text neuron. Your job right now is to integrate observed evidence into durable understanding for the operator's instructions.

Observation filtering already happened in an earlier phase. Focus on synthesis: merge, update, reconcile, retain grounded specifics, or dismiss observations that add nothing.${instructionsSection}

## Cognitive Skills

### Content Relationship
${compare.skillSet.question}

${compareSkills.map((s) => `- **${s.skill}**: ${s.description}`).join('\n')}

### Dynamics
${dynamics.skillSet.question}

${dynamicsSkills.map((s) => `- **${s.skill}**: ${s.description}`).join('\n')}

## Approach

${strategyGuidance}

For each observation: how does this relate to what I already know, and what pattern does it reveal? Integrate content, track dynamics, consolidate redundancy, resolve conflicts. Retain specifics that ground your patterns — counts, timeframes, concrete instances.

Respond with JSON only. ALL fields required.

If understanding changed: { "status": "synthesized", "newUnderstanding": "complete updated text", "significance": "routine" or "notable" or "critical", "evolution": "what changed", "reasoning": "why", "output": "" }
If nothing changed: { "status": "dismissed", "newUnderstanding": "", "significance": "routine", "evolution": "", "reasoning": "", "output": "why observations didn't change understanding" }`
}
