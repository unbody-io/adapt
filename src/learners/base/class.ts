/**
 * BaseLearner — abstract base class for all learner types
 *
 * Owns the full pipeline: observe → store → understand → governance.
 * Store is injected — learner has no knowledge of storage backend.
 *
 * Subclasses implement type-specific behavior:
 * - regenObservePrompt, regenUnderstandPrompt (identity/prompt generation)
 * - callUnderstand, postProcessUnderstanding (understand phase)
 * - getUnderstanding, setUnderstanding, getSummary, hasKnowledge
 * - createQueryMethod, applyTypeSpecificUpdates
 */

import type { LanguageModel } from 'ai'
import { nanoid } from 'nanoid'
import { TypedEmitter } from '../../types/events'
import type { LearnerActivity } from '../../brain/evaluator/types'
import type {
	Learner,
	LearnerHealth,
	LearnerMetadata,
	LearnerMetrics,
	LearnerOrigin,
	Significance,
} from '../types'
import { initObserve, observe } from '../observer'
import type { ObserveIdentity } from '../observer'
import type { EvolutionRecord, Store } from '../stores'
import type { QueryCallbacks, QueryMethod, QueryOptions, QueryResult } from '../base/query'
import type {
	BaseResolvedConfig,
	BaseLearnerUpdateInput,
	SharedLearnerEventMap,
	UnderstandThresholds,
} from './types'

/**
 * Output from learn() - discriminated union of all possible outcomes
 */
