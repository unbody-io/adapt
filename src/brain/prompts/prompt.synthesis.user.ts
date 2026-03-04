import type { LearnerResponse } from '../types'

/**
 * User prompt for brain synthesis
 *
 * Presents learner responses as anonymous knowledge sections.
 * No lossy abstractions — raw knowledge, the model weighs it.
 */
export function buildSynthesisUserPrompt(
	query: string,
	responses: LearnerResponse[],
): string {
	const relevant = responses.filter((r) => r.relevant)

	let knowledgeText: string
	if (relevant.length > 0) {
		knowledgeText = relevant
			.map((r, i) => `KNOWLEDGE ${i + 1}:\n${r.insight}${r.gaps.length > 0 ? `\nGaps: ${r.gaps.join(', ')}` : ''}`)
			.join('\n\n')
	} else {
		knowledgeText = '(No relevant knowledge available)'
	}

	return `${query}\n\n${knowledgeText}`
}
