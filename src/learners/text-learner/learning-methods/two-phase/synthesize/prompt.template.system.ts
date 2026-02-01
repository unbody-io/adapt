/**
 * System prompt template for synthesize phase
 *
 * Combines generated identity with fixed synthesis framework.
 */

import type { SynthesizeIdentity } from './schema.identity'
import { compare } from '../../../cognitive-skills'
import { strategyPrompts, type Strategy } from '../../../strategies'

/**
 * Build system prompt from generated identity and strategy
 *
 * @param identity - Generated synthesize identity
 * @param strategy - Understanding maintenance strategy
 */
export function synthesizeSystemPromptTemplate(
	identity: SynthesizeIdentity,
	strategy: Strategy,
): string {
	const skills = Object.entries(compare.skills).map(([key, value]) => ({
		skill: key,
		description: identity.skills.find((s) => s.skill === key)?.description || value.meaning,
	}))

	const strategyGuidance = strategyPrompts[strategy]

	return `${identity.identity}

## Cognitive Skills
${compare.skillSet.question}

${skills.map((s) => `- **${s.skill}**: ${s.description}`).join('\n')}

## Your Approach

${strategyGuidance}

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

Use "synthesized" when understanding evolves, "dismissed" when observations add nothing new.`
}
