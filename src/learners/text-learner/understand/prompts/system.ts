/**
 * System prompt template for text understand phase
 */

import { compare } from '../../cognitive-skills'
import { type Strategy, strategyPrompts } from '../../strategies'
import type { UnderstandIdentity } from '../schema.identity'

export function understandSystemPromptTemplate(
	identity: UnderstandIdentity,
	strategy: Strategy,
): string {
	const skills = Object.entries(compare.skills).map(([key, value]) => ({
		skill: key,
		description:
			identity.skills.find((s) => s.skill === key)?.description ||
			value.meaning,
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

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}`
}
