/**
 * Template for the Evaluator's evaluation prompt
 *
 * Dynamically generates the user prompt with signal and learner context
 */

import type { Signal, EvaluationContext } from './types'

/**
 * Format the evaluation prompt with signals and context
 */
export function evaluationPromptTemplate(
	context: EvaluationContext,
	signals: Signal[],
): string {
	return `# System Overview

**Brain Purpose**: ${context.brain.prompt}
**Active Learners**: ${context.brain.learnerCount}

# Learner Overview

${context.learners
	.map(
		(l) => `## ${l.name} (${l.id})
**Purpose**: ${l.purpose}
**What it has learned so far**: ${l.understandingPreview}
**Status**: ${l.governance.status}
**Activation**: ${l.governance.activation.toFixed(2)}
**Last Accessed**: ${l.governance.lastAccessed.toISOString()}
**Retrieval Count**: ${l.governance.retrievalCount}
**Success Rate**: ${(l.governance.successRate * 100).toFixed(1)}%`,
	)
	.join('\n\n')}

# Buffered Signals (${signals.length})

${signals
	.map(
		(s, idx) => `## Signal ${idx + 1}
**Source**: ${s.source}
**Time**: ${s.timestamp.toISOString()}
**Description**: ${s.description}${
			s.metrics
				? `
**Metrics**:
${Object.entries(s.metrics)
	.map(([key, value]) => `  - ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
	.join('\n')}`
				: ''
		}`,
	)
	.join('\n\n')}

# Your Task

Analyze these signals in the context of the learner states and Brain purpose. Determine what evolution actions, if any, are needed to improve system effectiveness.

Output 0 to N decisions. Return an empty array if no changes are warranted.`
}
