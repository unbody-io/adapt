/**
 * Template for merge action prompt
 *
 * Formats learner data for LLM to synthesize into a unified learner
 */

import type { BaseLearner } from '../../learners/base/class'
import { stringifyUnderstanding } from './utils'

/**
 * Format merge prompt with learner data and guidance
 */
export async function mergePromptTemplate(
	guidance: string,
	learners: BaseLearner<unknown>[],
	brainPrompt: string,
): Promise<string> {
	const learnerSections = await Promise.all(
		learners.map(async (learner, idx) => {
			const understanding = await learner.getUnderstanding()
			return `## Learner ${idx + 1}: ${learner.id}

**Name**: ${learner.id}
**Description**: ${learner.description || 'N/A'}
**Instructions**:
${learner.instructions}

**Understanding**:
${stringifyUnderstanding(understanding)}

---`
		}),
	)

	return `# Brain Context

**Purpose**: ${brainPrompt}

# Merge Guidance

${guidance}

# Learners to Merge

${learnerSections.join('\n\n')}

# Your Task

Synthesize these ${learners.length} learners into a single unified learner that:
1. Combines their knowledge domains appropriately
2. Preserves important knowledge from all learners
3. Has clear, focused instructions
4. Has a merged understanding that integrates all relevant knowledge

Output:
- config: Merged learner configuration (name, description, instructions)
- understanding: Unified understanding text combining knowledge from all sources`
}
