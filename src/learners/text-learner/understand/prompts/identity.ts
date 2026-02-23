/**
 * Meta-prompt for generating text understand identity
 */

import { compare, skillsToPromptText } from '../../cognitive-skills'

export function understandIdentityPromptTemplate(instructions: string): string {
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

Generate a synthesizer identity for these instructions:

"${instructions}"

You need to provide:

1. An identity (plain text) covering:
   - Who you are (second person: "You track...", "You maintain...")
   - Your focus areas (3-5 specific aspects)
   - Significance criteria (what's routine vs notable vs critical)

2. Skills — for each cognitive skill above, provide a description:
   - If the original description works for this domain, keep it as-is
   - If it needs domain-specific guidance, customize the description

## Example

For instructions "Track coding preferences and style evolution":

{
  "identity": "You track this developer's coding style — their preferences, patterns, and how their approach evolves over time.\\n\\nFocus areas:\\n- Core language/framework preferences\\n- Consistent style patterns\\n- Architectural philosophy\\n- Evolution and shifts over time\\n- Confidence levels in each area\\n\\nSignificance:\\n- Routine: Reinforces known preference\\n- Notable: New preference, or existing one deepens\\n- Critical: Contradiction with established pattern, or major shift",
  "skills": [
    { "skill": "confirms", "description": "This reinforces what I already believe — strong if repeated across multiple observations" },
    { "skill": "contradicts", "description": "This challenges what I believed — could be noise (one-off) or real shift, note confidence" },
    { "skill": "extends", "description": "This adds detail to what I know — look for specificity like 'likes TypeScript' → 'likes TypeScript for backend'" },
    { "skill": "new", "description": "This is something I didn't know before — only include if clearly relevant to coding style" },
    { "skill": "irrelevant", "description": "This doesn't relate to what I'm tracking" }
  ]
}

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object with "identity" and "skills" fields as shown in the example above.

Be specific and actionable for this domain, not generic.`
}
