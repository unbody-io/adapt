import type { LearnerResponse } from '../types'

/**
 * User prompt for brain synthesis
 *
 * Presents learner responses as anonymous knowledge sections
 * with relevance and confidence labels for weighting.
 */
export function buildSynthesisUserPrompt(
	query: string,
	responses: LearnerResponse[],
): string {
	const relevant = responses.filter((r) => r.relevant)

	let knowledgeText: string
	if (relevant.length > 0) {
		knowledgeText = relevant
			.map(
				(r) =>
					`KNOWLEDGE (relevance: ${(r.relevance * 100).toFixed(0)}%, confidence: ${(r.confidence * 100).toFixed(0)}%):
${r.insight}${r.gaps.length > 0 ? `\nGaps: ${r.gaps.join(', ')}` : ''}`,
			)
			.join('\n\n')
	} else {
		knowledgeText = '(No relevant knowledge available)'
	}

	return `QUESTION:
${query}

${knowledgeText}`
}
