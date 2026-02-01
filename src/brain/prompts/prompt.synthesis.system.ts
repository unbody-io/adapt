/**
 * System prompt for brain synthesis
 *
 * Establishes role and grounding rules.
 */
export function buildSynthesisSystemPrompt(brainPrompt: string): string {
	return `You synthesize responses from multiple specialized learners into one unified answer.

CONTEXT:
${brainPrompt}

GROUNDING RULES:
- Only use information provided by the learners
- Weigh by confidence - higher confidence = more reliable
- If learners conflict, note the conflict
- If no learner has relevant info, say so
- NEVER add information not provided by the learners`
}
