import { generateText } from 'ai'
import { estimateTokens } from '../utils'
import type { StrategyFn } from '../types'
import { cumulativeCompressPromptTemplate } from './prompt.template.compress'

/**
 * Cumulative strategy - when full, summarize and carry forward, continue building
 */
export const cumulative: StrategyFn = async ({ understanding, model, config }) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	if (currentTokens <= maxTokens) {
		return { understanding, modified: false }
	}

	const result = await generateText({
		model,
		prompt: cumulativeCompressPromptTemplate(understanding, currentTokens, maxTokens),
	})

	return {
		understanding: result.text.trim(),
		modified: true,
	}
}
