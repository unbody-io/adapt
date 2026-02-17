import type { ParentModels } from '../../types/config'
import { TypedEmitter } from '../../types/events'
import type {
	EvolutionEntry,
	Learner,
	LearnerGovernance,
	LearnerMetadata,
	LearnerMetrics,
} from '../types'
import { resolveTextLearnerConfig } from './config.resolver'
import { type LearnOptions, TwoPhaseMethod } from './learning-methods'
import {
	createQueryMethod,
	type QueryMethod,
	type QueryOptions,
	type QueryResult,
} from './query-methods'
import { applyStrategy } from './strategies'
import type {
	LearnOutput,
	QueryMethodName,
	ResolvedTextLearnerConfig,
	TextLearnerConfig,
	TextLearnerEventMap,
	TextLearnerUpdateResult,
} from './types'
import type { TwoPhaseUpdateConfig } from './learning-methods'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * Uses two-phase learning: Observe → Buffer → Synthesize
 * This reduces understanding degradation by only rewriting during synthesis.
 *
 * Extends TypedEmitter to provide event-based observability.
 */
export class TextLearner
	extends TypedEmitter<TextLearnerEventMap>
	implements Learner<string>
{
	readonly id: string
	name!: string
	instructions!: string
	description?: string

	private config: ResolvedTextLearnerConfig
	private understanding = ''
	private evolution: EvolutionEntry[] = []
	private governance: LearnerGovernance
	private _learningMethod: TwoPhaseMethod
	private _queryMethod: QueryMethod

	// Runtime metrics (Living Brain)
	private metrics: LearnerMetrics = {
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

	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		super()
		this.config = resolveTextLearnerConfig(rawConfig, parentModels)
		this.id = this.config.id
		this.name = rawConfig.name || this.config.id
		this.instructions = this.config.instructions
		this.description = rawConfig.description

		// Create two-phase learning method with resolved config
		this._learningMethod = new TwoPhaseMethod(this.config.model, {
			observe: {
				method: this.config.observe.method,
				model: this.config.observe.model,
				blueprintModel: this.config.observe.blueprintModel,
			},
			synthesize: {
				method: this.config.synthesize.method,
				model: this.config.synthesize.model,
				blueprintModel: this.config.synthesize.blueprintModel,
				thresholds: this.config.synthesize.thresholds,
			},
			strategy: this.config.maintenance.strategy,
		})

		this._queryMethod = createQueryMethod(
			this.config.query.method,
			this.config.query.model,
		)

		this.governance = {
			activation: 0,
			threshold: 0.3,
			status: 'dormant',
			lastAccessed: new Date(),
			signalThresholds: {
				maxDismissalRate: 0.8,
				minRelevance: 0.3,
				minConfidence: 0.3,
				maxObservationsWithoutSynthesis:
					3 * (this.config.synthesize.thresholds.maxObservations ?? 10),
				minGapCount: 10,
				...rawConfig.governance?.signalThresholds,
			},
		}
	}

	/**
	 * Get the learner's origin
	 */
	get origin() {
		return this.config.origin
	}

	/**
	 * Initialize the learner
	 *
	 * Generates system prompts for both observe and synthesize phases.
	 * Delegates to update() internally — prompts are generated because
	 * they are null on first call.
	 *
	 * This must be called before learn() or query().
	 */
	async init(): Promise<{
		observeSystemPrompt: string
		synthesizeSystemPrompt: string
	}> {
		// Already initialized — return existing prompts
		if (
			this._learningMethod.observePrompt &&
			this._learningMethod.synthesizePrompt
		) {
			return {
				observeSystemPrompt: this._learningMethod.observePrompt,
				synthesizeSystemPrompt: this._learningMethod.synthesizePrompt,
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			// Delegate to update — prompts are null so TwoPhaseMethod
			// will force regeneration even though instructions haven't "changed"
			await this.update({ instructions: this.instructions })

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this._learningMethod.observePrompt!, // For backwards compat
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

	/**
	 * Check if the learner has been initialized
	 */
	isInitialized(): boolean {
		return (
			this._learningMethod.observePrompt !== null &&
			this._learningMethod.synthesizePrompt !== null
		)
	}

	/**
	 * Get the observe system prompt (null if not initialized)
	 */
	getObserveSystemPrompt(): string | null {
		return this._learningMethod.observePrompt
	}

	/**
	 * Get the synthesize system prompt (null if not initialized)
	 */
	getSynthesizeSystemPrompt(): string | null {
		return this._learningMethod.synthesizePrompt
	}

	/**
	 * Get the observe identity (null if not initialized)
	 */
	getObserveIdentity() {
		return this._learningMethod.observeIdentity
	}

	/**
	 * Get the synthesize identity (null if not initialized)
	 */
	getSynthesizeIdentity() {
		return this._learningMethod.synthesizeIdentity
	}

	/**
	 * Get the current understanding (narrative text)
	 */
	getUnderstanding(): string {
		return this.understanding
	}

	/**
	 * Set understanding directly (used by evolution system)
	 *
	 * This bypasses normal learning flow and directly sets the understanding text.
	 * Primarily used by merge/split handlers to transfer understanding between learners.
	 */
	setUnderstanding(understanding: string): void {
		this.understanding = understanding

		this.emit('learner:understanding:set', {
			learnerId: this.id,
			understanding,
		})
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
	getMaintenance() {
		return { ...this.config.maintenance }
	}

	/**
	 * Get a copy of the governance state
	 */
	getGovernance(): LearnerGovernance {
		return { ...this.governance }
	}

	/**
	 * Get a copy of runtime metrics
	 */
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

	/**
	 * Get the current query method name
	 */
	getQueryMethodName(): QueryMethodName {
		return this.config.query.method
	}

	/**
	 * Get current buffer state (for debugging/observability)
	 */
	getBufferState(): {
		count: number
		avgImportance: number
		totalTokens: number
	} {
		return this._learningMethod.getBufferState()
	}

	/**
	 * Get all buffered observations (for debugging/observability)
	 */
	getBufferedObservations(): Array<{ text: string; importance: number }> {
		return this._learningMethod.getBufferedObservations()
	}

	/**
	 * Get synthesis thresholds (used by evolution system)
	 */
	getSynthesizeThresholds() {
		return { ...this.config.synthesize.thresholds }
	}

	/**
	 * Update learner configuration
	 *
	 * Accepts the same shape as the constructor config (but partial).
	 * Any config field can be updated. Only `id` is truly immutable.
	 *
	 * Raw constants (models, thresholds) are stored immediately.
	 * Derived values (prompts/identity) are re-generated when their
	 * inputs change (instructions, blueprintModel, strategy).
	 *
	 * @param updates - Partial config updates (same shape as TextLearnerConfig)
	 * @returns Changed fields and full resolved config
	 * @throws Error if attempting to modify `id`
	 */
	async update(updates: Partial<TextLearnerConfig>): Promise<TextLearnerUpdateResult> {
		// Only id is truly immutable
		if (updates.id !== undefined && updates.id !== this.id) {
			throw new Error(
				'Cannot update immutable field "id". Learner identity cannot be changed.',
			)
		}

		const changedFields: string[] = []
		const twoPhaseUpdate: TwoPhaseUpdateConfig = {}
		let queryModelChanged = false
		let queryMethodChanged = false

		// ── Metadata fields (no downstream effects) ──

		if (updates.name !== undefined && updates.name !== this.name) {
			this.name = updates.name
			changedFields.push('name')
		}

		if (updates.description !== undefined && updates.description !== this.description) {
			this.description = updates.description
			changedFields.push('description')
		}

		if (updates.origin !== undefined && updates.origin !== this.config.origin) {
			this.config.origin = updates.origin
			changedFields.push('origin')
		}

		// ── Model changes ──

		if (updates.model !== undefined) {
			this.config.model = updates.model
			changedFields.push('model')
			twoPhaseUpdate.model = updates.model
		}

		if (updates.blueprintModel !== undefined) {
			this.config.blueprintModel = updates.blueprintModel
			changedFields.push('blueprintModel')
			// Cascade to observe/synthesize blueprintModel unless explicitly overridden
			if (!updates.observe?.blueprintModel) {
				twoPhaseUpdate.observe = twoPhaseUpdate.observe || {}
				twoPhaseUpdate.observe.blueprintModel = updates.blueprintModel
			}
			if (!updates.synthesize?.blueprintModel) {
				twoPhaseUpdate.synthesize = twoPhaseUpdate.synthesize || {}
				twoPhaseUpdate.synthesize.blueprintModel = updates.blueprintModel
			}
		}

		// ── Instructions ──

		if (updates.instructions !== undefined) {
			this.instructions = updates.instructions
			this.config.instructions = updates.instructions
			changedFields.push('instructions')
			twoPhaseUpdate.instructions = updates.instructions
		}

		// ── Observe config ──

		if (updates.observe) {
			if (updates.observe.model !== undefined) {
				this.config.observe.model = updates.observe.model
				changedFields.push('observe.model')
				twoPhaseUpdate.observe = twoPhaseUpdate.observe || {}
				twoPhaseUpdate.observe.model = updates.observe.model
			}
			if (updates.observe.blueprintModel !== undefined) {
				this.config.observe.blueprintModel = updates.observe.blueprintModel
				changedFields.push('observe.blueprintModel')
				twoPhaseUpdate.observe = twoPhaseUpdate.observe || {}
				twoPhaseUpdate.observe.blueprintModel = updates.observe.blueprintModel
			}
		}

		// ── Synthesize config ──

		if (updates.synthesize) {
			if (updates.synthesize.model !== undefined) {
				this.config.synthesize.model = updates.synthesize.model
				changedFields.push('synthesize.model')
				twoPhaseUpdate.synthesize = twoPhaseUpdate.synthesize || {}
				twoPhaseUpdate.synthesize.model = updates.synthesize.model
			}
			if (updates.synthesize.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel = updates.synthesize.blueprintModel
				changedFields.push('synthesize.blueprintModel')
				twoPhaseUpdate.synthesize = twoPhaseUpdate.synthesize || {}
				twoPhaseUpdate.synthesize.blueprintModel = updates.synthesize.blueprintModel
			}
			if (updates.synthesize.thresholds) {
				const t = updates.synthesize.thresholds
				if (t.minImportance !== undefined) {
					this.config.synthesize.thresholds.minImportance = t.minImportance
					changedFields.push('synthesize.thresholds.minImportance')
				}
				if (t.maxObservations !== undefined) {
					this.config.synthesize.thresholds.maxObservations = t.maxObservations
					changedFields.push('synthesize.thresholds.maxObservations')
				}
				if (t.maxTokens !== undefined) {
					this.config.synthesize.thresholds.maxTokens = t.maxTokens
					changedFields.push('synthesize.thresholds.maxTokens')
				}
				twoPhaseUpdate.synthesize = twoPhaseUpdate.synthesize || {}
				twoPhaseUpdate.synthesize.thresholds = updates.synthesize.thresholds
			}
		}

		// ── Maintenance / strategy ──

		if (updates.maintenance?.strategy !== undefined && updates.maintenance.strategy !== this.config.maintenance.strategy) {
			this.config.maintenance.strategy = updates.maintenance.strategy
			changedFields.push('maintenance.strategy')
			twoPhaseUpdate.strategy = updates.maintenance.strategy
		}
		if (updates.maintenance?.maxTokens !== undefined && updates.maintenance.maxTokens !== this.config.maintenance.maxTokens) {
			this.config.maintenance.maxTokens = updates.maintenance.maxTokens
			changedFields.push('maintenance.maxTokens')
		}

		// ── Query config ──

		if (updates.query) {
			if (updates.query.model !== undefined) {
				this.config.query.model = updates.query.model
				changedFields.push('query.model')
				queryModelChanged = true
			}
			if (updates.query.method !== undefined && updates.query.method !== this.config.query.method) {
				this.config.query.method = updates.query.method
				changedFields.push('query.method')
				queryMethodChanged = true
			}
		}

		// ── Governance config (signal thresholds only — metrics are state) ──

		if (updates.governance) {
			if (updates.governance.threshold !== undefined) {
				this.governance.threshold = updates.governance.threshold
				changedFields.push('governance.threshold')
			}
			if (updates.governance.signalThresholds) {
				const st = updates.governance.signalThresholds
				if (st.maxDismissalRate !== undefined) {
					this.governance.signalThresholds.maxDismissalRate = st.maxDismissalRate
					changedFields.push('governance.signalThresholds.maxDismissalRate')
				}
				if (st.minConfidence !== undefined) {
					this.governance.signalThresholds.minConfidence = st.minConfidence
					changedFields.push('governance.signalThresholds.minConfidence')
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.governance.signalThresholds.maxObservationsWithoutSynthesis = st.maxObservationsWithoutSynthesis
					changedFields.push('governance.signalThresholds.maxObservationsWithoutSynthesis')
				}
			}
		}

		// ── Delegate to sub-components ──

		let promptsRegenerated = false

		if (Object.keys(twoPhaseUpdate).length > 0) {
			const result = await this._learningMethod.update(twoPhaseUpdate)
			promptsRegenerated = result.promptsRegenerated

			if (promptsRegenerated) {
				this.emit('learner:prompts:regenerated', {
					learnerId: this.id,
					observePrompt: this._learningMethod.observePrompt!,
					synthesizePrompt: this._learningMethod.synthesizePrompt!,
				})
			}
		}

		if (queryMethodChanged) {
			this._queryMethod = createQueryMethod(
				this.config.query.method,
				this.config.query.model,
			)
		} else if (queryModelChanged) {
			this._queryMethod.update({ 
				model: this.config.query.model 
			})
		}

		// ── Emit event ──

		if (changedFields.length > 0) {
			this.emit('learner:config:updated', {
				learnerId: this.id,
				changedFields,
				config: { ...this.config },
			})
		}

		return {
			changedFields,
			config: { ...this.config },
		}
	}

	/**
	 * Learn from a batch of data using two-phase learning
	 *
	 * Phase 1 (Observe): Extract relevant observations from data
	 * Phase 2 (Synthesize): Update understanding when thresholds met
	 *
	 * @param batch - Array of data items to learn from
	 * @param options - Learn options (forceSynthesize, etc.)
	 * @returns LearnOutput discriminated union
	 */
	async learn(batch: unknown[], options?: LearnOptions): Promise<LearnOutput> {
		if (!this.isInitialized()) {
			throw new Error('Learner not initialized. Call init() first.')
		}

		try {
			const result = await this._learningMethod.learn(
				this.id,
				this.instructions,
				this.understanding,
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
				},
			)

			// Emit events and update state based on result status
			await this.handleLearnResult(result)

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

	/**
	 * Handle learn result - emit events and update state
	 */
	private async handleLearnResult(result: LearnOutput): Promise<void> {
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
				// Check signals after observation
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
				// Check signals after dismissal
				this.checkAndEmitSignals()
				break

			case 'observe:error':
				this.emit('learner:observe:error', {
					learnerId: this.id,
					error: result.error,
				})
				break

			case 'synthesized': {
				// The observation was made (it triggered synthesis), so count it
				this.trackIngestion()
				this.metrics.ingestion.synthesisCount++
				this.metrics.ingestion.observationsSinceLastSynthesis = 0
				const previousUnderstanding = this.understanding

				// Apply strategy-specific maintenance
				const strategyResult = await applyStrategy({
					understanding: result.newUnderstanding,
					model: this.config.model,
					config: this.config.maintenance,
				})
				this.understanding = strategyResult.understanding

				// Create evolution entry
				const evolutionEntry: EvolutionEntry = {
					summary: result.evolution,
					significance: result.significance,
					timestamp: new Date().toISOString(),
				}
				this.evolution.unshift(evolutionEntry)

				// Emit synthesized event
				this.emit('learner:synthesized', {
					learnerId: this.id,
					newUnderstanding: this.understanding,
					previousUnderstanding,
					significance: result.significance,
					evolution: result.evolution,
					usage: result.usage,
				})

				// Update governance (use 1.0 as relevance since it was synthesized)
				this.updateGovernance(1.0)
				// Check signals after observation+synthesis
				this.checkAndEmitSignals()
				break
			}

			case 'synthesize:dismissed':
				// The observation was made (it triggered synthesis attempt), so count it
				this.trackIngestion()
				this.emit('learner:synthesize:dismissed', {
					learnerId: this.id,
					output: result.output,
					usage: result.usage,
				})
				this.checkAndEmitSignals()
				break

			case 'synthesize:error':
				// The observation was made but synthesis failed — still count it
				this.trackIngestion()
				this.emit('learner:synthesize:error', {
					learnerId: this.id,
					error: result.error,
				})
				this.checkAndEmitSignals()
				break
		}
	}

	/**
	 * Query against understanding using the configured query method
	 *
	 * @param question - The question or query to answer
	 * @param options - Optional generation options (temperature, etc.)
	 * @returns QueryResult with insight, confidence, and gaps
	 */
	async query(question: string, options?: QueryOptions): Promise<QueryResult> {
		this.governance.lastAccessed = new Date()
		this.metrics.query.count++

		this.emit('learner:query:started', {
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
				options,
				{
					onThinking: (thoughts, usage) => {
						this.emit('learner:query:thinking', {
							learnerId: this.id,
							thoughts,
							usage,
						})
					},
				},
			)

			// Track query metrics for signal detection
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

			// Check signals after query
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
	 * Track an ingestion event (observation received)
	 */
	private trackIngestion(dismissed = false): void {
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

	/**
	 * Track query metrics (relevance, confidence, gaps)
	 */
	private trackQueryMetrics(result: QueryResult): void {
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

	/**
	 * Check signal thresholds and emit signals if crossed (Living Brain)
	 */
	private checkAndEmitSignals(): void {
		const { signalThresholds } = this.governance
		const { ingestion, query } = this.metrics

		// Check dismissal rate
		if (ingestion.observationCount > 10) {
			if (ingestion.dismissalRate > signalThresholds.maxDismissalRate) {
				this.emit('learner:signal', {
					learnerId: this.id,
					description: `High dismissal rate: rejecting ${(ingestion.dismissalRate * 100).toFixed(0)}% of observations`,
					timestamp: new Date(),
					metrics: { dismissalRate: ingestion.dismissalRate },
				})
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

		// Check synthesis gap (stagnation)
		if (
			ingestion.observationsSinceLastSynthesis >
			signalThresholds.maxObservationsWithoutSynthesis
		) {
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `Stagnation: no synthesis in ${ingestion.observationsSinceLastSynthesis} observations`,
				timestamp: new Date(),
			})
		}

		// Check gap accumulation
		if (query.gaps.length >= signalThresholds.minGapCount) {
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `Knowledge gaps accumulating: ${query.gaps.length} gaps recorded. Recent: ${query.gaps.slice(-5).join('; ')}`,
				timestamp: new Date(),
				metrics: { gapCount: query.gaps.length },
			})
			this.metrics.query.gaps = []
		}
	}
}
