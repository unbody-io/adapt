import type { LanguageModel } from 'ai'
import { createLearnerAgent, type LearnerAgent } from './agent.js'
import type { CompleteParams, SynthesizeParams } from './tools/schemas.js'
import type {
	Learner,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
	OnDataResult,
	OnQueryResult,
} from './types.js'

/**
 * Maintenance configuration for TextLearner
 */
export interface TextLearnerMaintenance {
	strategy: 'summarize' | 'truncate'
	maxTokens: number
}

/**
 * Token usage information
 */
export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

/**
 * Event emitted when an operation starts
 */
export interface LearnerStartEvent {
	operation: 'data' | 'query'
	input: unknown
	understanding: string
}

/**
 * Event emitted after each agent step
 */
export interface LearnerStepEvent {
	/** Which operation triggered this step */
	operation: 'data' | 'query'
	/** Step number (0-indexed) */
	stepNumber: number
	/** Tool calls made in this step (if any) */
	toolCalls?: Array<{
		toolName: string
		input: unknown
	}>
	/** Text generated in this step (if any) */
	text?: string
	/** Token usage for this step */
	usage?: TokenUsage
	/** Why this step finished */
	finishReason: string
}

/**
 * Event emitted when an operation completes
 */
export interface LearnerEndEvent {
	operation: 'data' | 'query'
	/** Total steps taken */
	totalSteps: number
	/** Aggregated token usage */
	usage?: TokenUsage
	/** Duration in milliseconds */
	durationMs: number
	/** Whether the operation succeeded */
	success: boolean
	/** Error message if failed */
	error?: string
}

/**
 * Callbacks for observing learner operations
 */
export interface LearnerObserver {
	/** Called when an operation starts */
	onStart?: (event: LearnerStartEvent) => void | Promise<void>
	/** Called after each agent step */
	onStep?: (event: LearnerStepEvent) => void | Promise<void>
	/** Called when an operation completes */
	onEnd?: (event: LearnerEndEvent) => void | Promise<void>
}

/**
 * Callback type for step events (simplified single-callback observer)
 */
export type OnStepCallback = (event: LearnerStepEvent) => void | Promise<void>

/**
 * Configuration for creating a TextLearner
 */
export interface TextLearnerConfig {
	/** The language model to use (from AI SDK) */
	model: LanguageModel
	/** Natural language description of what this learner pays attention to */
	purpose: string
	/** Optional unique identifier */
	id?: string
	/** How the learner was created */
	origin?: LearnerOrigin
	/** Maintenance settings for understanding compression */
	maintenance?: TextLearnerMaintenance
	/** Callback fired after each agent step (simplified observability) */
	onStep?: OnStepCallback
	/** Full observer for lifecycle events (start, step, end) */
	observer?: LearnerObserver
}

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * The most common learner type. Understanding is stored as a free text blob
 * that gets updated through data processing and queried for insights.
 */
export class TextLearner implements Learner<string> {
	readonly id: string
	readonly purpose: string
	readonly origin: LearnerOrigin

	private understanding = ''
	private governance: LearnerGovernance
	private agent: LearnerAgent
	// TODO: Implement maintenance (compression/summarization when understanding exceeds maxTokens)
	private _maintenance: TextLearnerMaintenance
	private _onStep?: OnStepCallback
	private _observer?: LearnerObserver

	constructor(config: TextLearnerConfig) {
		this.id = config.id ?? crypto.randomUUID()
		this.purpose = config.purpose
		this.origin = config.origin ?? 'developer'
		this._maintenance = config.maintenance ?? {
			strategy: 'summarize',
			maxTokens: 4000,
		}
		this._onStep = config.onStep
		this._observer = config.observer

		this.governance = {
			activation: 0,
			threshold: 0.3,
			status: 'dormant',
			lastAccessed: new Date(),
			retrievalCount: 0,
			successRate: 0,
		}

		this.agent = createLearnerAgent(config.model)
	}

	/**
	 * Get the current understanding (narrative text)
	 */
	getUnderstanding(): string {
		return this.understanding
	}

	/**
	 * Get the maintenance configuration
	 */
	getMaintenance(): TextLearnerMaintenance {
		return { ...this._maintenance }
	}

	/**
	 * Get a copy of the governance state
	 */
	getGovernance(): LearnerGovernance {
		return { ...this.governance }
	}

