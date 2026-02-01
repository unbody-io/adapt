import { generateText, Output, type LanguageModel } from 'ai'
import type {
	LearningMethod,
	LearnContext,
	LearnCallbacks,
	LearnResult,
	InitContext,
	InitResult,
} from '../types'
import type { TokenUsage } from '../../../types'
import { strategyPrompts } from '../../strategies'
import { identitySchema } from './schema.init'
import { learnOutputSchema } from './schema.learn'
import { identityPromptTemplate } from './prompt.template.identity'
import { systemPromptTemplate } from './prompt.template.system'
import { learnPromptTemplate } from './prompt.template.learn'

/**
 * Direct learning method
 *
 * Uses a single LLM call with structured output to analyze data.
 * Requires model support for structured output (OpenAI, Gemini).
 *
 * Pros:
 * - Faster (single round trip)
 * - Lower token usage
 * - More consistent output structure
 *
 * Cons:
 * - Requires structured output support (doesn't work with Claude via OpenRouter)
 * - Less step-by-step reasoning visible
 */
export class DirectMethod implements LearningMethod {
	readonly name = 'direct'
	private model: LanguageModel
	private _systemPrompt: string | null = null

	constructor(model: LanguageModel) {
		this.model = model
	}

	get systemPrompt(): string | null {
		return this._systemPrompt
	}

	async init(context: InitContext): Promise<InitResult> {
		const strategyPrompt = strategyPrompts[context.strategy]
		const prompt = identityPromptTemplate(context.instructions, strategyPrompt)

		const result = await generateText({
			model: this.model,
			prompt,
			output: Output.object({ schema: identitySchema }),
		})

		const usage: TokenUsage = {
			inputTokens: result.usage?.inputTokens ?? 0,
			outputTokens: result.usage?.outputTokens ?? 0,
			totalTokens: result.usage?.totalTokens ?? 0,
		}

		const identity = result.output
		if (!identity) {
			throw new Error('Failed to generate learner identity')
		}

		this._systemPrompt = systemPromptTemplate(identity, strategyPrompt)

		return { systemPrompt: this._systemPrompt, usage }
	}

	async learn(
		context: LearnContext,
		_callbacks?: LearnCallbacks,
	): Promise<LearnResult> {
		if (!this._systemPrompt) {
			throw new Error('DirectMethod not initialized. Call init() first.')
		}

		const prompt = learnPromptTemplate(context)

		const result = await generateText({
			model: this.model,
			system: this._systemPrompt,
			prompt,
			output: Output.object({ schema: learnOutputSchema }),
		})

		const usage: TokenUsage = {
			inputTokens: result.usage?.inputTokens ?? 0,
			outputTokens: result.usage?.outputTokens ?? 0,
			totalTokens: result.usage?.totalTokens ?? 0,
		}

		const data = result.output
		if (!data) {
			throw new Error('No structured output generated')
		}

		// Return simplified result - no cognitive analysis, just what was learned
		return {
			newUnderstanding: data.dismissed
				? context.currentUnderstanding
				: data.newUnderstanding,
			relevance: data.dismissed ? 0 : data.relevance,
			significance: data.significance,
			evolution: data.evolution,
			dismissed: data.dismissed,
			reasoning: data.reasoning,
			usage,
		}
	}
}
