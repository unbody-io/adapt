/**
 * Template for the Evaluator's evaluation prompt.
 *
 * Presents context (learners + signals) and tools.
 * The LLM reasons from evidence — no prescriptive recipes.
 */

import type { Signal, EvaluationContext } from './types'

/**
 * Classify knowledge size into qualitative labels.
 */
function classifyKnowledgeSize(chars: number): string {
	if (chars === 0) return 'none'
	if (chars < 200) return 'minimal'
	if (chars < 500) return 'some'
	return 'significant'
}

/**
 * Format a signal for the prompt, including metrics if present.
 */
function formatSignal(signal: Signal, idx: number): string {
	const lines = [
		`## Signal ${idx + 1}`,
		`- **Source**: ${signal.source}`,
		`- **Description**: ${signal.description}`,
	]

	if (signal.metrics) {
		const metrics: string[] = []
		if (signal.metrics.dismissalRate !== undefined) metrics.push(`dismissalRate: ${(signal.metrics.dismissalRate * 100).toFixed(0)}%`)
		if (signal.metrics.avgRelevance !== undefined) metrics.push(`avgRelevance: ${signal.metrics.avgRelevance.toFixed(2)}`)
		if (signal.metrics.avgConfidence !== undefined) metrics.push(`avgConfidence: ${signal.metrics.avgConfidence.toFixed(2)}`)
		if (signal.metrics.gapCount !== undefined) metrics.push(`gapCount: ${signal.metrics.gapCount}`)
		if (signal.metrics.bufferCount !== undefined) metrics.push(`bufferCount: ${signal.metrics.bufferCount}`)
		if (signal.metrics.activation !== undefined) metrics.push(`activation: ${signal.metrics.activation.toFixed(2)}`)
		if (signal.metrics.observationsSinceLastSynthesis !== undefined) metrics.push(`observationsSinceLastSynthesis: ${signal.metrics.observationsSinceLastSynthesis}`)
		if (metrics.length > 0) {
			lines.push(`- **Metrics**: ${metrics.join(', ')}`)
		}
	}

	return lines.join('\n')
}

/**
 * Format the evaluation prompt with signals and context.
 */
export function evaluationPromptTemplate(
	context: EvaluationContext,
	signals: Signal[],
): string {
	const sections: string[] = []

	// 1. Context: Brain purpose and learner overview
	sections.push(`# Context

**Brain Purpose**: ${context.brain.prompt}
**Active Learners**: ${context.brain.learnerCount}

## Learners

${context.learners
	.map(
		(l) => `### ${l.id}
- **Purpose**: ${l.purpose}
- **Knowledge**: ${classifyKnowledgeSize(l.understandingSize)} (${l.understandingSize} chars)
- **Status**: ${l.governance.status} (activation: ${l.governance.activation.toFixed(2)})
- **Queries**: ${l.metrics.queryCount}, **Dismissal Rate**: ${(l.metrics.dismissalRate * 100).toFixed(0)}%, **Syntheses**: ${l.metrics.synthesisCount}`,
	)
	.join('\n\n')}`)

	// 2. Signals
	sections.push(`# Signals (${signals.length})

${signals.map((s, idx) => formatSignal(s, idx)).join('\n\n')}`)

	// 3. Available Tools
	sections.push(`# Available Tools

## getUnderstandings
Fetch the accumulated understanding (knowledge) for specified learners.
- Input: \`{ learnerIds: string[] }\`
- Output: \`{ [learnerId]: understanding }\`

## getLearnerActivity
Fetch ingestion metrics and recent observations for specified learners.
- Input: \`{ learnerIds: string[] }\`
- Output: \`{ [learnerId]: { ingestion, recentObservations } }\`

## getRecentHistory
Fetch recent evaluation decisions made by this evaluator.
- Input: \`{}\`
- Output: array of past decision sets

## finalizeDecisions
Return your final evolution decisions.
- Input: \`{ decisions: EvolutionDecision[] }\`
- Call this when you've finished your investigation.`)

	// 4. Task
	sections.push(`# Your Task

1. Analyze the signals — what issues or changes are present?
2. Investigate using the tools above to gather evidence
3. Determine what actions (if any) are needed based on the evidence
4. Call finalizeDecisions() with your decisions (empty array is valid)`)

	return sections.join('\n\n')
}
