import { generateText, type LanguageModel } from 'ai'
import { nanoid } from 'nanoid'
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
	TokenUsage,
} from '../types'
import { createLearnerAgent, type LearnerAgent } from './agent'
import type {
	TextLearnerConfig,
	TextLearnerMaintenance,
	TextLearnerEventMap,
} from './types'
import { TypedEmitter } from '../../types/events'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * The most common learner type. Understanding is stored as a free text blob
 * that gets updated through data processing and queried for insights.
 *
 * Extends TypedEmitter to provide event-based observability.
 */
export class TextLearner
	extends TypedEmitter<TextLearnerEventMap>
	implements Learner<string>
{
	readonly id: string
	readonly instructions: string
	readonly origin: LearnerOrigin

	/** Character-to-token ratio for estimation (internal constant) */
	private static CHARS_PER_TOKEN = 4
	/** Default max input tokens before chunking */
	private static DEFAULT_MAX_INPUT_TOKENS = 30000

	private understanding = ''
	private evolution: EvolutionEntry[] = []
	private governance: LearnerGovernance
	private agent: LearnerAgent
	private _model: LanguageModel
	private _maintenance: TextLearnerMaintenance
	private _maxInputTokens: number
	private _systemPrompt: string | null = null

	constructor(config: TextLearnerConfig) {
		super()
		this.id = config.id ?? crypto.randomUUID()
		this.instructions = config.instructions
		this.origin = config.origin ?? 'developer'
		this._model = config.model
		this._maintenance = config.maintenance ?? {
			strategy: 'continuous',
		}
		this._maxInputTokens =
			config.maxInputTokens ?? TextLearner.DEFAULT_MAX_INPUT_TOKENS

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
	private async synthesizeSystemPrompt(): Promise<{
		systemPrompt: string
		usage: TokenUsage
	}> {
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

		return {
			systemPrompt: result.text.trim(),
			usage: {
				inputTokens: result.usage?.inputTokens ?? 0,
				outputTokens: result.usage?.outputTokens ?? 0,
				totalTokens: result.usage?.totalTokens ?? 0,
			},
		}
	}

	/**
	 * Ensure system prompt is initialized (lazy initialization)
	 * Called on first ingest() call
	 */
	private async ensureInitialized(): Promise<{ usage: TokenUsage }> {
		if (this._systemPrompt !== null) {
			return { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			const { systemPrompt, usage } = await this.synthesizeSystemPrompt()
			this._systemPrompt = systemPrompt

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this._systemPrompt,
				usage,
			})

			return { usage }
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:init:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	/**
	 * Estimate token count for a string using character-based approximation
	 */
	private estimateTokens(text: string): number {
		return Math.ceil(text.length / TextLearner.CHARS_PER_TOKEN)
	}

	/**
	 * Process a single chunk of data through the agent
	 *
	 * This is the core processing logic extracted for chunking support.
	 * Updates understanding, applies strategy, and tracks evolution.
	 */
	private async processChunk(
		items: unknown[],
		chunkId: string,
		chunkIndex: number,
	): Promise<{ relevance: number; usage: TokenUsage }> {
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		this.emit('learner:ingest:chunk:started', {
			learnerId: this.id,
			chunkId,
			chunkIndex,
		})

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
			toolCalls?: Array<{ toolName: string; args?: unknown }>
		}) => {
			const stepUsage: TokenUsage =
				usage?.inputTokens != null &&
				usage?.outputTokens != null &&
				usage?.totalTokens != null
					? {
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
							totalTokens: usage.totalTokens,
						}
					: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

			// Accumulate usage
			totalUsage.inputTokens += stepUsage.inputTokens
			totalUsage.outputTokens += stepUsage.outputTokens
			totalUsage.totalTokens += stepUsage.totalTokens

			// Emit thinking event if there's text (reasoning)
			if (text) {
				this.emit('learner:ingest:thinking', {
					learnerId: this.id,
					chunkId,
					thoughts: [text],
					usage: stepUsage,
				})
			}

			// Emit tool events
			if (toolCalls) {
				for (const tc of toolCalls) {
					this.emit('learner:ingest:tool:started', {
						learnerId: this.id,
						chunkId,
						toolName: tc.toolName,
						input: tc.args,
					})
					// Tool completed is emitted immediately since we don't have async tool execution tracking
					this.emit('learner:ingest:tool:completed', {
						learnerId: this.id,
						chunkId,
						toolName: tc.toolName,
						output: tc.args, // The tool input becomes output in this context
					})
				}
			}
		}

		try {
			const result = await this.agent.generate({
				prompt: 'Process the provided data batch.',
				options: {
					operation: 'ingest',
					understanding: this.understanding,
					instructions: this.instructions,
					input: items,
				},
				onStepFinish: handleStep,
			})

			// Extract structured output from done tool (synthesize)
			const synthesizeCall = result.staticToolCalls.find(
				(call) => call.toolName === 'synthesize',
			)

			let relevance = 0
			if (synthesizeCall) {
				const input = synthesizeCall.input as SynthesizeParams
				const previousUnderstanding = this.understanding
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
				const evolutionEntry: EvolutionEntry = {
					summary: input.entry.summary,
					significance: input.entry.significance,
					timestamp: new Date().toISOString(),
				}

				// Append to evolution (newest first)
				this.evolution.unshift(evolutionEntry)

				// Emit understanding updated event
				this.emit('learner:understanding:updated', {
					learnerId: this.id,
					understanding: this.understanding,
					previousUnderstanding,
					entry: evolutionEntry,
				})

				// Update governance and emit event
				this.updateGovernance(relevance)
			}

			this.emit('learner:ingest:chunk:completed', {
				learnerId: this.id,
				chunkId,
				relevance,
				usage: totalUsage,
			})

			return { relevance, usage: totalUsage }
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:ingest:tool:failed', {
				learnerId: this.id,
				chunkId,
				toolName: 'processChunk',
				error: error.message,
			})
			throw error
		}
	}

	/**
	 * Ingest a batch of data and update understanding
	 *
	 * If input exceeds maxInputTokens, it's split into chunks and processed sequentially.
	 * Each chunk updates understanding independently.
	 */
	async ingest(batch: unknown[]): Promise<IngestResult> {
		// Lazy initialize system prompt on first call
		const initResult = await this.ensureInitialized()

		const serialized = JSON.stringify(batch)
		const estimatedTokens = this.estimateTokens(serialized)

		// Calculate chunk count
		const chunkCount =
			estimatedTokens <= this._maxInputTokens
				? 1
				: Math.ceil(estimatedTokens / this._maxInputTokens)

		const totalUsage: TokenUsage = {
			inputTokens: initResult.usage.inputTokens,
			outputTokens: initResult.usage.outputTokens,
			totalTokens: initResult.usage.totalTokens,
		}

		this.emit('learner:ingest:started', {
			learnerId: this.id,
			itemCount: batch.length,
			chunkCount,
		})

		try {
			// Single chunk - fits within token limit
			if (chunkCount === 1) {
				const chunkId = `chunk_${nanoid()}`
				const result = await this.processChunk(batch, chunkId, 0)

				totalUsage.inputTokens += result.usage.inputTokens
				totalUsage.outputTokens += result.usage.outputTokens
				totalUsage.totalTokens += result.usage.totalTokens

				this.emit('learner:ingest:completed', {
					learnerId: this.id,
					totalRelevance: result.relevance,
					usage: totalUsage,
				})

				return {
					chunks: [
						{
							id: chunkId,
							index: 0,
							relevance: result.relevance,
						},
					],
				}
			}

			// Multiple chunks needed - split by item count
			const chunkSize = Math.ceil(batch.length / chunkCount)

			const itemChunks: unknown[][] = []
			for (let i = 0; i < batch.length; i += chunkSize) {
				itemChunks.push(batch.slice(i, i + chunkSize))
			}

			// Process chunks sequentially
			const chunkResults: IngestResult['chunks'] = []
			let totalRelevance = 0

			for (let i = 0; i < itemChunks.length; i++) {
				const chunkId = `chunk_${nanoid()}`
				const result = await this.processChunk(itemChunks[i], chunkId, i)

				totalUsage.inputTokens += result.usage.inputTokens
				totalUsage.outputTokens += result.usage.outputTokens
				totalUsage.totalTokens += result.usage.totalTokens
				totalRelevance += result.relevance

				chunkResults.push({
					id: chunkId,
					index: i,
					relevance: result.relevance,
				})
			}

			// Average relevance across chunks
			const avgRelevance =
				chunkResults.length > 0 ? totalRelevance / chunkResults.length : 0

			this.emit('learner:ingest:completed', {
				learnerId: this.id,
				totalRelevance: avgRelevance,
				usage: totalUsage,
			})

			return { chunks: chunkResults }
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:ingest:failed', {
				learnerId: this.id,
				error: error.message,
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
		const totalUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		}

		this.governance.lastAccessed = new Date()
		this.governance.retrievalCount++

		this.emit('learner:ask:started', {
			learnerId: this.id,
			query,
		})

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
			toolCalls?: Array<{ toolName: string; args?: unknown }>
		}) => {
			const stepUsage: TokenUsage =
				usage?.inputTokens != null &&
				usage?.outputTokens != null &&
				usage?.totalTokens != null
					? {
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
							totalTokens: usage.totalTokens,
						}
					: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

			// Accumulate usage
			totalUsage.inputTokens += stepUsage.inputTokens
			totalUsage.outputTokens += stepUsage.outputTokens
			totalUsage.totalTokens += stepUsage.totalTokens

			// Emit thinking event if there's text (reasoning)
			if (text) {
				this.emit('learner:ask:thinking', {
					learnerId: this.id,
					thoughts: [text],
					usage: stepUsage,
				})
			}

			// Emit tool events
			if (toolCalls) {
				for (const tc of toolCalls) {
					this.emit('learner:ask:tool:started', {
						learnerId: this.id,
						toolName: tc.toolName,
						input: tc.args,
					})
					this.emit('learner:ask:tool:completed', {
						learnerId: this.id,
						toolName: tc.toolName,
						output: tc.args,
					})
				}
			}
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

			this.emit('learner:ask:completed', {
				learnerId: this.id,
				insight: askResult.insight,
				confidence: askResult.confidence,
				gaps: askResult.gaps,
				usage: totalUsage,
			})

			return askResult
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:ask:failed', {
				learnerId: this.id,
				error: error.message,
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
		const previousStatus = this.governance.status

		// EMA: weight recent relevance at 20%
		this.governance.activation =
			this.governance.activation * 0.8 + relevance * 0.2

		// Update status based on threshold
		if (this.governance.activation >= this.governance.threshold) {
			this.governance.status = 'active'
		}

		this.governance.lastAccessed = new Date()

		// Emit governance updated event
		this.emit('learner:governance:updated', {
			learnerId: this.id,
			activation: this.governance.activation,
			status: this.governance.status,
			previousStatus:
				previousStatus !== this.governance.status ? previousStatus : undefined,
		})
	}
}
