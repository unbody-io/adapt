import type { LanguageModel } from 'ai'
import { z } from 'zod'
import type {
	QueryMethod,
	QueryContext,
	QueryOptions,
	QueryCallbacks,
	QueryResult,
} from '../types'
import type { TokenUsage } from '../../../types'
import { buildQuerySystemPrompt } from './prompt.system'
import { buildQueryUserPrompt } from './prompt.user'
import { generate, Output } from '../../../../llm'

/**
 * Schema for query response
 */
const queryResponseSchema = z.object({
	relevant: z.boolean().describe('Can you answer this from your understanding?'),
	confidence: z.number().describe('How confident are you? 0.0-1.0'),
	insight: z.string().describe('Your answer based on your understanding'),
	gaps: z.string().describe('What you could not answer (empty if none)'),
})

/**
 * Direct query method
 *
 * Single LLM call with structured output.
 * Uses separate system + user prompts for better grounding.
 */
export class DirectMethod implements QueryMethod {
	readonly name = 'direct'
	private model: LanguageModel

	constructor(model: LanguageModel) {
		this.model = model
	}

	async query(
		context: QueryContext,
		options?: QueryOptions,
		_callbacks?: QueryCallbacks,
	): Promise<QueryResult> {
		const system = buildQuerySystemPrompt(context)
		const prompt = buildQueryUserPrompt(context)
		const { model: modelOverride, ...generateOptions } = options ?? {}

		const result = await generate({
			model: modelOverride ?? this.model,
			system,
			prompt,
			output: Output.object({ schema: queryResponseSchema }),
			...generateOptions,
		})

		const usage: TokenUsage = {
			inputTokens: result.usage?.inputTokens ?? 0,
			outputTokens: result.usage?.outputTokens ?? 0,
			totalTokens: result.usage?.totalTokens ?? 0,
		}

		return {
			relevant: result.output.relevant,
			confidence: result.output.confidence,
			insight: result.output.insight,
			gaps: result.output.gaps,
			usage,
		}
	}
}
