import { generate } from '../../../../llm'
import type { StrategyFn } from '../types'
import { estimateTokens } from '../utils'
import { decayCompressPromptTemplate } from './prompt.template.compress'

/**
 * Decay strategy - older stuff fades, recent stays detailed
 */
export const decay: StrategyFn = async ({
	understanding,
	llm,
	model,
	config,
	repairWithFeedback,
	maxRepairAttempts,
}) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	// Only compress if we're approaching the limit
	if (currentTokens <= maxTokens * 0.8) {
		return { understanding, modified: false }
	}

	const result = await generate({
		llm,
		model,
		prompt: decayCompressPromptTemplate(understanding, maxTokens),
		repairWithFeedback,
		maxRepairAttempts,
	})

	return {
		understanding: result.text.trim(),
		modified: true,
	}
}
