import { generateText } from 'ai'
import type { StrategyFn } from '../types'
import { estimateTokens } from '../utils'
import { cumulativeSeedPromptTemplate } from './prompt.template.compress'

/**
 * Cumulative strategy - when limit reached, create a seed and reset the cycle
 * The seed becomes the foundation for a fresh learning cycle
 */
export const cumulative: StrategyFn = async ({
	understanding,
	model,
	config,
}) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	if (currentTokens <= maxTokens) {
		return { understanding, modified: false }
	}

	const result = await generateText({
		model,
		prompt: cumulativeSeedPromptTemplate(understanding, maxTokens),
	})

	return {
		understanding: result.text.trim(),
		modified: true,
		cycleReset: true,
	}
}
