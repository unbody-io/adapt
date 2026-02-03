import type { LearnerResponse } from '../types'

/**
 * User prompt for brain synthesis
 *
 * Provides the query and learner responses.
 */
export function buildSynthesisUserPrompt(
	query: string,
	responses: LearnerResponse[],
): string {
	const relevant = responses.filter((r) => r.relevant)
	const irrelevant = responses.filter((r) => !r.relevant)

	const responsesText =
		relevant.length > 0
			? relevant
					.map(
						(r) =>
							`[${r.name}] (confidence: ${(r.confidence * 100).toFixed(0)}%)
${r.insight}${r.gaps.length > 0 ? `\nGaps: ${r.gaps.join(', ')}` : ''}`,
					)
					.join('\n\n')
			: '(No learners had relevant insights)'

	const irrelevantText =
		irrelevant.length > 0
			? `\nLearners without relevant info: ${irrelevant.map((r) => r.name).join(', ')}`
			: ''

	return `QUESTION:
${query}

LEARNER RESPONSES:
${responsesText}${irrelevantText}`
}
