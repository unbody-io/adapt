import { generate } from '../../../../llm'
import type { StrategyFn } from '../types'
import { estimateTokens } from '../utils'
import { cumulativeSeedPromptTemplate } from './prompt.template.compress'

/**
 * Cumulative strategy - when limit reached, create a seed and reset the cycle
 * The seed becomes the foundation for a fresh learning cycle
 */
export const cumulative: StrategyFn = async ({
	understanding,
	llm,
	model,
	config,
	repairWithFeedback,
	maxRepairAttempts,
}) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	if (currentTokens <= maxTokens) {
		return { understanding, modified: false }
	}

	const result = await generate({
		llm,
		model,
		prompt: cumulativeSeedPromptTemplate(understanding, maxTokens),
		repairWithFeedback,
		maxRepairAttempts,
	})

	return {
		understanding: result.text.trim(),
		modified: true,
		cycleReset: true,
	}
}
