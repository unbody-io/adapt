/**
 * Prompt template for adjusting an existing text synthesizer identity
 *
 * Unlike the identity prompt (used at init), this shows the LLM
 * the current identity so it can evolve rather than replace.
 */

import { compare, skillsToPromptText } from '../../cognitive-skills'
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
	const skillsText = skillsToPromptText(compare.skills)

	const currentSkills = currentIdentity.skills
		.map((s) => `- **${s.skill}**: ${s.description}`)
		.join('\n')

	return `You are adjusting an existing Synthesizer — an agent that builds understanding from observations.

## Current State

**Instructions** (already updated):
"${newInstructions}"

**Current Synthesizer Identity**:
"${currentIdentity.identity}"

**Current Skills**:
${currentSkills}

## Adjustment Directive

"${directive}"

## Available Cognitive Skills

${skillsText}

## Your Task

Adjust the synthesizer identity and skills to align with the updated instructions and directive.

1. **Updated identity** (plain text) covering:
   - Who you are (second person: "You track...", "You maintain...")
   - Your focus areas (3-5 specific aspects)
   - Significance criteria (what's routine vs notable vs critical)

2. **Updated skills** — for each cognitive skill, provide a description:
   - If the current description still works, keep it as-is
   - If it needs adjustment for the new focus, customize it

## Rules

- This is an INCREMENTAL adjustment, not a full rewrite
- Preserve skill descriptions that are still relevant
- Update focus areas and significance criteria to match the new instructions
- If the directive narrows scope, tighten the identity accordingly
- If the directive broadens scope, expand while keeping existing specificity

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object with "identity" and "skills" fields:

{
  "identity": "You track...",
  "skills": [
    { "skill": "confirms", "description": "..." },
    { "skill": "contradicts", "description": "..." },
    { "skill": "extends", "description": "..." },
    { "skill": "new", "description": "..." },
    { "skill": "irrelevant", "description": "..." }
  ]
}`
}
