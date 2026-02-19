/**
 * BaseLearner — abstract base class for all learner types
 *
 * Owns: identity, health, metrics, evolution, events, signal detection,
 * learn() orchestration (delegates to LearningMethod + handleLearnResult bookkeeping).
 *
 * Subclasses must:
 * - Set `_learningMethod` and `_queryMethod` in their constructor
 * - Implement `getUnderstanding()`, `setUnderstanding()`, `getSummary()`, `hasKnowledge()`
 * - Implement `init()` and `update()` (lifecycle methods that depend on subclass config)
 */

import { TypedEmitter } from '../../types/events'
import type { LearnerActivity } from '../../brain/evaluator/types'
import type {
	EvolutionEntry,
	Learner,
	LearnerHealth,
	LearnerMetadata,
	LearnerMetrics,
	LearnerOrigin,
} from '../types'
import type {
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	LearningMethod,
} from './learning-method'
import type { QueryCallbacks, QueryMethod, QueryOptions, QueryResult } from './query-method'
import type { SharedLearnerEventMap } from './types'

/**
 * Configuration for BaseLearner constructor
 */
export interface BaseLearnerInit {
	id: string
	name: string
	instructions: string
	origin: LearnerOrigin
	focus?: string
	description?: string
	health?: Partial<LearnerHealth>
	maxObservationsForStagnation?: number
}

