import type { LanguageModel } from 'ai'
import { generate, stepCountIs } from '../../../../llm'
import type { TokenUsage } from '../../../types'
// Import query tools from deprecated location
import { complete, generateResponse, identifyGaps } from '../../_tools'
import type { CompleteParams } from '../../_tools/complete/schema'
import type {
	QueryCallbacks,
	QueryContext,
	QueryMethod,
	QueryMethodUpdateConfig,
	QueryOptions,
	QueryResult,
} from '../types'
import { buildQueryPrompt } from './prompt.template.query'

const MAX_STEPS = 10

const tools = {
	generateResponse,
	identifyGaps,
	complete,
}

/**
 * Tool-based query method
 *
 * Uses generateText with tools in a loop to answer questions.
 * The model decides which tools to use during the query process.
 *
 * Pros:
 * - Works with all models (no structured output requirement)
 * - More control over the query process
 * - Model can reason step-by-step
 *
 * Cons:
 * - Higher token usage (multiple tool calls)
 * - Slower (multiple round trips)
 */
export class ToolBasedMethod implements QueryMethod {
	readonly name = 'tool-based'
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
		callbacks?: QueryCallbacks,
	): Promise<QueryResult> {
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		// Capture complete tool params
		let completeResult: CompleteParams | null = null

		const handleStep = ({
			usage,
			text,
			toolCalls,
		}: {
			usage?: {
				inputTokens?: number
				outputTokens?: number
				totalTokens?: number
			}
			text?: string
			toolCalls?: Array<{ toolName: string; input?: unknown }>
		}) => {
			// Accumulate usage
			if (usage?.inputTokens != null && usage?.outputTokens != null) {
				totalUsage.inputTokens += usage.inputTokens
				totalUsage.outputTokens += usage.outputTokens
				totalUsage.totalTokens += usage.totalTokens ?? 0
			}

			// Emit thinking
			if (text && callbacks?.onThinking) {
				const stepUsage: TokenUsage = {
					inputTokens: usage?.inputTokens ?? 0,
					outputTokens: usage?.outputTokens ?? 0,
					totalTokens: usage?.totalTokens ?? 0,
				}
				callbacks.onThinking([text], stepUsage)
			}

			// Process tool calls
			if (toolCalls) {
				for (const tc of toolCalls) {
					if (tc.toolName === 'complete') {
						completeResult = tc.input as CompleteParams
					}
				}
			}
		}

		// Build system prompt with context
		const system = buildQueryPrompt({
			learnerId: context.learnerId,
			instructions: context.instructions,
			understanding: context.understanding,
			question: context.question,
		})

		const { model: modelOverride, ...generateOptions } = options ?? {}

		const result = await generate({
			model: modelOverride ?? this.model,
			system,
			prompt: 'Answer the query based on your understanding.',
			tools,
			toolChoice: 'required',
			stopWhen: stepCountIs(MAX_STEPS),
			onStepFinish: handleStep,
			...generateOptions,
		})

		// Also check toolCalls for complete tool
		const completeCall = result.toolCalls.find((c) => c.toolName === 'complete')
		if (completeCall && 'input' in completeCall) {
			completeResult = completeCall.input as CompleteParams
		}

		// Build result
		if (completeResult) {
			return {
				relevant: completeResult.relevant,
				relevance: completeResult.relevance,
				confidence: completeResult.confidence,
				insight: completeResult.insight,
				gaps: completeResult.gaps.join('\n'),
				usage: totalUsage,
			}
		}

		// Fallback if no complete tool was called
		return {
			relevant: false,
			relevance: 0,
			confidence: 0,
			insight: 'Unable to generate response',
			gaps: 'Query processing did not complete',
			usage: totalUsage,
		}
	}
}
