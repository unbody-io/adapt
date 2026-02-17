/**
 * Template for the Evaluator's evaluation prompt.
 *
 * Tool-based approach:
 * - Provides lightweight context (learner metadata, not full understanding)
 * - LLM uses getUnderstandings() tool to investigate as needed
 * - LLM calls finalizeDecisions() to return decisions
 */

import type { Signal, EvaluationContext } from './types'
import {
	FRAGMENT_SYSTEM_DIRECTIVE,
	FRAGMENT_GOVERNANCE,
} from './prompt.fragments'

/**
 * Detect which signal types are present in the buffer
 */
function detectSignalTypes(signals: Signal[]): {
	hasSystemDirective: boolean
	hasGovernance: boolean
} {
	const hasSystemDirective = signals.some((s) => s.source === 'brain')
	const hasGovernance = signals.some((s) => s.source !== 'brain')
	return { hasSystemDirective, hasGovernance }
}

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
 * Default thresholds for severity classification.
 */
const THRESHOLDS = {
	maxDismissalRate: 0.8,
	minRelevance: 0.3,
	minConfidence: 0.3,
	maxObservationsWithoutSynthesis: 30,
}

/**
 * Classify signal severity based on how far past threshold.
 */
function classifySignalSeverity(
	signal: Signal,
): 'minor' | 'moderate' | 'severe' | null {
	if (!signal.metrics) return null

	let diff: number | null = null

	if (signal.metrics.dismissalRate !== undefined) {
		const val = signal.metrics.dismissalRate
		const threshold = THRESHOLDS.maxDismissalRate
		diff = (val - threshold) / threshold
	} else if (signal.metrics.avgRelevance !== undefined) {
		const val = signal.metrics.avgRelevance
		const threshold = THRESHOLDS.minRelevance
		diff = (threshold - val) / threshold
	} else if (signal.metrics.avgConfidence !== undefined) {
		const val = signal.metrics.avgConfidence
		const threshold = THRESHOLDS.minConfidence
		diff = (threshold - val) / threshold
	} else if (signal.metrics.observationsSinceLastSynthesis !== undefined) {
		const val = signal.metrics.observationsSinceLastSynthesis
		const threshold = THRESHOLDS.maxObservationsWithoutSynthesis
		diff = (val - threshold) / threshold
	}

	if (diff === null) return null
	if (diff < 0.2) return 'minor'
	if (diff < 0.5) return 'moderate'
	return 'severe'
}

/**
 * Format a signal description with severity label if applicable.
 */
function formatSignalWithSeverity(signal: Signal): string {
	const severity = classifySignalSeverity(signal)
	if (severity) {
		return `${signal.description} [severity: ${severity}]`
	}
	return signal.description
}

/**
 * Format the evaluation prompt with signals and context.
 *
 * Tool-based: provides metadata, LLM fetches understanding via tool.
 */
export function evaluationPromptTemplate(
	context: EvaluationContext,
	signals: Signal[],
): string {
	const { hasSystemDirective, hasGovernance } = detectSignalTypes(signals)

	const sections: string[] = []

	// 1. Context: Brain purpose and learner overview (metadata only)
	sections.push(`# Context

**Brain Purpose**: ${context.brain.prompt}
**Active Learners**: ${context.brain.learnerCount}

## Learners

${context.learners
	.map(
		(l) => `### ${l.id}
- **Purpose**: ${l.purpose}
- **Knowledge**: ${classifyKnowledgeSize(l.understandingSize)}
- **Status**: ${l.governance.status} (activation: ${l.governance.activation.toFixed(2)})
- **Queries**: ${l.metrics.queryCount}, **Dismissal Rate**: ${(l.metrics.dismissalRate * 100).toFixed(0)}%, **Syntheses**: ${l.metrics.synthesisCount}`,
	)
	.join('\n\n')}`)

	// 2. Signals (with severity labels)
	sections.push(`# Signals (${signals.length})

${signals
	.map(
		(s, idx) => `## Signal ${idx + 1}
- **Source**: ${s.source}
- **Description**: ${formatSignalWithSeverity(s)}`,
	)
	.join('\n\n')}`)

	// 3. Available Tools
	sections.push(`# Available Tools

## getUnderstandings
Fetch the accumulated understanding (knowledge) for specified learners.
- Input: \`{ learnerIds: string[] }\`
- Output: \`{ [learnerId]: understanding }\`

Use this to:
- See what a struggling learner has learned
- Check if a topic is exhausted (understanding seems "complete")
- Compare understandings to detect overlap between learners

## finalizeDecisions
Return your final evolution decisions.
- Input: \`{ decisions: EvolutionDecision[] }\`
- Call this when you've finished your investigation`)

	// 4. Decision framework — dynamic based on signal types
	if (hasSystemDirective) {
		sections.push(FRAGMENT_SYSTEM_DIRECTIVE)
	}

	if (hasGovernance) {
		sections.push(FRAGMENT_GOVERNANCE)
	}

	// 5. Task instructions
	const steps: string[] = []

	steps.push('Analyze the signals to understand what issues are present')

	if (hasGovernance) {
		steps.push(
			'Use getUnderstandings() to investigate learners as needed for diagnosis',
		)
	}

	if (hasSystemDirective) {
		steps.push(
			'Classify the purpose change intent (related pivot, unrelated pivot, expansion, etc.)',
		)
		steps.push('Determine what should happen to each learner')
	}

	if (hasGovernance) {
		steps.push('For each signal, diagnose the root cause:')
		steps.push('  - Is the scope too narrow or too broad?')
		steps.push('  - Is the topic exhausted (finite topic fully captured)?')
		steps.push('  - Is there overlap with other learners?')
		steps.push('  - Is this a systemic issue across multiple learners?')
	}

	steps.push(
		'Call finalizeDecisions() with your decisions (empty array is valid if no action needed)',
	)

	sections.push(`# Your Task

${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`)

	return sections.join('\n\n')
}
