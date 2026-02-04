/**
 * Template for update action prompt
 *
 * Formats learner data for LLM to generate config updates
 */

import type { TextLearner } from '../../learners/text-learner/class'

/**
 * Format update prompt with learner data and guidance
 */
export function updatePromptTemplate(
	guidance: string,
	learner: TextLearner,
	brainPrompt: string,
): string {
	const governance = learner.getGovernance()
	const thresholds = learner.getSynthesizeThresholds()

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

**Current Thresholds**:
- Min Importance: ${thresholds.minImportance}
- Max Observations: ${thresholds.maxObservations}

**Governance Metrics**:
- Activation: ${governance.activation.toFixed(2)}
- Status: ${governance.status}
- Retrieval Count: ${governance.retrievalCount}
- Success Rate: ${(governance.successRate * 100).toFixed(1)}%
- Last Accessed: ${governance.lastAccessed.toISOString()}

**Current Understanding** (first 500 chars):
${learner.getUnderstanding().slice(0, 500)}${learner.getUnderstanding().length > 500 ? '...' : ''}

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
