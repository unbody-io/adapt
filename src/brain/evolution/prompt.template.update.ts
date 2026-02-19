/**
 * Template for update action prompt
 *
 * Formats learner data for LLM to generate config updates
 */

import type { BaseLearner } from '../../learners/base/class'
import { stringifyUnderstanding } from './utils'

/**
 * Format update prompt with learner data and guidance
 */
export function updatePromptTemplate(
	guidance: string,
	learner: BaseLearner<any>,
	brainPrompt: string,
): string {
	const governance = learner.getGovernance()
	const metrics = learner.getMetrics()
	const understanding = stringifyUnderstanding(learner.getUnderstanding())

	// getSynthesizeThresholds exists on both TextLearner and ListLearner
	const thresholds = 'getSynthesizeThresholds' in learner
		? (learner as any).getSynthesizeThresholds()
		: null

	return `# Brain Context

**Purpose**: ${brainPrompt}

# Adjustment Guidance

${guidance}

# Learner to Adjust

**ID**: ${learner.id}
**Name**: ${learner.id}
**Description**: ${learner.description || 'N/A'}

**Current Instructions**:
${learner.instructions}
${thresholds ? `
**Current Thresholds**:
- Min Importance: ${thresholds.minImportance}
- Max Observations: ${thresholds.maxObservations}` : ''}

**Governance**:
- Activation: ${governance.activation.toFixed(2)}
- Status: ${governance.status}
- Last Accessed: ${governance.lastAccessed.toISOString()}

**Metrics**:
- Query Count: ${metrics.query.count}
- Dismissal Rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(1)}%
- Syntheses: ${metrics.ingestion.synthesisCount}

**Current Understanding** (first 500 chars):
${understanding.slice(0, 500)}${understanding.length > 500 ? '...' : ''}

---

# Your Task

Based on the guidance, determine what configuration changes are needed for this learner.

You can update:
- name: Change the learner's name
- description: Update the description
- instructions: Refine scope or responsibilities
- thresholds.minImportance: Adjust importance threshold (0-1)
- thresholds.maxObservations: Adjust buffer size (integer)

Only include fields that need to change. If a field doesn't need updating, omit it.

Provide:
- updates: Object with only the fields that should change
- reasoning: Brief explanation of what changed and why (1-2 sentences)`
}