export type LearnOutput =
	| { status: 'observed'; output: string[]; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
	| { status: 'observe:dismissed'; output: string[]; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
	| { status: 'observe:error'; error: unknown }
	| {
			status: 'synthesized'
			newUnderstanding: unknown
			significance: Significance
			evolution: string
			reasoning?: string
			usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
	  }
	| { status: 'synthesize:dismissed'; output: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
	| { status: 'synthesize:error'; error: unknown }

/**
 * Options for learn() call
 */
export interface LearnOptions {
	forceSynthesize?: boolean
}

/**
 * Callbacks for learning observability
 */
export interface LearnCallbacks {
	onObserveStarted?: (itemCount: number) => void
	onObserveThinking?: (thoughts: string[]) => void
	onSynthesizeStarted?: (observationCount: number) => void
	onSynthesizeThinking?: (thoughts: string[]) => void
}

/**
 * Result from callUnderstand — subclass-specific
 */
export type UnderstandCallResult =
	| {
			status: 'synthesized'
			newUnderstanding: unknown
			significance: Significance
			evolution: string
			reasoning?: string
			usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
	  }
	| { status: 'dismissed'; output: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
	| { status: 'error'; error: unknown }

/**
 * Configuration for BaseLearner constructor
 */
export interface BaseLearnerInit {
	id: string
	name: string
	instructions: string
	origin: LearnerOrigin
	store: Store
	focus?: string
	description?: string
	health?: Partial<LearnerHealth>
	maxObservationsForStagnation?: number
}

export abstract class BaseLearner<
	TUnderstanding,
	TConfig extends BaseResolvedConfig = BaseResolvedConfig,
>
	extends TypedEmitter<SharedLearnerEventMap>
	implements Learner<TUnderstanding>
{
	readonly id: string
	name: string
	instructions: string
	focus?: string
	description?: string

	protected _origin: LearnerOrigin
	protected store: Store
	protected _queryMethod!: QueryMethod
	protected config!: TConfig
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

	// Observer state
	protected _observeIdentity: ObserveIdentity | null = null
	protected observeSystemPrompt: string | null = null
	protected understandSystemPrompt: string | null = null

	// Signal fire-once flags (reset when condition clears)
	protected stagnationSignalFired = false
	protected dismissalSignalFired = false

	constructor(init: BaseLearnerInit) {
		super()
		this.id = init.id
		this.name = init.name
		this.instructions = init.instructions
		this._origin = init.origin
		this.store = init.store
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
	abstract setUnderstanding(value: TUnderstanding): Promise<void>
	abstract getSummary(): string
	abstract hasKnowledge(): boolean

	/**
	 * Restore understanding from store into local cache (called during init).
	 */
	protected abstract restoreUnderstandingFromStore(): Promise<void>

	/**
	 * Hook for type-specific config updates (e.g. governance).
	 */
	protected abstract applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): void

	/**
	 * Regenerate understand prompt (type-specific — text uses strategy, list uses identity)
	 */
	protected abstract regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void>

	/**
	 * Execute the understand phase (type-specific)
	 */
	protected abstract callUnderstand(
		model: LanguageModel,
		understanding: TUnderstanding,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult>

	/**
	 * Transform raw understand output (e.g. apply strategy, dedup, pruning)
	 */
	protected abstract postProcessUnderstanding(
		raw: TUnderstanding,
	): TUnderstanding | Promise<TUnderstanding>

	/**
	 * Create the query method for this learner type
	 */
	protected abstract createQueryMethod(): QueryMethod

	// ── Init ────────────────────────────────────────────────────────────────

	async init(): Promise<{
		observeSystemPrompt: string
		understandSystemPrompt: string
	}> {
		if (this.isInitialized()) {
			return {
				observeSystemPrompt: this.observeSystemPrompt!,
				understandSystemPrompt: this.understandSystemPrompt!,
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			// Try restoring identities/prompts from store.state (skip LLM calls)
			const restored = await this.restoreStateFromStore()

			if (!restored) {
				// Generate observe identity + prompt via LLM
				const observeBlueprintModel =
					this.config.observer.blueprintModel ?? this.config.model
				const observeResult = await initObserve(
					observeBlueprintModel,
					this.instructions,
					this.focus || undefined,
				)
				this._observeIdentity = observeResult.identity
				this.observeSystemPrompt = observeResult.systemPrompt

				// Generate understand identity + prompt (type-specific)
				const understandBlueprintModel =
					this.config.understand.blueprintModel ?? this.config.model
				await this.regenUnderstandPrompt(
					understandBlueprintModel,
					this.instructions,
				)

				// Persist to store.state for future inits
				await this.saveStateToStore()
			}

			// Restore understanding from store (for persistent adapters)
			await this.restoreUnderstandingFromStore()

			// Create query method
			this._queryMethod = this.createQueryMethod()

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this.observeSystemPrompt!,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			})

			return {
				observeSystemPrompt: this.observeSystemPrompt!,
				understandSystemPrompt: this.understandSystemPrompt ?? '',
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

	// ── State persistence (identities + prompts in store.state) ───────────

	/**
	 * Save identities and prompts to store.state.
	 * Subclasses override to add type-specific state (e.g. understand identity).
	 */
	protected async saveStateToStore(): Promise<void> {
		const now = new Date().toISOString()
		const entries: Array<{ id: string; value: unknown }> = [
			{ id: 'observe_identity', value: this._observeIdentity },
			{ id: 'observe_prompt', value: this.observeSystemPrompt },
			{ id: 'understand_prompt', value: this.understandSystemPrompt },
		]

		for (const entry of entries) {
			const existing = await this.store.state.get(entry.id)
			if (existing) {
				await this.store.state.update(entry.id, { value: entry.value, updatedAt: now })
			} else {
				await this.store.state.add({ id: entry.id, value: entry.value, updatedAt: now })
			}
		}
	}

	/**
	 * Restore identities and prompts from store.state.
	 * Returns true if all required state was found, false otherwise.
	 * Subclasses override to restore type-specific state.
	 */
	protected async restoreStateFromStore(): Promise<boolean> {
		const [observeIdentity, observePrompt, understandPrompt] = await Promise.all([
			this.store.state.get('observe_identity'),
			this.store.state.get('observe_prompt'),
			this.store.state.get('understand_prompt'),
		])

		if (!observeIdentity || !observePrompt || !understandPrompt) {
			return false
		}

		this._observeIdentity = observeIdentity.value as ObserveIdentity
		this.observeSystemPrompt = observePrompt.value as string
		this.understandSystemPrompt = understandPrompt.value as string
		return true
	}

	// ── Identity ────────────────────────────────────────────────────────────

	get origin(): LearnerOrigin {
		return this._origin
	}

	isInitialized(): boolean {
		return this.observeSystemPrompt !== null
	}

	getObserveSystemPrompt(): string | null {
		return this.observeSystemPrompt
	}

	getUnderstandSystemPrompt(): string | null {
		return this.understandSystemPrompt
	}

	getUnderstandThresholds() {
		return { ...this.config.understand.thresholds }
	}

	// ── Learn (pipeline: observe → store → understand) ────────────────────

	async learn(batch: unknown[], options?: LearnOptions): Promise<LearnOutput> {
		if (!this.isInitialized()) {
			throw new Error('Learner not initialized. Call init() first.')
		}

		try {
			const observeModel = this.config.observer.model ?? this.config.model
			const understandModel = this.config.understand.model ?? this.config.model

			// Handle forceSynthesize with empty data
			if (options?.forceSynthesize && batch.length === 0) {
				const pendingCount = await this.store.observations.count({ metadata_status: 'pending' })
				if (pendingCount > 0) {
					return this.understandFromStore(understandModel)
				}
			}

			// Phase 1: Observe
			this.emit('learner:observe:started', {
				learnerId: this.id,
				itemCount: batch.length,
			})

			const observeResult = await observe(
				observeModel,
				this.observeSystemPrompt!,
				{ learnerId: this.id, instructions: this.instructions, data: batch },
				{
					onThinking: (thoughts) => {
						this.emit('learner:observe:thinking', {
							learnerId: this.id,
							thoughts,
							usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
						})
					},
				},
			)

			if (observeResult.status === 'error') {
				const result: LearnOutput = { status: 'observe:error', error: observeResult.error }
				await this.handleLearnResult(result)
				return result
			}

			if (observeResult.status === 'dismissed') {
				const result: LearnOutput = {
					status: 'observe:dismissed',
					output: observeResult.output,
					usage: observeResult.usage,
				}
				await this.handleLearnResult(result)
				return result
			}

			// Filter by importance threshold
			const minImportance = this.config.understand.thresholds.minImportance
			if (minImportance !== undefined && observeResult.importance < minImportance) {
				const result: LearnOutput = {
					status: 'observe:dismissed',
					output: observeResult.output,
					usage: observeResult.usage,
				}
				await this.handleLearnResult(result)
				return result
			}

			// Store observations as pending
			for (const text of observeResult.output) {
				await this.store.observations.add({
					id: `obs_${nanoid()}`,
					data: text,
					metadata_importance: observeResult.importance,
					metadata_tokens: Math.ceil(text.length / 4),
					metadata_status: 'pending',
					metadata_created_at: new Date().toISOString(),
				})
			}

			// Check if understand should happen
			const shouldUnderstand =
				options?.forceSynthesize ||
				(await this.shouldUnderstand(this.config.understand.thresholds))

			if (!shouldUnderstand) {
				const bufferState = await this.getBufferState()
				const result: LearnOutput = {
					status: 'observed',
					output: observeResult.output,
					usage: observeResult.usage,
				}
				await this.handleLearnResult(result, bufferState)
				return result
			}

			// Phase 2: Understand
			const understandResult = await this.understandFromStore(understandModel)
			return understandResult
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:learn:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	private async understandFromStore(model: LanguageModel): Promise<LearnOutput> {
		const pending = await this.store.observations.list({ metadata_status: 'pending' })
		const observations = pending.map((o) => String(o.data))

		this.emit('learner:synthesize:started', {
			learnerId: this.id,
			observationCount: observations.length,
		})

		const understandResult = await this.callUnderstand(
			model,
			this.getUnderstanding(),
			observations,
			{
				onThinking: (thoughts) => {
					this.emit('learner:synthesize:thinking', {
						learnerId: this.id,
						thoughts,
						usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
					})
				},
			},
		)

		// Mark pending observations as processed
		for (const obs of pending) {
			await this.store.observations.update(obs.id, {
				metadata_status: 'processed' as const,
			})
		}

		if (understandResult.status === 'error') {
			const result: LearnOutput = { status: 'synthesize:error', error: understandResult.error }
			await this.handleLearnResult(result)
			return result
		}

		if (understandResult.status === 'dismissed') {
			const result: LearnOutput = {
				status: 'synthesize:dismissed',
				output: understandResult.output,
				usage: understandResult.usage,
			}
			await this.handleLearnResult(result)
			return result
		}

		const processed = await this.postProcessUnderstanding(
			understandResult.newUnderstanding as TUnderstanding,
		)

		const result: LearnOutput = {
			status: 'synthesized',
			newUnderstanding: processed,
			significance: understandResult.significance,
			evolution: understandResult.evolution,
			reasoning: understandResult.reasoning,
			usage: understandResult.usage,
		}
		await this.handleLearnResult(result)
		return result
	}

	// ── Buffer metrics from store ──────────────────────────────────────────

	async getBufferState(): Promise<{
		count: number
		avgImportance: number
		totalTokens: number
	}> {
		const pending = await this.store.observations.list({ metadata_status: 'pending' })
		const count = pending.length
		const avgImportance = count > 0
			? pending.reduce((sum, o) => sum + o.metadata_importance, 0) / count
			: 0
		const totalTokens = Math.ceil(
			pending.reduce((sum, o) => sum + JSON.stringify(o.data).length, 0) / 4,
		)
		return { count, avgImportance, totalTokens }
	}

	async getBufferedObservations(): Promise<Array<{ text: string; importance: number }>> {
		const pending = await this.store.observations.list({ metadata_status: 'pending' })
		return pending.map((o) => ({
			text: String(o.data),
			importance: o.metadata_importance,
		}))
	}

	protected async shouldUnderstand(
		thresholds: Required<UnderstandThresholds>,
	): Promise<boolean> {
		const { count, totalTokens } = await this.getBufferState()
		return count >= thresholds.maxObservations || totalTokens >= thresholds.maxTokens
	}

	// ── Query (concrete — delegates to _queryMethod) ────────────────────────

	async query(question: string, options?: QueryOptions): Promise<QueryResult> {
		this.health.lastAccessed = new Date()
		this.metrics.query.count++

		this.emit('learner:query:started', {
			learnerId: this.id,
			query: question,
		})

		// Short-circuit if learner has no knowledge at all
		const bufferState = await this.getBufferState()
		if (!this.hasKnowledge() && bufferState.count === 0) {
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

	// ── Update ──────────────────────────────────────────────────────────────

	async update(
		updates: BaseLearnerUpdateInput & Record<string, unknown>,
	): Promise<{ changedFields: string[]; config: TConfig }> {
		if (updates.id !== undefined && updates.id !== this.id) {
			throw new Error(
				'Cannot update immutable field "id". Learner identity cannot be changed.',
			)
		}

		const changedFields: string[] = []
		let needsObserveRegen = false
		let needsUnderstandRegen = false

		// ── Metadata (passive) ──

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
			this._origin = updates.origin
			changedFields.push('origin')
		}

		// ── Models (reactive) ──

		if (updates.model !== undefined) {
			this.config.model = updates.model
			changedFields.push('model')
		}

		if (updates.blueprintModel !== undefined) {
			this.config.blueprintModel = updates.blueprintModel
			changedFields.push('blueprintModel')
		}

		// ── Instructions (reactive) ──

		if (updates.instructions !== undefined && updates.instructions !== this.instructions) {
			this.instructions = updates.instructions
			this.config.instructions = updates.instructions
			changedFields.push('instructions')
			needsObserveRegen = true
			needsUnderstandRegen = true
		}

		// ── Focus (reactive) ──

		if (updates.focus !== undefined && updates.focus !== this.focus) {
			this.focus = updates.focus
			changedFields.push('focus')
			needsObserveRegen = true
		}

		// ── Observer config (reactive) ──

		if (updates.observer) {
			if (updates.observer.model !== undefined) {
				this.config.observer.model = updates.observer.model
				changedFields.push('observer.model')
			}
			if (updates.observer.blueprintModel !== undefined) {
				this.config.observer.blueprintModel = updates.observer.blueprintModel
				changedFields.push('observer.blueprintModel')
				needsObserveRegen = true
			}
		}

		// ── Understand config (reactive) ──

		if (updates.understand) {
			if (updates.understand.model !== undefined) {
				this.config.understand.model = updates.understand.model
				changedFields.push('understand.model')
			}
			if (updates.understand.blueprintModel !== undefined) {
				this.config.understand.blueprintModel = updates.understand.blueprintModel
				changedFields.push('understand.blueprintModel')
				needsUnderstandRegen = true
			}
			if (updates.understand.thresholds) {
				Object.assign(this.config.understand.thresholds, updates.understand.thresholds)
				changedFields.push('understand.thresholds')
			}
		}

		// ── Query config ──

		if (updates.query?.model !== undefined) {
			this.config.query.model = updates.query.model
			changedFields.push('query.model')
			this._queryMethod.update({ model: updates.query.model })
		}

		// ── Health config (passive, nested) ──

		if (updates.health) {
			if (updates.health.threshold !== undefined) {
				this.health.threshold = updates.health.threshold
				changedFields.push('health.threshold')
			}
			if (updates.health.signalThresholds) {
				const st = updates.health.signalThresholds
				if (st.maxDismissalRate !== undefined) {
					this.health.signalThresholds.maxDismissalRate = st.maxDismissalRate
					changedFields.push('health.signalThresholds.maxDismissalRate')
				}
				if (st.minConfidence !== undefined) {
					this.health.signalThresholds.minConfidence = st.minConfidence
					changedFields.push('health.signalThresholds.minConfidence')
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.health.signalThresholds.maxObservationsWithoutSynthesis =
						st.maxObservationsWithoutSynthesis
					changedFields.push('health.signalThresholds.maxObservationsWithoutSynthesis')
				}
			}
		}

		// ── Type-specific updates (subclass implements) ──

		this.applyTypeSpecificUpdates(updates, changedFields)

		// ── Force regen if prompts don't exist yet (first init) ──

		if (this.observeSystemPrompt === null) needsObserveRegen = true
		if (this.understandSystemPrompt === null) needsUnderstandRegen = true

		// ── Regenerate prompts ──

		if (needsObserveRegen || needsUnderstandRegen) {
			const promises: Promise<void>[] = []

			if (needsObserveRegen) {
				const observeBlueprintModel =
					this.config.observer.blueprintModel ?? this.config.model
				promises.push(
					initObserve(
						observeBlueprintModel,
						this.instructions,
						this.focus || undefined,
					).then((result) => {
						this._observeIdentity = result.identity
						this.observeSystemPrompt = result.systemPrompt
					}),
				)
			}

			if (needsUnderstandRegen) {
				const understandBlueprintModel =
					this.config.understand.blueprintModel ?? this.config.model
				promises.push(
					this.regenUnderstandPrompt(understandBlueprintModel, this.instructions),
				)
			}

			await Promise.all(promises)

			// Persist regenerated state to store
			await this.saveStateToStore()

			this.emit('learner:prompts:regenerated', {
				learnerId: this.id,
				observePrompt: this.observeSystemPrompt!,
				understandPrompt: this.understandSystemPrompt ?? '',
			})
		}

		if (changedFields.length > 0) {
			this.emit('learner:config:updated', {
				learnerId: this.id,
				changedFields,
				config: { ...this.config },
			})
		}

		return {
			changedFields,
			config: { ...this.config } as TConfig,
		}
	}

	// ── Accessors ───────────────────────────────────────────────────────────

	async getEvolution(): Promise<EvolutionRecord[]> {
		return this.store.evolution.list()
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
			recentObservations: [],
		}
	}

	// ── Shared bookkeeping ──────────────────────────────────────────────────

	protected async handleLearnResult(
		result: LearnOutput,
		bufferState?: { count: number; avgImportance: number },
	): Promise<void> {
		switch (result.status) {
			case 'observed': {
				this.trackIngestion()
				this.emit('learner:observed', {
					learnerId: this.id,
					output: result.output,
					importance: bufferState?.avgImportance ?? 0,
					bufferCount: bufferState?.count ?? 0,
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
				await this.setUnderstanding(result.newUnderstanding as TUnderstanding)

				// Store evolution entry
				await this.store.evolution.add({
					id: `evo_${nanoid()}`,
					summary: result.evolution,
					significance: result.significance,
					reasoning: result.reasoning,
					createdAt: new Date().toISOString(),
				})

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
