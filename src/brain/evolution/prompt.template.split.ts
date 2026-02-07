/**
 * Template for split action prompt
 *
 * Formats learner data for LLM to divide into focused learners
 */

import type { TextLearner } from '../../learners/text-learner/class'

/**
 * Format split prompt with learner data and guidance
 */
export function splitPromptTemplate(
	guidance: string,
	learner: TextLearner,
	brainPrompt: string,
): string {
	return `# Brain Context

**Purpose**: ${brainPrompt}

# Split Guidance

${guidance}

# Learner to Split

**ID**: ${learner.id}
**Description**: ${learner.description || 'N/A'}

**Instructions**:
${learner.instructions}

**Understanding**:
${learner.getUnderstanding() || '(No understanding yet)'}

**Governance Metrics**:
- Activation: ${learner.getGovernance().activation.toFixed(2)}
- Status: ${learner.getGovernance().status}
- Retrieval Count: ${learner.getGovernance().retrievalCount}
- Success Rate: ${(learner.getGovernance().successRate * 100).toFixed(1)}%

---

# Your Task

Divide this learner into 2 or more focused learners that:
1. Each have a clear, narrow scope (more focused than the original)
2. Together cover the original learner's domain
3. Have appropriate knowledge distribution (split the understanding logically)
4. Have distinct, non-overlapping instructions

For each new learner, provide:
- name: Clear, descriptive name
- description: Brief purpose description
- instructions: Focused instructions defining scope
- understanding: Relevant portion of the original understanding

Output an array of 2 or more learner configurations.`
}
