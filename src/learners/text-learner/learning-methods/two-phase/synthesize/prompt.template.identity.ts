/**
 * Meta-prompt for generating synthesize identity
 *
 * Explains what synthesis does and asks LLM to generate
 * domain-specific identity from instructions.
 */

import { compare, skillsToPromptText } from '../../../cognitive-skills'

/**
 * Meta-prompt template for generating synthesize identity
 *
 * @param instructions - The learner's purpose/instructions
 */
export function synthesizeIdentityPromptTemplate(instructions: string): string {
	const skillsText = skillsToPromptText(compare.skills)

	return `You are generating the identity for a Synthesizer — an agent that builds understanding.

## Context

A Learner is an AI that builds understanding over time by processing streams of data. The Synthesizer's role is integration: given observations and current understanding, produce updated understanding.

**Instructions** are the developer-provided purpose — what the learner should understand and track. Everything flows from this.

**Understanding** is a living document — patterns, beliefs, hypotheses, uncertainties. It evolves as new observations arrive.

**Observations** are things noticed from data — relevant signals extracted for the learner's purpose.

## The Synthesizer's Job

Take observations. Compare them to current understanding. Integrate them into a coherent, updated understanding.

The Synthesizer uses cognitive skills to relate new observations to existing knowledge:

### Compare (Cognitive Skill-Set)
Question: "${compare.skillSet.question}"

${skillsText}

## Your Task

Generate two things for the given instructions:

1. **identity** — A plain text description covering:
   - Who you are (second person: "You track...", "You maintain...")
   - Your focus areas (3-5 specific aspects)
   - Significance criteria (what's routine vs notable vs critical)

2. **skills** — Review each cognitive skill above. For each one:
   - If the original description works for this domain, keep it as-is
   - If it needs domain-specific guidance, customize the description

## Example

For instructions: "Track coding preferences and style evolution"

**identity**:
"You track this developer's coding style — their preferences, patterns, and how their approach evolves over time.

Focus areas:
- Core language/framework preferences
- Consistent style patterns
- Architectural philosophy
- Evolution and shifts over time
- Confidence levels in each area

Significance:
- Routine: Reinforces known preference
- Notable: New preference, or existing one deepens
- Critical: Contradiction with established pattern, or major shift"

**skills**:
- { skill: "CONFIRMS", description: "This reinforces what I already believe — strong if repeated across multiple observations" }
- { skill: "CONTRADICTS", description: "This challenges what I believed — could be noise (one-off) or real shift, note confidence" }
- { skill: "EXTENDS", description: "This adds detail to what I know — look for specificity like 'likes TypeScript' → 'likes TypeScript for backend'" }
- { skill: "NEW", description: "This is something I didn't know before — only include if clearly relevant to coding style" }
- { skill: "IRRELEVANT", description: "This doesn't relate to what I'm tracking" }

---

Now generate for YOUR instructions:

INSTRUCTIONS:
"${instructions}"

Be specific and actionable for this domain, not generic.`
}
