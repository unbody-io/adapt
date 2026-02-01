import type { LanguageModel } from 'ai'
import { stepCountIs, ToolLoopAgent } from 'ai'
import { z } from 'zod'
import type {
	LearningMethod,
	LearnContext,
	LearnCallbacks,
	LearnResult,
	InitContext,
	InitResult,
} from '../types'
import type { TokenUsage } from '../../../types'
import type { CompareSkill } from '../../cognitive-skills/compare'
import { ingestPromptTemplate } from './prompt.template.ingest'

// Import only the tools we need
import { classify, synthesize, dismiss } from '../../tools'

import type { ClassifyParams } from '../../tools/classify/schema'
import type { SynthesizeParams } from '../../tools/synthesize/schema'
import type { DismissParams } from '../../tools/dismiss/schema'

/**
 * Call options schema for the tool-based method
 */
const callOptionsSchema = z.object({
	learnerId: z.string(),
	instructions: z.string(),
	currentUnderstanding: z.string(),
	data: z.unknown(),
})

export type CallOptions = z.infer<typeof callOptionsSchema>

/**
 * Tools available for learning:
 * - classify: Optional - trace how observations relate to understanding
 * - synthesize: Terminal - commit new understanding
 * - dismiss: Terminal - reject data as irrelevant
 */
const LEARNING_TOOLS = ['classify', 'synthesize', 'dismiss'] as const

const MAX_STEPS = 10

const tools = {
	classify,
	synthesize,
	dismiss,
}

/**
 * Tool-based learning method
 *
 * Uses a ToolLoopAgent with minimal tools to analyze data.
 * The model reasons internally and commits via synthesize or dismiss.
 *
 * Pros:
 * - Works with all models (no structured output requirement)
 * - Comparison traceability via classify tool
 * - Model can reason step-by-step
 *
 * Cons:
 * - Higher token usage (multiple tool calls)
 * - Slower (multiple round trips)
 */
export class ToolBasedMethod implements LearningMethod {
	readonly name = 'tool-based'
	private agent
	private _systemPrompt: string | null = null

	get systemPrompt(): string | null {
		return this._systemPrompt
	}

	constructor(model: LanguageModel) {
		this.agent = new ToolLoopAgent({
			model,
			callOptionsSchema,
			tools,
			prepareCall: ({ options, ...settings }) => ({
				...settings,
				activeTools: [...LEARNING_TOOLS],
				toolChoice: 'required' as const,
				instructions: ingestPromptTemplate({
					learnerId: options.learnerId,
					instructions: options.instructions,
					currentUnderstanding: options.currentUnderstanding,
					data: options.data as unknown[],
				}),
			}),
			stopWhen: stepCountIs(MAX_STEPS),
		})
	}

	async init(_context: InitContext): Promise<InitResult> {
		// TODO: Implement proper system prompt generation for tool-based method
		// For now, use a placeholder to satisfy the interface
		this._systemPrompt = 'tool-based-method-placeholder'
		return {
			systemPrompt: this._systemPrompt,
			usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
		}
	}

	async learn(
		context: LearnContext,
		callbacks?: LearnCallbacks,
	): Promise<LearnResult> {
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		// Capture terminal tool params
		let synthesizeResult: SynthesizeParams | null = null
		let dismissResult: DismissParams | null = null

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
					// Capture terminal tools
					if (tc.toolName === 'synthesize') {
						synthesizeResult = tc.input as SynthesizeParams
					} else if (tc.toolName === 'dismiss') {
						dismissResult = tc.input as DismissParams
					} else if (tc.toolName === 'classify' && tc.input) {
						// Emit comparison for traceability
						const c = tc.input as ClassifyParams
						callbacks?.onComparison?.({
							observation: c.observation,
							skill: c.skill as CompareSkill,
							reasoning: c.reasoning,
						})
					}
				}
			}
		}

		const result = await this.agent.generate({
			prompt: 'Process the provided data batch.',
			options: {
				learnerId: context.learnerId,
				instructions: context.instructions,
				currentUnderstanding: context.currentUnderstanding,
				data: context.data,
			},
			onStepFinish: handleStep,
		})

		// Also check staticToolCalls for terminal tools
		const synthCall = result.staticToolCalls.find(
			(c) => c.toolName === 'synthesize',
		)
		const dismissCall = result.staticToolCalls.find(
			(c) => c.toolName === 'dismiss',
		)
		if (synthCall) synthesizeResult = synthCall.input as SynthesizeParams
		if (dismissCall) dismissResult = dismissCall.input as DismissParams

		// Build result
		if (dismissResult) {
			return {
				newUnderstanding: context.currentUnderstanding,
				relevance: 0,
				significance: 'routine',
				evolution: dismissResult.reason,
				dismissed: true,
				usage: totalUsage,
			}
		}

		if (synthesizeResult) {
			return {
				newUnderstanding: synthesizeResult.newUnderstanding,
				relevance: synthesizeResult.relevance,
				significance: synthesizeResult.significance,
				evolution: synthesizeResult.evolution,
				dismissed: false,
				reasoning: synthesizeResult.reasoning,
				usage: totalUsage,
			}
		}

		// Fallback if no terminal tool was called
		return {
			newUnderstanding: context.currentUnderstanding,
			relevance: 0,
			significance: 'routine',
			evolution: 'No synthesis performed',
			dismissed: true,
			usage: totalUsage,
		}
	}
}
