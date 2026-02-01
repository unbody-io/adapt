import type { LanguageModel } from 'ai'
import { nanoid } from 'nanoid'
import { applyStrategy } from './strategies'
import type {
	EvolutionEntry,
	Learner,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
} from '../types'
import type {
	TextLearnerConfig,
	TextLearnerMaintenance,
	TextLearnerEventMap,
	LearningMethodName,
	QueryMethodName,
} from './types'
import { TypedEmitter } from '../../types/events'
import {
	createLearningMethod,
	type LearningMethod,
	type LearnResult,
} from './learning-methods'
import {
	createQueryMethod,
	type QueryMethod,
	type QueryResult,
} from './query-methods'

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

	private understanding = ''
	private evolution: EvolutionEntry[] = []
	private governance: LearnerGovernance
	private _model: LanguageModel
	private _maintenance: TextLearnerMaintenance
	private _learningMethod: LearningMethod
	private _learningMethodName: LearningMethodName
	private _queryMethod: QueryMethod
	private _queryMethodName: QueryMethodName

	constructor(config: TextLearnerConfig) {
		super()
		this.id = config.id ?? crypto.randomUUID()
		this.instructions = config.instructions
		this.origin = config.origin ?? 'developer'
		this._model = config.model
		this._maintenance = config.maintenance ?? {
			strategy: 'continuous',
		}
		this._learningMethodName = config.learningMethod ?? 'tool-based'
		this._learningMethod = createLearningMethod(
			this._learningMethodName,
			config.model,
		)
		this._queryMethodName = config.queryMethod ?? 'tool-based'
		this._queryMethod = createQueryMethod(
			this._queryMethodName,
			config.model,
		)

		this.governance = {
			activation: 0,
			threshold: 0.3,
			status: 'dormant',
			lastAccessed: new Date(),
			retrievalCount: 0,
			successRate: 0,
		}
	}

	/**
	 * Initialize the learner
	 *
	 * Delegates to the learning method to generate its system prompt.
	 * This must be called before learn() or query().
	 *
	 * @returns The generated system prompt and token usage
	 */
	async init(): Promise<{ systemPrompt: string; usage: import('../types').TokenUsage }> {
		if (this._learningMethod.systemPrompt) {
			return {
				systemPrompt: this._learningMethod.systemPrompt,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			const result = await this._learningMethod.init({
				instructions: this.instructions,
				strategy: this._maintenance.strategy,
			})

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: result.systemPrompt,
				usage: result.usage,
			})

			return result
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
	 * Check if the learner has been initialized
	 */
	isInitialized(): boolean {
		return this._learningMethod.systemPrompt !== null
	}

	/**
	 * Get the generated system prompt (null if not initialized)
	 */
	getSystemPrompt(): string | null {
		return this._learningMethod.systemPrompt
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
	 * Get the current learning method name
	 */
	getLearningMethodName(): LearningMethodName {
		return this._learningMethodName
	}

	/**
	 * Get the current query method name
	 */
	getQueryMethodName(): QueryMethodName {
		return this._queryMethodName
	}

	/**
	 * Learn from a batch of data using the configured learning method
	 *
	 * This is the primary method for processing data. It delegates to the
	 * configured learning method (tool-based or direct) and handles:
	 * - Understanding updates
	 * - Evolution tracking
	 * - Event emission
	 *
	 * @param batch - Array of data items to learn from
	 * @returns LearnResult with updated understanding and metadata
	 */
	async learn(batch: unknown[]): Promise<LearnResult & { chunkId: string }> {
		if (!this._learningMethod.systemPrompt) {
			throw new Error('Learner not initialized. Call init() first.')
		}

		const chunkId = `chunk_${nanoid()}`

		this.emit('learner:ingest:started', {
			learnerId: this.id,
			itemCount: batch.length,
			chunkCount: 1,
		})

		this.emit('learner:ingest:chunk:started', {
			learnerId: this.id,
			chunkId,
			chunkIndex: 0,
		})

		try {
			const result = await this._learningMethod.learn(
				{
					learnerId: this.id,
					instructions: this.instructions,
					currentUnderstanding: this.understanding,
					data: batch,
				},
				{
					onThinking: (thoughts, usage) => {
						this.emit('learner:ingest:thinking', {
							learnerId: this.id,
							chunkId,
							thoughts,
							usage,
						})
					},
					onComparison: (observation) => {
						// Emit comparison for traceability (ToolBasedMethod only)
						this.emit('learner:ingest:tool:started', {
							learnerId: this.id,
							chunkId,
							toolName: 'classify',
							input: observation,
						})
						this.emit('learner:ingest:tool:completed', {
							learnerId: this.id,
							chunkId,
							toolName: 'classify',
							output: observation,
						})
					},
				},
			)

			// Update state if not dismissed
			if (!result.dismissed) {
				const previousUnderstanding = this.understanding
				this.understanding = result.newUnderstanding

				// Apply strategy-specific maintenance
				const strategyResult = await applyStrategy({
					understanding: this.understanding,
					model: this._model,
					config: this._maintenance,
				})
				this.understanding = strategyResult.understanding

				// Create evolution entry
				const evolutionEntry: EvolutionEntry = {
					summary: result.evolution,
					significance: result.significance,
					timestamp: new Date().toISOString(),
				}
				this.evolution.unshift(evolutionEntry)

				// Emit understanding updated
				this.emit('learner:understanding:updated', {
					learnerId: this.id,
					understanding: this.understanding,
					previousUnderstanding,
					entry: evolutionEntry,
				})

				// Update governance
				this.updateGovernance(result.relevance)
			}

			this.emit('learner:ingest:chunk:completed', {
				learnerId: this.id,
				chunkId,
				relevance: result.relevance,
				usage: result.usage,
			})

			this.emit('learner:ingest:completed', {
				learnerId: this.id,
				totalRelevance: result.relevance,
				usage: result.usage,
			})

			return { ...result, chunkId }
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
	 * Query against understanding using the configured query method
	 *
	 * This is the primary method for querying. It delegates to the
	 * configured query method (tool-based or direct) and handles:
	 * - Response generation based on understanding
	 * - Gap identification
	 * - Event emission
	 *
	 * @param question - The question or query to answer
	 * @returns QueryResult with insight, confidence, and gaps
	 */
	async query(question: string): Promise<QueryResult> {
		this.governance.lastAccessed = new Date()
		this.governance.retrievalCount++

		this.emit('learner:ask:started', {
			learnerId: this.id,
			query: question,
		})

		try {
			const result = await this._queryMethod.query(
				{
					learnerId: this.id,
					instructions: this.instructions,
					understanding: this.understanding,
					question,
				},
				{
					onThinking: (thoughts, usage) => {
						this.emit('learner:ask:thinking', {
							learnerId: this.id,
							thoughts,
							usage,
						})
					},
				},
			)

			this.emit('learner:ask:completed', {
				learnerId: this.id,
				insight: result.insight,
				confidence: result.confidence,
				gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
				usage: result.usage,
			})

			return result
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
