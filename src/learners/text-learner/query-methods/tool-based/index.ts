import type { LanguageModel } from 'ai'
import { stepCountIs, ToolLoopAgent } from 'ai'
import { z } from 'zod'
import type {
	QueryMethod,
	QueryContext,
	QueryOptions,
	QueryCallbacks,
	QueryResult,
} from '../types'
import type { TokenUsage } from '../../../types'
import { buildQueryPrompt } from './prompt.template.query'

// Import query tools from deprecated location
import { generateResponse, identifyGaps, complete } from '../../_tools'

import type { CompleteParams } from '../../_tools/complete/schema'

/**
 * Call options schema for the tool-based query method
 */
const callOptionsSchema = z.object({
	learnerId: z.string(),
	instructions: z.string(),
	understanding: z.string(),
	question: z.string(),
})

export type CallOptions = z.infer<typeof callOptionsSchema>

const QUERY_TOOLS = ['generateResponse', 'identifyGaps', 'complete'] as const

const MAX_STEPS = 10

const tools = {
	generateResponse,
	identifyGaps,
	complete,
}

/**
 * Tool-based query method
 *
 * Uses a ToolLoopAgent with query tools to answer questions.
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
	private agent

	constructor(model: LanguageModel) {
		this.agent = new ToolLoopAgent({
			model,
			callOptionsSchema,
			tools,
			prepareCall: ({ options, ...settings }) => ({
				...settings,
				activeTools: [...QUERY_TOOLS],
				toolChoice: 'required' as const,
				instructions: buildQueryPrompt({
					learnerId: options.learnerId,
					instructions: options.instructions,
					understanding: options.understanding,
					question: options.question,
				}),
			}),
			stopWhen: stepCountIs(MAX_STEPS),
		})
	}

	async query(
		context: QueryContext,
		_options?: QueryOptions,
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

		const result = await this.agent.generate({
			prompt: 'Answer the query based on your understanding.',
			options: {
				learnerId: context.learnerId,
				instructions: context.instructions,
				understanding: context.understanding,
				question: context.question,
			},
			onStepFinish: handleStep,
		})

		// Also check staticToolCalls for complete tool
		const completeCall = result.staticToolCalls.find(
			(c) => c.toolName === 'complete',
		)
		if (completeCall) completeResult = completeCall.input as CompleteParams

		// Build result
		if (completeResult) {
			return {
				relevant: completeResult.relevant,
				confidence: completeResult.confidence,
				insight: completeResult.insight,
				gaps: completeResult.gaps.join('\n'),
				usage: totalUsage,
			}
		}

		// Fallback if no complete tool was called
		return {
			relevant: false,
			confidence: 0,
			insight: 'Unable to generate response',
			gaps: 'Query processing did not complete',
			usage: totalUsage,
		}
	}
}