export abstract class BaseLearner<TUnderstanding>
	extends TypedEmitter<SharedLearnerEventMap>
	implements Learner<TUnderstanding>
{
	readonly id: string
	name: string
	instructions: string
	focus?: string
	description?: string

	protected _origin: LearnerOrigin
	protected _learningMethod!: LearningMethod
	protected _queryMethod!: QueryMethod
	protected evolution: EvolutionEntry[] = []
	protected health: LearnerHealth
	protected metrics: LearnerMetrics = {
		ingestion: {
			observationCount: 0,
			dismissalCount: 0,
			dismissalRate: 0,
			synthesisCount: 0,
			observationsSinceLastSynthesis: 0,
		},
		query: {
			count: 0,
			relevanceScores: [],
			confidenceScores: [],
			gaps: [],
		},
	}

	// Signal fire-once flags (reset when condition clears)
	protected stagnationSignalFired = false
	protected dismissalSignalFired = false

	constructor(init: BaseLearnerInit) {
		super()
		this.id = init.id
		this.name = init.name
		this.instructions = init.instructions
		this._origin = init.origin
		this.focus = init.focus
		this.description = init.description

		this.health = {
			activation: 0,
			threshold: 0.3,
			status: 'dormant',
			lastAccessed: new Date(),
			signalThresholds: {
				maxDismissalRate: 0.8,
				minRelevance: 0.3,
				minConfidence: 0.3,
				maxObservationsWithoutSynthesis: init.maxObservationsForStagnation ?? 30,
				...init.health?.signalThresholds,
			},
		}
	}

	// ── Abstract — each subclass implements ─────────────────────────────────

	abstract getUnderstanding(): TUnderstanding
	abstract setUnderstanding(value: TUnderstanding): void
	abstract getSummary(): string
	abstract hasKnowledge(): boolean

	// update() stays abstract — depends on subclass config
	abstract update(updates: Record<string, unknown>): Promise<{ changedFields: string[] }>

	// ── Init (concrete — shared by all learner types) ─────────────────────

	async init(): Promise<{
		observeSystemPrompt: string
		synthesizeSystemPrompt: string
	}> {
		if (this.isInitialized()) {
			return {
				observeSystemPrompt: this._learningMethod.observePrompt!,
				synthesizeSystemPrompt: this._learningMethod.synthesizePrompt!,
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			await this.update({ instructions: this.instructions })

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this._learningMethod.observePrompt!,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			})

			return {
				observeSystemPrompt: this._learningMethod.observePrompt!,
				synthesizeSystemPrompt: this._learningMethod.synthesizePrompt!,
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:init:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	// ── Identity ────────────────────────────────────────────────────────────

	get origin(): LearnerOrigin {
		return this._origin
	}

	// ── Learn (concrete — delegates to _learningMethod) ─────────────────────

	/**
	 * Learn from a batch of data
	 *
	 * Delegates to the pluggable LearningMethod, then does shared bookkeeping
	 * (metrics, evolution, events, governance, signals) via handleLearnResult.
	 */
	async learn(batch: unknown[], options?: LearnOptions): Promise<LearnOutput> {
		if (!this.isInitialized()) {
			throw new Error('Learner not initialized. Call init() first.')
		}

		try {
			const result = await this._learningMethod.learn(
				this.id,
				this.instructions,
				this.getUnderstanding(),
				batch,
				options,
				{
					onObserveStarted: (itemCount) => {
						this.emit('learner:observe:started', {
							learnerId: this.id,
							itemCount,
						})
					},
					onObserveThinking: (thoughts) => {
						this.emit('learner:observe:thinking', {
							learnerId: this.id,
							thoughts,
							usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
						})
					},
					onSynthesizeStarted: (observationCount) => {
						this.emit('learner:synthesize:started', {
							learnerId: this.id,
							observationCount,
						})
					},
					onSynthesizeThinking: (thoughts) => {
						this.emit('learner:synthesize:thinking', {
							learnerId: this.id,
							thoughts,
							usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
						})
					},
				} satisfies LearnCallbacks,
			)

			this.handleLearnResult(result)

			return result
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:learn:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	// ── Query (concrete — delegates to _queryMethod) ────────────────────────

	/**
	 * Query the learner's understanding
	 *
	 * Short-circuits with an empty result if the learner has no knowledge
	 * and no buffered observations. Otherwise delegates to the pluggable
	 * QueryMethod and does shared bookkeeping (metrics, events, signals).
	 */
	async query(question: string, options?: QueryOptions): Promise<QueryResult> {
		this.health.lastAccessed = new Date()
		this.metrics.query.count++

		this.emit('learner:query:started', {
			learnerId: this.id,
			query: question,
		})

		// Short-circuit if learner has no knowledge at all
		if (!this.hasKnowledge() && this.getBufferState().count === 0) {
			const emptyResult: QueryResult = {
				relevant: false,
				relevance: 0,
				confidence: 0,
				insight: '',
				gaps: '',
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			}
			this.emit('learner:query:completed', {
				learnerId: this.id,
				insight: '',
				relevant: false,
				relevance: 0,
				confidence: 0,
				gaps: [],
				usage: emptyResult.usage,
			})
			return emptyResult
		}

		try {
			const result = await this._queryMethod.query(
				{
					learnerId: this.id,
					instructions: this.instructions,
					question,
				},
				options,
				{
					onThinking: (thoughts, usage) => {
						this.emit('learner:query:thinking', {
							learnerId: this.id,
							thoughts,
							usage,
						})
					},
				} satisfies QueryCallbacks,
			)

			this.trackQueryMetrics(result)

			this.emit('learner:query:completed', {
				learnerId: this.id,
				insight: result.insight,
				relevant: result.relevant,
				relevance: result.relevance,
				confidence: result.confidence,
				gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
				usage: result.usage,
			})

			this.checkAndEmitSignals()

			return result
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:query:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	// ── Delegates to _learningMethod ────────────────────────────────────────

	isInitialized(): boolean {
		return (
			this._learningMethod.observePrompt !== null &&
			this._learningMethod.synthesizePrompt !== null
		)
	}

	getObserveSystemPrompt(): string | null {
		return this._learningMethod.observePrompt
	}

	getSynthesizeSystemPrompt(): string | null {
		return this._learningMethod.synthesizePrompt
	}

	getBufferState(): {
		count: number
		avgImportance: number
		totalTokens: number
	} {
		return this._learningMethod.getBufferState()
	}

	getBufferedObservations(): Array<{ text: string; importance: number }> {
		return this._learningMethod.getBufferedObservations()
	}

	// ── Accessors ───────────────────────────────────────────────────────────

	getEvolution(): EvolutionEntry[] {
		return [...this.evolution]
	}

	getHealth(): LearnerHealth {
		return { ...this.health }
	}

	getMetrics(): LearnerMetrics {
		return {
			ingestion: { ...this.metrics.ingestion },
			query: {
				...this.metrics.query,
				relevanceScores: [...this.metrics.query.relevanceScores],
				confidenceScores: [...this.metrics.query.confidenceScores],
				gaps: [...this.metrics.query.gaps],
			},
		}
	}

	getMetadata(): LearnerMetadata {
		return {
			id: this.id,
			instructions: this.instructions,
			origin: this.origin,
			health: this.getHealth(),
		}
	}

	getActivity(): LearnerActivity {
		return {
			ingestion: { ...this.metrics.ingestion },
			recentObservations: this._learningMethod.getBufferedObservations(),
		}
	}

	// ── Shared bookkeeping ──────────────────────────────────────────────────

	/**
	 * Handle learn result — shared bookkeeping for all learner types.
	 *
	 * The LearningMethod returns a fully processed result (understanding is
	 * already post-strategy/post-governance). BaseLearner just does metrics,
	 * evolution, events, and signal detection.
	 */
	protected handleLearnResult(result: LearnOutput): void {
		switch (result.status) {
			case 'observed': {
				this.trackIngestion()
				const bufferState = this._learningMethod.getBufferState()
				this.emit('learner:observed', {
					learnerId: this.id,
					output: result.output,
					importance: bufferState.avgImportance,
					bufferCount: bufferState.count,
					usage: result.usage,
				})
				this.checkAndEmitSignals()
				break
			}

			case 'observe:dismissed':
				this.trackIngestion(true)
				this.emit('learner:observe:dismissed', {
					learnerId: this.id,
					output: result.output,
					usage: result.usage,
				})
				this.checkAndEmitSignals()
				break

			case 'observe:error':
				this.emit('learner:observe:error', {
					learnerId: this.id,
					error: result.error,
				})
				break

			case 'synthesized': {
				this.trackIngestion()
				this.metrics.ingestion.synthesisCount++
				this.metrics.ingestion.observationsSinceLastSynthesis = 0
				this.stagnationSignalFired = false

				const previousUnderstanding = this.getUnderstanding()
				this.setUnderstanding(result.newUnderstanding as TUnderstanding)

				const evolutionEntry: EvolutionEntry = {
					summary: result.evolution,
					significance: result.significance,
					timestamp: new Date().toISOString(),
				}
				this.evolution.unshift(evolutionEntry)

				this.emit('learner:synthesized', {
					learnerId: this.id,
					newUnderstanding: result.newUnderstanding,
					previousUnderstanding,
					significance: result.significance,
					evolution: result.evolution,
					usage: result.usage,
				})

				this.updateGovernance(1.0)
				this.checkAndEmitSignals()
				break
			}

			case 'synthesize:dismissed':
				this.trackIngestion()
				this.emit('learner:synthesize:dismissed', {
					learnerId: this.id,
					output: result.output,
					usage: result.usage,
				})
				this.checkAndEmitSignals()
				break

			case 'synthesize:error':
				this.trackIngestion()
				this.emit('learner:synthesize:error', {
					learnerId: this.id,
					error: result.error,
				})
				this.checkAndEmitSignals()
				break
		}
	}

	protected trackIngestion(dismissed = false): void {
		this.metrics.ingestion.observationCount++
		this.metrics.ingestion.observationsSinceLastSynthesis++
		if (dismissed) {
			this.metrics.ingestion.dismissalCount++
		}
		this.metrics.ingestion.dismissalRate =
			this.metrics.ingestion.observationCount > 0
				? this.metrics.ingestion.dismissalCount /
					this.metrics.ingestion.observationCount
				: 0
	}

	protected trackQueryMetrics(result: { relevance: number; confidence: number; gaps: string }): void {
		const WINDOW_SIZE = 10
		const MAX_GAPS = 50

		this.metrics.query.relevanceScores.push(result.relevance)
		if (this.metrics.query.relevanceScores.length > WINDOW_SIZE) {
			this.metrics.query.relevanceScores.shift()
		}

		this.metrics.query.confidenceScores.push(result.confidence)
		if (this.metrics.query.confidenceScores.length > WINDOW_SIZE) {
			this.metrics.query.confidenceScores.shift()
		}

		if (result.gaps) {
			const gaps = result.gaps.split('\n').filter(Boolean)
			this.metrics.query.gaps.push(...gaps)
			if (this.metrics.query.gaps.length > MAX_GAPS) {
				this.metrics.query.gaps = this.metrics.query.gaps.slice(-MAX_GAPS)
			}
		}
	}

	protected updateGovernance(relevance: number): void {
		const previousStatus = this.health.status

		// EMA: weight recent relevance at 20%
		this.health.activation =
			this.health.activation * 0.8 + relevance * 0.2

		if (this.health.activation >= this.health.threshold) {
			this.health.status = 'active'
		}

		this.health.lastAccessed = new Date()

		this.emit('learner:health:updated', {
			learnerId: this.id,
			activation: this.health.activation,
			status: this.health.status,
			previousStatus:
				previousStatus !== this.health.status ? previousStatus : undefined,
		})
	}

	protected checkAndEmitSignals(): void {
		const { signalThresholds } = this.health
		const { ingestion, query } = this.metrics

		// Check dismissal rate — fire once, reset when rate drops below threshold
		if (ingestion.observationCount > 10) {
			if (ingestion.dismissalRate > signalThresholds.maxDismissalRate) {
				if (!this.dismissalSignalFired) {
					this.dismissalSignalFired = true
					this.emit('learner:signal', {
						learnerId: this.id,
						description: `High dismissal rate: rejecting ${(ingestion.dismissalRate * 100).toFixed(0)}% of observations`,
						timestamp: new Date(),
						metrics: { dismissalRate: ingestion.dismissalRate },
					})
				}
			} else {
				this.dismissalSignalFired = false
			}
		}

		// Check relevance floor
		if (query.relevanceScores.length >= 5) {
			const avgRelevance =
				query.relevanceScores.reduce((a, b) => a + b, 0) /
				query.relevanceScores.length
			if (avgRelevance < signalThresholds.minRelevance) {
				this.emit('learner:signal', {
					learnerId: this.id,
					description: `Low relevance: avg ${avgRelevance.toFixed(2)} over last ${query.relevanceScores.length} queries`,
					timestamp: new Date(),
					metrics: { avgRelevance },
				})
				this.metrics.query.relevanceScores = []
			}
		}

		// Check confidence floor
		if (query.confidenceScores.length >= 5) {
			const avgConfidence =
				query.confidenceScores.reduce((a, b) => a + b, 0) /
				query.confidenceScores.length
			if (avgConfidence < signalThresholds.minConfidence) {
				this.emit('learner:signal', {
					learnerId: this.id,
					description: `Low confidence: avg ${avgConfidence.toFixed(2)} over last ${query.confidenceScores.length} queries — has knowledge gaps in its domain`,
					timestamp: new Date(),
					metrics: { avgConfidence },
				})
				this.metrics.query.confidenceScores = []
			}
		}

		// Check synthesis gap (stagnation) — fire once, reset on synthesis
		if (
			!this.stagnationSignalFired &&
			ingestion.observationsSinceLastSynthesis >
				signalThresholds.maxObservationsWithoutSynthesis
		) {
			this.stagnationSignalFired = true
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `Stagnation: no synthesis in ${ingestion.observationsSinceLastSynthesis} observations`,
				timestamp: new Date(),
			})
		}
	}
}
