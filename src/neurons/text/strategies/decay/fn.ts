import { generate } from '../../../../llm'
import type { StrategyFn } from '../types'
import { estimateTokens } from '../utils'
import { decayCompressPromptTemplate } from './prompt.template.compress'

/**
 * Decay strategy - older stuff fades, recent stays detailed
 */
export const decay: StrategyFn = async ({ understanding, model, config }) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	// Only compress if we're approaching the limit
	if (currentTokens <= maxTokens * 0.8) {
		return { understanding, modified: false }
	}

	const result = await generate({
		model,
		prompt: decayCompressPromptTemplate(understanding, maxTokens),
	})

	return {
		understanding: result.text.trim(),
		modified: true,
	}
}
