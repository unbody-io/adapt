import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { generate, Output } from '../../../../llm'
import type { TokenUsage } from '../../../types'
import type {
	QueryCallbacks,
	QueryContext,
	QueryMethod,
	QueryMethodUpdateConfig,
	QueryOptions,
	QueryResult,
} from '../types'
import { buildQuerySystemPrompt } from './prompt.system'
import { buildQueryUserPrompt } from './prompt.user'

/**
 * Schema for query response
 */
const queryResponseSchema = z.object({
	relevant: z
		.boolean()
		.describe('Is this query within your area of expertise/purpose?'),
	relevance: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'How related is this query to your domain/purpose? 0.0 = completely outside your scope, 1.0 = core to what you do',
		),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'How well could you answer from your understanding? 0.0 = you have nothing on this topic, 1.0 = you fully answered. If outside your scope, this should be 0.0',
		),
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

	update(config: QueryMethodUpdateConfig): void {
		if (config.model !== undefined) {
			this.model = config.model
		}
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
			relevance: result.output.relevance,
			confidence: result.output.confidence,
			insight: result.output.insight,
			gaps: result.output.gaps,
			usage,
		}
	}
}
