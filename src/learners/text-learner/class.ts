import type { ParentModels } from '../../types/config'
import { TypedEmitter } from '../../types/events'
import type {
	EvolutionEntry,
	Learner,
	LearnerGovernance,
	LearnerMetadata,
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
} from './types'

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

	// Signal tracking state (Living Brain)
	private dismissalCount = 0
	private observationCount = 0
	private queryConfidences: number[] = []
	private lastSynthesisObservationCount = 0

	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		super()
		this.config = resolveTextLearnerConfig(rawConfig, parentModels)
		this.id = this.config.id
		this.name = (rawConfig as any).name || this.config.id // Use name from config if available
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
			retrievalCount: 0,
			successRate: 0,
			signalThresholds: {
				maxDismissalRate: 0.8,
				minConfidence: 0.3,
				bufferOverflowMultiplier: 1.5,
				maxObservationsWithoutSynthesis: 100,
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
	 * This must be called before learn() or query().
	 */
	async init(): Promise<{
		observeSystemPrompt: string
		synthesizeSystemPrompt: string
	}> {
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
			const result = await this._learningMethod.init(this.instructions)

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: result.observeSystemPrompt, // For backwards compat
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
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
	 * Update learner configuration (used by evolution system)
	 *
	 * Accepts partial config updates and applies them with validation:
	 * - Immutable fields (id, origin, type, model, blueprintModel) cannot be changed
	 * - Instructions changes trigger prompt regeneration
	 * - Emits events for updates and prompt regeneration
	 *
	 * @param updates - Partial config updates
	 * @throws Error if attempting to modify immutable fields
	 */
	async update(updates: {
		name?: string
		description?: string
		instructions?: string
		thresholds?: {
			minImportance?: number
			maxObservations?: number
		}
	}): Promise<void> {
		// Validate that no immutable fields are being changed
		this.validateImmutability(updates)

		// Track what changed for event emission
		const appliedUpdates: typeof updates = {}

		// Apply mutable field updates
		if (updates.name !== undefined && updates.name !== this.name) {
			this.name = updates.name
			appliedUpdates.name = updates.name
		}

		if (
			updates.description !== undefined &&
			updates.description !== this.description
		) {
			this.description = updates.description
			appliedUpdates.description = updates.description
		}

		// Instructions update requires prompt regeneration
		if (
			updates.instructions !== undefined &&
			updates.instructions !== this.instructions
		) {
			this.instructions = updates.instructions
			appliedUpdates.instructions = updates.instructions

			// Regenerate prompts with new instructions
			const result = await this._learningMethod.init(updates.instructions)

			this.emit('learner:prompts:regenerated', {
				learnerId: this.id,
				observePrompt: result.observeSystemPrompt,
				synthesizePrompt: result.synthesizeSystemPrompt,
			})
		}

		// Threshold updates
		if (updates.thresholds) {
			const currentThresholds = this.config.synthesize.thresholds

			// Only update if something actually changed
			if (
				updates.thresholds.minImportance !== undefined &&
				updates.thresholds.minImportance !== currentThresholds.minImportance
			) {
				this.config.synthesize.thresholds.minImportance =
					updates.thresholds.minImportance
				appliedUpdates.thresholds = appliedUpdates.thresholds || {}
				appliedUpdates.thresholds.minImportance =
					updates.thresholds.minImportance
			}

			if (
				updates.thresholds.maxObservations !== undefined &&
				updates.thresholds.maxObservations !== currentThresholds.maxObservations
			) {
				this.config.synthesize.thresholds.maxObservations =
					updates.thresholds.maxObservations
				appliedUpdates.thresholds = appliedUpdates.thresholds || {}
				appliedUpdates.thresholds.maxObservations =
					updates.thresholds.maxObservations
			}
		}

		// Emit config updated event if any changes were made
		if (Object.keys(appliedUpdates).length > 0) {
			this.emit('learner:config:updated', {
				learnerId: this.id,
				updates: appliedUpdates,
			})
		}
	}

	/**
	 * Validate that no immutable fields are being changed
	 *
	 * @throws Error if attempting to modify immutable fields
	 */
	private validateImmutability(updates: any): void {
		const IMMUTABLE_FIELDS = ['id', 'origin', 'type', 'model', 'blueprintModel']

		for (const field of IMMUTABLE_FIELDS) {
			if (updates[field] !== undefined) {
				throw new Error(
					`Cannot update immutable field "${field}". Learner identity and core configuration cannot be changed.`,
				)
			}
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
				this.observationCount++
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
				this.observationCount++
				this.dismissalCount++
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
				this.lastSynthesisObservationCount = this.observationCount
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
				break
			}

			case 'synthesize:dismissed':
				this.emit('learner:synthesize:dismissed', {
					learnerId: this.id,
					output: result.output,
					usage: result.usage,
				})
				break

			case 'synthesize:error':
				this.emit('learner:synthesize:error', {
					learnerId: this.id,
					error: result.error,
				})
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
				options,
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

			// Track confidence for signal detection
			this.queryConfidences.push(result.confidence)
			// Keep only last 10 confidences
			if (this.queryConfidences.length > 10) {
				this.queryConfidences.shift()
			}

			this.emit('learner:ask:completed', {
				learnerId: this.id,
				insight: result.insight,
				confidence: result.confidence,
				gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
				usage: result.usage,
			})

			// Check signals after query
			this.checkAndEmitSignals()

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

	/**
	 * Check signal thresholds and emit signals if crossed (Living Brain)
	 */
	private checkAndEmitSignals(): void {
		// Check dismissal rate
		if (this.observationCount > 10) {
			const dismissalRate = this.dismissalCount / this.observationCount
			if (dismissalRate > this.governance.signalThresholds.maxDismissalRate) {
				this.emit('learner:signal', {
					learnerId: this.id,
					description: `I'm dismissing ${(dismissalRate * 100).toFixed(1)}% of observations`,
					timestamp: new Date(),
					metrics: { dismissalRate },
				})
			}
		}

		// Check confidence floor
		if (this.queryConfidences.length >= 5) {
			const avg =
				this.queryConfidences.reduce((a, b) => a + b, 0) /
				this.queryConfidences.length
			if (avg < this.governance.signalThresholds.minConfidence) {
				this.emit('learner:signal', {
					learnerId: this.id,
					description: `My query confidence is consistently low (${avg.toFixed(2)})`,
					timestamp: new Date(),
					metrics: { avgConfidence: avg },
				})
				this.queryConfidences = [] // Reset after signaling
			}
		}

		// Check buffer overflow
		const bufferState = this._learningMethod.getBufferState()
		const threshold =
			this.config.synthesize.thresholds.maxObservations *
			this.governance.signalThresholds.bufferOverflowMultiplier
		if (bufferState.count > threshold) {
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `My buffer is consistently overflowing (${bufferState.count} observations)`,
				timestamp: new Date(),
				metrics: { bufferCount: bufferState.count },
			})
		}

		// Check synthesis gap
		const observationsSinceLastSynthesis =
			this.observationCount - this.lastSynthesisObservationCount
		if (
			observationsSinceLastSynthesis >
			this.governance.signalThresholds.maxObservationsWithoutSynthesis
		) {
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `No synthesis in ${observationsSinceLastSynthesis} observations`,
				timestamp: new Date(),
			})
		}
	}
}
