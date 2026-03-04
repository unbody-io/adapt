/**
 * Template for split action prompt
 *
 * Formats learner data for LLM to divide into focused learners
 */

import type { BaseLearner } from '../../learners/base/class'
import { stringifyUnderstanding } from './utils'

/**
 * Format split prompt with learner data and guidance
 */
export async function splitPromptTemplate(
	guidance: string,
	learner: BaseLearner<unknown>,
	purpose: string,
): Promise<string> {
	const understanding = await learner.getUnderstanding()

	return `# Brain Context

**Purpose**: ${purpose}

# Split Guidance

${guidance}

# Learner to Split

**ID**: ${learner.id}
**Description**: ${learner.description || 'N/A'}

**Instructions**:
${learner.instructions}

**Understanding**:
${stringifyUnderstanding(understanding)}

**Health**:
- Activation: ${learner.getHealth().activation.toFixed(2)}
- Status: ${learner.getHealth().status}
- Query Count: ${learner.getMetrics().query.count}
- Dismissal Rate: ${(learner.getMetrics().ingestion.dismissalRate * 100).toFixed(1)}%

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
