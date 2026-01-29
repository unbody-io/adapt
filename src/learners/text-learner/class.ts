import { generateText, type LanguageModel } from 'ai'
import { applyStrategy, strategyPrompts } from './strategies'
import type { CompleteParams, SynthesizeParams } from './tools'
import { evolutionDefaults } from './tools/synthesize/prompt.defaults'
import { systemPromptTemplate } from './prompt.template.system'
import type {
	AskResult,
	EvolutionEntry,
	IngestResult,
	Learner,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
} from '../types'
import { createLearnerAgent, type LearnerAgent } from './agent'
import type {
	LearnerObserver,
	LearnerStepEvent,
	OnStepCallback,
	TextLearnerConfig,
	TextLearnerMaintenance,
	TokenUsage,
} from './types'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * The most common learner type. Understanding is stored as a free text blob
 * that gets updated through data processing and queried for insights.
 */
export class TextLearner implements Learner<string> {
	readonly id: string
	readonly instructions: string
	readonly origin: LearnerOrigin

	private understanding = ''
	private evolution: EvolutionEntry[] = []
	private governance: LearnerGovernance
	private agent: LearnerAgent
	private _model: LanguageModel
	private _maintenance: TextLearnerMaintenance
	private _systemPrompt: string | null = null
	private _onStep?: OnStepCallback
	private _observer?: LearnerObserver

	constructor(config: TextLearnerConfig) {
		this.id = config.id ?? crypto.randomUUID()
		this.instructions = config.instructions
		this.origin = config.origin ?? 'developer'
		this._model = config.model
		this._maintenance = config.maintenance ?? {
			strategy: 'continuous',
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
	 * Get a copy of the evolution history (newest first)
	 */
	getEvolution(): EvolutionEntry[] {
		return [...this.evolution]
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
	 * Get the synthesized system prompt (null if not yet initialized)
	 */
	getSystemPrompt(): string | null {
		return this._systemPrompt
	}

	/**
	 * Synthesize the system prompt using LLM
	 */
	private async synthesizeSystemPrompt(): Promise<string> {
		const strategyPrompt = strategyPrompts[this._maintenance.strategy]
		const prompt = systemPromptTemplate(
			strategyPrompt,
			this.instructions,
			evolutionDefaults,
		)

		const result = await generateText({
			model: this._model,
			prompt,
		})

		return result.text.trim()
	}

	/**
	 * Ensure system prompt is initialized (lazy initialization)
	 * Called on first ingest() call
	 */
	private async ensureInitialized(): Promise<void> {
		if (this._systemPrompt !== null) return

		const initStart = Date.now()
		try {
			this._systemPrompt = await this.synthesizeSystemPrompt()

			await this._observer?.onInitialized?.({
				systemPrompt: this._systemPrompt,
				durationMs: Date.now() - initStart,
			})
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			await this._observer?.onInitError?.({
				error,
				durationMs: Date.now() - initStart,
			})
			throw error
		}
	}

	/**
	 * Ingest a batch of data and update understanding
	 *
	 * The agent analyzes the data in relation to its instructions,
	 * then synthesizes an updated understanding.
	 */
	async ingest(batch: unknown[]): Promise<IngestResult> {
		// Lazy initialize system prompt on first call
		await this.ensureInitialized()

		const startTime = Date.now()
		let stepNumber = 0
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		// Emit start event
		await this._observer?.onStart?.({
			operation: 'ingest',
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
				operation: 'ingest',
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
					operation: 'ingest',
					understanding: this.understanding,
					instructions: this.instructions,
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
			let evolutionEntry: EvolutionEntry | undefined
			if (synthesizeCall) {
				const input = synthesizeCall.input as SynthesizeParams
				this.understanding = input.newUnderstanding
				relevance = input.relevance

				// Apply strategy-specific maintenance (e.g., summarization for cumulative)
				const strategyResult = await applyStrategy({
					understanding: this.understanding,
					model: this._model,
					config: this._maintenance,
				})
				this.understanding = strategyResult.understanding

				// Create evolution entry with timestamp
				evolutionEntry = {
					summary: input.entry.summary,
					significance: input.entry.significance,
					timestamp: new Date().toISOString(),
				}

				// Append to evolution (newest first)
				this.evolution.unshift(evolutionEntry)

				// Update governance
				this.updateGovernance(relevance)
			}

			// Emit end event with evolution entry
			await this._observer?.onEnd?.({
				operation: 'ingest',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: true,
				entry: evolutionEntry,
			})

			return { relevance }
		} catch (error) {
			// Emit end event with error
			await this._observer?.onEnd?.({
				operation: 'ingest',
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
	 * Ask the learner and return insights from understanding
	 *
	 * The agent generates a response based on its understanding
	 * and identifies any gaps in what it couldn't answer.
	 */
	async ask(query: string): Promise<AskResult> {
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
			operation: 'ask',
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
				operation: 'ask',
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
					operation: 'ask',
					understanding: this.understanding,
					instructions: this.instructions,
					input: query,
				},
				onStepFinish: handleStep,
			})

			// Extract structured output from done tool (complete)
			// staticToolCalls contains tool calls that weren't executed (done tools)
			const completeCall = result.staticToolCalls.find(
				(call) => call.toolName === 'complete',
			)

			let askResult: AskResult
			if (completeCall) {
				const input = completeCall.input as CompleteParams
				askResult = {
					relevant: input.relevant,
					confidence: input.confidence,
					insight: input.insight,
					gaps: input.gaps,
				}
			} else {
				askResult = {
					relevant: false,
					confidence: 0,
					insight: '',
					gaps: ['Failed to process query'],
				}
			}

			// Emit end event
			await this._observer?.onEnd?.({
				operation: 'ask',
				totalSteps: stepNumber,
				usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
				durationMs: Date.now() - startTime,
				success: true,
			})

			return askResult
		} catch (error) {
			// Emit end event with error
			await this._observer?.onEnd?.({
				operation: 'ask',
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
			instructions: this.instructions,
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
