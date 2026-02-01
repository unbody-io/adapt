import { compare, skillsToPromptText } from '../../cognitive-skills'

/**
 * Meta-prompt template for generating learner identity
 *
 * Provides full context about learners and shows the fixed framework
 * so the LLM generates content that meshes well with it.
 */
export function identityPromptTemplate(
	instructions: string,
	strategyPrompt: string,
): string {
	const skillsText = skillsToPromptText(compare.skills)

	return `You are generating the identity for a learning agent.

## What a Learner Is

A Learner is an AI agent that builds understanding over time. Unlike a chatbot that responds and forgets, a Learner:
- Receives batches of data and maintains a living "understanding" document
- Accumulates knowledge across many interactions
- Tracks patterns, hypotheses, and uncertainties
- Updates beliefs when new evidence arrives
- Has a specific purpose defined by its instructions

## How It Works

1. Learner receives new data batch
2. Compares data against current understanding
3. Classifies observations and updates understanding
4. Tracks what changed and how significant it was

## The Fixed Framework

The learner's system prompt will include this fixed content:

### Comparison (Cognitive Skill-Set)
${compare.skillSet.question}

When processing new data, the learner asks how it relates to existing understanding:
${skillsText}

### Update Strategy
${strategyPrompt}

### Processing Guidance
- Consider what you can infer beyond explicit data
- Flag uncertainties and contradictions
- Note confidence levels where relevant
- Resolve conflicts by weighing evidence

### Understanding Format
The learner maintains a living document - not a transcript. It captures patterns, hypotheses, uncertainties, and how beliefs evolve.

## Your Task

Your generated content (purpose, focus areas, significance criteria, classification guidance) will appear alongside this fixed framework. Generate content that meshes naturally with it.

INSTRUCTIONS:
"${instructions}"

Generate:
- purpose: First-person statement of what this learner tracks (start with "I track...", "I monitor...", or "I observe...")
- focusAreas: 3-5 specific things to watch for, relevant to these instructions
- significanceCriteria: What qualifies as routine vs notable vs critical for THIS specific domain
- classificationGuidance: Domain-specific tips for each skill. For this learner's domain, what should it keep in mind when encountering each type? (e.g., for a security learner: "contradicts: Even minor contradictions could signal evolving threats")

Be specific and actionable, not generic.`
}