	/**
	 * Process a batch of data and update understanding
	 *
	 * The agent analyzes the data in relation to its purpose,
	 * then synthesizes an updated understanding.
	 */
	async onData(batch: unknown[]): Promise<OnDataResult> {
		const startTime = Date.now()
		let stepNumber = 0
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		// Emit start event
		await this._observer?.onStart?.({
			operation: 'data',
			input: batch,
			understanding: this.understanding,
		})

		const handleStep = async ({
			usage,
			finishReason,
			toolCalls,
		}: {
			usage?: {
				inputTokens?: number
				outputTokens?: number
				totalTokens?: number
			}
			finishReason: string
			toolCalls?: Array<{ toolName: string; input?: unknown }>
		}) => {
			const stepUsage =
				usage?.inputTokens != null &&
				usage?.outputTokens != null &&
				usage?.totalTokens != null
					? {
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
							totalTokens: usage.totalTokens,
						}
					: undefined

			// Accumulate usage
			if (stepUsage) {
				totalUsage.inputTokens += stepUsage.inputTokens
				totalUsage.outputTokens += stepUsage.outputTokens
				totalUsage.totalTokens += stepUsage.totalTokens
			}

			const event: LearnerStepEvent = {
				operation: 'data',
				stepNumber: stepNumber++,
				toolCalls: toolCalls?.map((tc) => ({
					toolName: tc.toolName,
					input: 'input' in tc ? tc.input : undefined,
				})),
				usage: stepUsage,
				finishReason,
			}

			// Call both callbacks if present
			await this._onStep?.(event)
			await this._observer?.onStep?.(event)
		}

		try {
			const result = await this.agent.generate({
				prompt: 'Process the provided data batch.',
				options: {
					operation: 'data',
					understanding: this.understanding,
					purpose: this.purpose,
					input: batch,
				},
				onStepFinish: handleStep,
			})

			// Extract structured output from done tool (synthesize)
			// staticToolCalls contains tool calls that weren't executed (done tools)
			const synthesizeCall = result.staticToolCalls.find(
				(call) => call.toolName === 'synthesize',
			)

			let relevance = 0
			if (synthesizeCall) {
				const input = synthesizeCall.input as SynthesizeParams
				this.understanding = input.newUnderstanding
				relevance = input.relevance

				// Update governance
				this.updateGovernance(relevance)
			}

			// Emit end event
			await this._observer?.onEnd?.({
				operation: 'data',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: true,
			})

			return { relevance }
		} catch (error) {
			// Emit end event with error
			await this._observer?.onEnd?.({
				operation: 'data',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Handle a query and return insights from understanding
	 *
	 * The agent generates a response based on its understanding
	 * and identifies any gaps in what it couldn't answer.
	 */
	async onQuery(query: string): Promise<OnQueryResult> {
		const startTime = Date.now()
		let stepNumber = 0
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		this.governance.lastAccessed = new Date()
		this.governance.retrievalCount++

		// Emit start event
		await this._observer?.onStart?.({
			operation: 'query',
			input: query,
			understanding: this.understanding,
		})

		const handleStep = async ({
			usage,
			finishReason,
			toolCalls,
		}: {
			usage?: {
				inputTokens?: number
				outputTokens?: number
				totalTokens?: number
			}
			finishReason: string
			toolCalls?: Array<{ toolName: string; input?: unknown }>
		}) => {
			const stepUsage =
				usage?.inputTokens != null &&
				usage?.outputTokens != null &&
				usage?.totalTokens != null
					? {
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
							totalTokens: usage.totalTokens,
						}
					: undefined

			// Accumulate usage
			if (stepUsage) {
				totalUsage.inputTokens += stepUsage.inputTokens
				totalUsage.outputTokens += stepUsage.outputTokens
				totalUsage.totalTokens += stepUsage.totalTokens
			}

			const event: LearnerStepEvent = {
				operation: 'query',
				stepNumber: stepNumber++,
				toolCalls: toolCalls?.map((tc) => ({
					toolName: tc.toolName,
					input: 'input' in tc ? tc.input : undefined,
				})),
				usage: stepUsage,
				finishReason,
			}

			// Call both callbacks if present
			await this._onStep?.(event)
			await this._observer?.onStep?.(event)
		}

		try {
			const result = await this.agent.generate({
				prompt: query,
				options: {
					operation: 'query',
					understanding: this.understanding,
					purpose: this.purpose,
					input: query,
				},
				onStepFinish: handleStep,
			})

			// Extract structured output from done tool (complete)
			// staticToolCalls contains tool calls that weren't executed (done tools)
			const completeCall = result.staticToolCalls.find(
				(call) => call.toolName === 'complete',
			)

			let queryResult: OnQueryResult
			if (completeCall) {
				const input = completeCall.input as CompleteParams
				queryResult = {
					relevant: input.relevant,
					confidence: input.confidence,
					insight: input.insight,
					gaps: input.gaps,
				}
			} else {
				queryResult = {
					relevant: false,
					confidence: 0,
					insight: '',
					gaps: ['Failed to process query'],
				}
			}

			// Emit end event
			await this._observer?.onEnd?.({
				operation: 'query',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: true,
			})

			return queryResult
		} catch (error) {
			// Emit end event with error
			await this._observer?.onEnd?.({
				operation: 'query',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	/**
	 * Get a human-readable summary of current understanding
	 */
	getSummary(): string {
		return this.understanding || '(no understanding yet)'
	}

	/**
	 * Get learner metadata including governance state
	 */
	getMetadata(): LearnerMetadata {
		return {
			id: this.id,
			purpose: this.purpose,
			origin: this.origin,
			governance: this.getGovernance(),
		}
	}

	/**
	 * Update governance based on relevance of processed data
	 *
	 * Uses exponential moving average to smooth activation changes
	 */
	private updateGovernance(relevance: number): void {
		// EMA: weight recent relevance at 20%
		this.governance.activation =
			this.governance.activation * 0.8 + relevance * 0.2

		// Update status based on threshold
		if (this.governance.activation >= this.governance.threshold) {
			this.governance.status = 'active'
		}

		this.governance.lastAccessed = new Date()
	}
}
