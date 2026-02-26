/**
 * BaseLearner — abstract base class for all learner types
 *
 * Owns the full pipeline: observe → store → understand → governance.
 * Store is injected — learner has no knowledge of storage backend.
 *
 * All serializable config and runtime data lives in `this.state`,
 * cached in memory and backed by `store.state`.
 * Understanding is NOT cached — it lives in `store.understanding`.
 *
 * Subclasses implement type-specific behavior:
 * - regenUnderstandPrompt (identity/prompt generation)
 * - callUnderstand, postProcessUnderstanding (understand phase)
 * - getUnderstanding, setUnderstanding, getSummary, hasKnowledge
 * - createQueryMethod, applyTypeSpecificUpdates
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
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
import { adjustObserve, initObserve, observe } from '../observer'
import type { EvolutionRecord, Store } from '../stores'
import type { QueryCallbacks, QueryMethod, QueryOptions, QueryResult } from '../base/query'
import type {
	BaseLearnerUpdateInput,
	SharedLearnerEventMap,
} from './types'
import type { BaseLearnerState, ModelSlots, StateTransform } from './state'
import { serializeModelSlots } from './state'

/**
 * Output from learn() - discriminated union of all possible outcomes
 */
export type LearnOutput =
	| { status: 'observed'; output: unknown[]; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
	| { status: 'observe:dismissed'; output: unknown[]; gaps: string[]; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
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

export abstract class BaseLearner<
	TUnderstanding,
	TState extends BaseLearnerState = BaseLearnerState,
>
	extends TypedEmitter<SharedLearnerEventMap>
	implements Learner<TUnderstanding>
{
	readonly id: string
	protected store: Store
	protected state: TState
	protected queryMethod!: QueryMethod

	// Lazy init promise (for ensureInit)
	private initPromise: Promise<{ observeSystemPrompt: string; understandSystemPrompt: string }> | null = null

	/**
	 * Transform registry for store ↔ cache boundary.
	 * Keys not in the registry pass through as-is (identity transform).
	 * Subclasses can extend this in their constructor.
	 */
	protected stateTransforms: Record<string, StateTransform> = {
		models: {
			serialize: (v) => serializeModelSlots(v as ModelSlots),
			// On load, keep live models from constructor — store only has refs
			deserialize: (_stored) => this.state.models,
		},
		health: {
			serialize: (v) => {
				const h = v as LearnerHealth
				return {
					...h,
					lastAccessed: h.lastAccessed.toISOString(),
				}
			},
			deserialize: (v) => {
				const h = v as Record<string, unknown>
				return {
					...h,
					lastAccessed: new Date(h.lastAccessed as string),
				}
			},
		},
	}

	constructor(
		id: string,
		store: Store,
		initialState: TState,
	) {
		super()
		this.id = id
		this.store = store
		this.state = initialState
	}

	// ── Abstract — each subclass implements ─────────────────────────────────

	abstract get type(): string
	abstract getUnderstanding(): Promise<TUnderstanding>
	abstract setUnderstanding(value: TUnderstanding): Promise<void>
	abstract getSummary(): Promise<string>
	abstract hasKnowledge(): Promise<boolean>

	/**
	 * Hook for type-specific config updates (e.g. governance).
	 * Returns partial state updates to be merged and persisted.
	 */
	protected abstract applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): Partial<TState>

	/**
	 * Regenerate understand prompt (type-specific — text uses strategy, list uses identity)
	 */
	protected abstract regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void>

	/**
	 * Adjust understand prompt from a directive (type-specific)
	 * Unlike regen (stateless), this passes current identity so the LLM can evolve it.
	 */
	protected abstract adjustUnderstandPrompt(
		model: LanguageModel,
		directive: string,
		newInstructions: string,
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

	/**
	 * Generate observation and understanding JSON Schemas.
	 * Text learner returns hardcoded schemas; list learner generates via LLM.
	 */
	protected abstract generateSchemas(
		model: LanguageModel,
		instructions: string,
	): Promise<{
		observationSchema: Record<string, unknown>
		understandingSchema: Record<string, unknown>
	}>

	// ── State persistence ────────────────────────────────────────────────────

	/**
	 * Update cache + persist changed keys to store.state.
	 * Each top-level key in updates → one row in store.state.
	 */
	protected async setState(updates: Partial<TState>): Promise<void> {
		Object.assign(this.state, updates)
		const now = new Date().toISOString()
		for (const [key, value] of Object.entries(updates)) {
			const transform = this.stateTransforms[key]
			const serialized = transform ? transform.serialize(value) : value
			const existing = await this.store.state.get(key)
			if (existing) {
				await this.store.state.update(key, { value: serialized, updated_at: now })
			} else {
				await this.store.state.add({ id: key, value: serialized, updated_at: now })
			}
		}
	}

	/**
	 * Load all state from store.state into cache.
	 * Returns true if state was found, false otherwise.
	 */
	protected async loadState(): Promise<boolean> {
		const records = await this.store.state.list()
		if (records.length === 0) return false
		for (const record of records) {
			const transform = this.stateTransforms[record.id]
			;(this.state as Record<string, unknown>)[record.id] =
				transform ? transform.deserialize(record.value) : record.value
		}
		return true
	}

	// ── Init ────────────────────────────────────────────────────────────────

	async init(): Promise<{
		observeSystemPrompt: string
		understandSystemPrompt: string
	}> {
		if (this.isInitialized()) {
			return {
				observeSystemPrompt: this.state.observe_prompt!,
				understandSystemPrompt: this.state.understand_prompt!,
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			// Try restoring state from store (skip LLM calls)
			const restored = await this.loadState()

			if (!restored) {
				// Generate observe identity + prompt via LLM
				const observeResult = await initObserve(
					this.state.models.observer_blueprint,
					this.state.instructions,
					this.state.focus || undefined,
				)

				// Generate understand identity + prompt (type-specific)
				await this.regenUnderstandPrompt(
					this.state.models.understand_blueprint,
					this.state.instructions,
				)

				// Generate schemas (type-specific)
				const schemas = await this.generateSchemas(
					this.state.models.blueprint,
					this.state.instructions,
				)

				// Persist all generated artifacts to store
				await this.setState({
					observe_identity: observeResult.identity,
					observe_prompt: observeResult.systemPrompt,
					observation_schema: schemas.observationSchema,
					understanding_schema: schemas.understandingSchema,
				} as Partial<TState>)
			}

			// Create query method
			this.queryMethod = this.createQueryMethod()

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this.state.observe_prompt!,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			})

			return {
				observeSystemPrompt: this.state.observe_prompt!,
				understandSystemPrompt: this.state.understand_prompt ?? '',
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

	// ── Validation ──────────────────────────────────────────────────────────

	protected validateObservationData(data: unknown): boolean {
		if (!this.state.observation_schema) return true
		return z.fromJSONSchema(this.state.observation_schema).safeParse(data).success
	}

	protected validateUnderstandingData(data: unknown): boolean {
		if (!this.state.understanding_schema) return true
		return z.fromJSONSchema(this.state.understanding_schema).safeParse(data).success
	}

	// ── Identity ────────────────────────────────────────────────────────────

	get instructions(): string {
		return this.state.instructions
	}

	get name(): string {
		return this.state.name
	}

	get description(): string {
		return this.state.description
	}

	get focus(): string | null {
		return this.state.focus
	}

	get origin(): LearnerOrigin {
		return this.state.origin
	}

	isInitialized(): boolean {
		return this.state.observe_prompt !== null
	}

	private async ensureInit(): Promise<void> {
		if (this.isInitialized()) return
		if (!this.initPromise) {
			this.initPromise = this.init()
		}
		await this.initPromise
	}

	getObserveSystemPrompt(): string | null {
		return this.state.observe_prompt
	}

	getUnderstandSystemPrompt(): string | null {
		return this.state.understand_prompt
	}

	getUnderstandThresholds() {
		return { ...this.state.thresholds }
	}

	getObservationSchema(): Record<string, unknown> | null {
		return this.state.observation_schema
	}

	getUnderstandingSchema(): Record<string, unknown> | null {
		return this.state.understanding_schema
	}

	// ── Learn (pipeline: observe → store → understand) ────────────────────

	async learn(batch: unknown[], options?: LearnOptions): Promise<LearnOutput> {
		await this.ensureInit()

		try {
			// Handle forceSynthesize with empty data
			if (options?.forceSynthesize && batch.length === 0) {
				const pendingCount = await this.store.observations.count({ metadata_status: 'pending' })
				if (pendingCount > 0) {
					return this.understandFromStore(this.state.models.understand)
				}
			}

			// Phase 1: Observe
			this.emit('learner:observe:started', {
				learnerId: this.id,
				itemCount: batch.length,
			})

			const observeResult = await observe(
				this.state.models.observer,
				this.state.observe_prompt!,
				{ learnerId: this.id, instructions: this.state.instructions, data: batch },
				this.state.observation_schema ?? undefined,
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
					gaps: observeResult.gaps,
					usage: observeResult.usage,
				}
				await this.handleLearnResult(result)
				return result
			}

			// Filter by importance threshold
			const minImportance = this.state.thresholds.minImportance
			if (minImportance !== undefined && observeResult.importance < minImportance) {
				const result: LearnOutput = {
					status: 'observe:dismissed',
					output: observeResult.output,
					gaps: observeResult.gaps,
					usage: observeResult.usage,
				}
				await this.handleLearnResult(result)
				return result
			}

			// Store observations as pending (with Layer 2 validation)
			for (const item of observeResult.output) {
				if (!this.validateObservationData(item)) {
					console.error(`[${this.id}] Skipping invalid observation:`, item)
					continue
				}
				const serialized = typeof item === 'string' ? item : JSON.stringify(item)
				await this.store.observations.add({
					id: `obs_${nanoid()}`,
					data: item,
					metadata_importance: observeResult.importance,
					metadata_tokens: Math.ceil(serialized.length / 4),
					metadata_status: 'pending',
					metadata_created_at: new Date().toISOString(),
				})
			}

			// Check if understand should happen
			const shouldUnderstand =
				options?.forceSynthesize ||
				(await this.shouldUnderstand(this.state.thresholds))

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
			const understandResult = await this.understandFromStore(this.state.models.understand)
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
		const observations = pending.map((o) =>
			typeof o.data === 'string' ? o.data : JSON.stringify(o.data),
		)

		this.emit('learner:synthesize:started', {
			learnerId: this.id,
			observationCount: observations.length,
		})

		const understanding = await this.getUnderstanding()
		const understandResult = await this.callUnderstand(
			model,
			understanding,
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
		thresholds: { maxObservations: number; maxTokens: number },
	): Promise<boolean> {
		const { count, totalTokens } = await this.getBufferState()
		return count >= thresholds.maxObservations || totalTokens >= thresholds.maxTokens
	}

	// ── Query (concrete — delegates to queryMethod) ────────────────────────

	async query(question: string, options?: QueryOptions): Promise<QueryResult> {
		await this.ensureInit()
		this.state.health.lastAccessed = new Date()
		this.state.metrics.query.count++

		this.emit('learner:query:started', {
			learnerId: this.id,
			query: question,
		})

		// Short-circuit if learner has no knowledge at all
		const bufferState = await this.getBufferState()
		if (!(await this.hasKnowledge()) && bufferState.count === 0) {
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
			const result = await this.queryMethod.query(
				{
					learnerId: this.id,
					instructions: this.state.instructions,
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
	): Promise<{ changedFields: string[] }> {
		const changedFields: string[] = []
		let needsObserveRegen = false
		let needsUnderstandRegen = false
		let needsSchemaRegen = false
		const stateUpdates: Partial<TState> = {} as Partial<TState>

		if (updates.id !== undefined && updates.id !== this.id) {
			throw new Error(
				'Cannot update immutable field "id". Learner identity cannot be changed.',
			)
		}

		// ── Metadata (passive) ──

		if (updates.name !== undefined && updates.name !== this.state.name) {
			;(stateUpdates as Record<string, unknown>).name = updates.name
			changedFields.push('name')
		}

		if (updates.description !== undefined && updates.description !== this.state.description) {
			;(stateUpdates as Record<string, unknown>).description = updates.description
			changedFields.push('description')
		}

		if (updates.origin !== undefined && updates.origin !== this.state.origin) {
			;(stateUpdates as Record<string, unknown>).origin = updates.origin
			changedFields.push('origin')
		}

		// ── Models (reactive) ──

		if (updates.model !== undefined || updates.blueprintModel !== undefined ||
			updates.observer?.model !== undefined || updates.observer?.blueprintModel !== undefined ||
			updates.understand?.model !== undefined || updates.understand?.blueprintModel !== undefined ||
			updates.query?.model !== undefined) {

			const newModels = { ...this.state.models }
			if (updates.model !== undefined) {
				newModels.default = updates.model
				changedFields.push('model')
			}
			if (updates.blueprintModel !== undefined) {
				newModels.blueprint = updates.blueprintModel
				changedFields.push('blueprintModel')
			}
			if (updates.observer?.model !== undefined) {
				newModels.observer = updates.observer.model
				changedFields.push('observer.model')
			}
			if (updates.observer?.blueprintModel !== undefined) {
				newModels.observer_blueprint = updates.observer.blueprintModel
				changedFields.push('observer.blueprintModel')
				needsObserveRegen = true
			}
			if (updates.understand?.model !== undefined) {
				newModels.understand = updates.understand.model
				changedFields.push('understand.model')
			}
			if (updates.understand?.blueprintModel !== undefined) {
				newModels.understand_blueprint = updates.understand.blueprintModel
				changedFields.push('understand.blueprintModel')
				needsUnderstandRegen = true
			}
			if (updates.query?.model !== undefined) {
				newModels.query = updates.query.model
				changedFields.push('query.model')
				this.queryMethod.update({ model: updates.query.model })
			}

			;(stateUpdates as Record<string, unknown>).models = newModels
		}

		// ── Instructions (reactive) ──

		if (updates.instructions !== undefined && updates.instructions !== this.state.instructions) {
			;(stateUpdates as Record<string, unknown>).instructions = updates.instructions
			changedFields.push('instructions')
			needsObserveRegen = true
			needsUnderstandRegen = true
			needsSchemaRegen = true
		}

		// ── Focus (reactive) ──

		if (updates.focus !== undefined && updates.focus !== this.state.focus) {
			;(stateUpdates as Record<string, unknown>).focus = updates.focus
			changedFields.push('focus')
			needsObserveRegen = true
		}

		// ── Thresholds ──

		if (updates.understand?.thresholds) {
			const newThresholds = { ...this.state.thresholds, ...updates.understand.thresholds }
			;(stateUpdates as Record<string, unknown>).thresholds = newThresholds
			changedFields.push('understand.thresholds')
		}

		// ── Health config (passive, nested) ──

		if (updates.health) {
			const newHealth = { ...this.state.health }
			if (updates.health.threshold !== undefined) {
				newHealth.threshold = updates.health.threshold
				changedFields.push('health.threshold')
			}
			if (updates.health.signalThresholds) {
				const st = updates.health.signalThresholds
				newHealth.signalThresholds = { ...newHealth.signalThresholds }
				if (st.maxDismissalRate !== undefined) {
					newHealth.signalThresholds.maxDismissalRate = st.maxDismissalRate
					changedFields.push('health.signalThresholds.maxDismissalRate')
				}
				if (st.minConfidence !== undefined) {
					newHealth.signalThresholds.minConfidence = st.minConfidence
					changedFields.push('health.signalThresholds.minConfidence')
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					newHealth.signalThresholds.maxObservationsWithoutSynthesis =
						st.maxObservationsWithoutSynthesis
					changedFields.push('health.signalThresholds.maxObservationsWithoutSynthesis')
				}
			}
			;(stateUpdates as Record<string, unknown>).health = newHealth
		}

		// ── Type-specific updates (subclass implements) ──

		const typeSpecificUpdates = this.applyTypeSpecificUpdates(updates, changedFields)
		Object.assign(stateUpdates, typeSpecificUpdates)

		// ── Force regen if prompts don't exist yet (first init) ──

		if (this.state.observe_prompt === null) needsObserveRegen = true
		if (this.state.understand_prompt === null) needsUnderstandRegen = true
		if (this.state.observation_schema === null) needsSchemaRegen = true

		// ── Regenerate prompts ──

		// Apply state updates collected so far (so regen uses fresh instructions/focus)
		if (Object.keys(stateUpdates).length > 0) {
			await this.setState(stateUpdates)
		}

		if (needsObserveRegen || needsUnderstandRegen || needsSchemaRegen) {
			const promises: Promise<void>[] = []
			const regenUpdates: Partial<TState> = {} as Partial<TState>

			if (needsObserveRegen) {
				promises.push(
					initObserve(
						this.state.models.observer_blueprint,
						this.state.instructions,
						this.state.focus || undefined,
					).then((result) => {
						;(regenUpdates as Record<string, unknown>).observe_identity = result.identity
						;(regenUpdates as Record<string, unknown>).observe_prompt = result.systemPrompt
					}),
				)
			}

			if (needsUnderstandRegen) {
				promises.push(
					this.regenUnderstandPrompt(
						this.state.models.understand_blueprint,
						this.state.instructions,
					),
				)
			}

			await Promise.all(promises)

			// Regenerate schemas if instructions changed
			if (needsSchemaRegen) {
				const schemas = await this.generateSchemas(
					this.state.models.blueprint,
					this.state.instructions,
				)
				;(regenUpdates as Record<string, unknown>).observation_schema = schemas.observationSchema
				;(regenUpdates as Record<string, unknown>).understanding_schema = schemas.understandingSchema
			}

			// Persist regenerated state
			if (Object.keys(regenUpdates).length > 0) {
				await this.setState(regenUpdates)
			}

			this.emit('learner:prompts:regenerated', {
				learnerId: this.id,
				observePrompt: this.state.observe_prompt!,
				understandPrompt: this.state.understand_prompt ?? '',
			})
		}

		if (changedFields.length > 0) {
			this.emit('learner:config:updated', {
				learnerId: this.id,
				changedFields,
				config: { ...this.state },
			})
		}

		return { changedFields }
	}

	// ── Adjust ──────────────────────────────────────────────────────────────

	/**
	 * Adjust learner behavior from a natural language directive.
	 *
	 * Unlike update() (which replaces instructions and regenerates from scratch),
	 * adjust() shows the LLM the current state so it can evolve incrementally.
	 * The directive is natural language: "also track X", "stop tracking Y", "be stricter", etc.
	 *
	 * Does NOT touch persisted data (observations, understandings, evolution records).
	 */
	async adjust(directive: string): Promise<{ changedFields: string[] }> {
		await this.ensureInit()

		// 1. Adjust observe (shared) — resolves new instructions + new observe identity
		const observeResult = await adjustObserve(
			this.state.models.observer_blueprint,
			directive,
			this.state.instructions,
			this.state.observe_identity!,
			this.state.focus || undefined,
		)

		// 2. Persist new instructions + observe artifacts
		await this.setState({
			instructions: observeResult.newInstructions,
			observe_identity: observeResult.identity,
			observe_prompt: observeResult.systemPrompt,
		} as Partial<TState>)

		// 3. Adjust understand (type-specific)
		await this.adjustUnderstandPrompt(
			this.state.models.understand_blueprint,
			directive,
			observeResult.newInstructions,
		)

		// 4. Regenerate schemas from new instructions (stateless is fine for schemas)
		const schemas = await this.generateSchemas(
			this.state.models.blueprint,
			observeResult.newInstructions,
		)
		await this.setState({
			observation_schema: schemas.observationSchema,
			understanding_schema: schemas.understandingSchema,
		} as Partial<TState>)

		const changedFields = [
			'instructions',
			'observe_identity',
			'observe_prompt',
			'understand_identity',
			'understand_prompt',
			'observation_schema',
			'understanding_schema',
		]

		this.emit('learner:prompts:regenerated', {
			learnerId: this.id,
			observePrompt: this.state.observe_prompt!,
			understandPrompt: this.state.understand_prompt ?? '',
		})

		this.emit('learner:config:updated', {
			learnerId: this.id,
			changedFields,
			config: { ...this.state },
		})

		return { changedFields }
	}

	// ── Accessors ───────────────────────────────────────────────────────────

	async getEvolution(): Promise<EvolutionRecord[]> {
		return this.store.evolution.list()
	}

	getHealth(): LearnerHealth {
		return { ...this.state.health }
	}

	getMetrics(): LearnerMetrics {
		return {
			ingestion: { ...this.state.metrics.ingestion },
			query: {
				...this.state.metrics.query,
				relevanceScores: [...this.state.metrics.query.relevanceScores],
				confidenceScores: [...this.state.metrics.query.confidenceScores],
				gaps: [...this.state.metrics.query.gaps],
			},
		}
	}

	getMetadata(): LearnerMetadata {
		return {
			id: this.id,
			instructions: this.state.instructions,
			origin: this.state.origin,
			health: this.getHealth(),
		}
	}

	getActivity(): LearnerActivity {
		return {
			ingestion: { ...this.state.metrics.ingestion },
			recentObservations: [],
		}
	}

	/**
	 * Dispose of the learner and its store
	 */
	async dispose(): Promise<void> {
		await this.store.dispose()
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
					gaps: result.gaps,
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
				this.state.metrics.ingestion.synthesisCount++
				this.state.metrics.ingestion.observationsSinceLastSynthesis = 0
				this.state.stagnation_signal_fired = false

				const previousUnderstanding = await this.getUnderstanding()
				await this.setUnderstanding(result.newUnderstanding as TUnderstanding)

				// Store evolution entry
				await this.store.evolution.add({
					id: `evo_${nanoid()}`,
					summary: result.evolution,
					significance: result.significance,
					reasoning: result.reasoning,
					created_at: new Date().toISOString(),
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
		this.state.metrics.ingestion.observationCount++
		this.state.metrics.ingestion.observationsSinceLastSynthesis++
		if (dismissed) {
			this.state.metrics.ingestion.dismissalCount++
		}
		this.state.metrics.ingestion.dismissalRate =
			this.state.metrics.ingestion.observationCount > 0
				? this.state.metrics.ingestion.dismissalCount /
					this.state.metrics.ingestion.observationCount
				: 0
	}

	protected trackQueryMetrics(result: { relevance: number; confidence: number; gaps: string }): void {
		const WINDOW_SIZE = 10
		const MAX_GAPS = 50

		this.state.metrics.query.relevanceScores.push(result.relevance)
		if (this.state.metrics.query.relevanceScores.length > WINDOW_SIZE) {
			this.state.metrics.query.relevanceScores.shift()
		}

		this.state.metrics.query.confidenceScores.push(result.confidence)
		if (this.state.metrics.query.confidenceScores.length > WINDOW_SIZE) {
			this.state.metrics.query.confidenceScores.shift()
		}

		if (result.gaps) {
			const gaps = result.gaps.split('\n').filter(Boolean)
			this.state.metrics.query.gaps.push(...gaps)
			if (this.state.metrics.query.gaps.length > MAX_GAPS) {
				this.state.metrics.query.gaps = this.state.metrics.query.gaps.slice(-MAX_GAPS)
			}
		}
	}

	protected updateGovernance(relevance: number): void {
		const previousStatus = this.state.health.status

		this.state.health.activation =
			this.state.health.activation * 0.8 + relevance * 0.2

		if (this.state.health.activation >= this.state.health.threshold) {
			this.state.health.status = 'active'
		}

		this.state.health.lastAccessed = new Date()

		this.emit('learner:health:updated', {
			learnerId: this.id,
			activation: this.state.health.activation,
			status: this.state.health.status,
			previousStatus:
				previousStatus !== this.state.health.status ? previousStatus : undefined,
		})
	}

	protected checkAndEmitSignals(): void {
		const { signalThresholds } = this.state.health
		const { ingestion, query } = this.state.metrics

		if (ingestion.observationCount > 10) {
			if (ingestion.dismissalRate > signalThresholds.maxDismissalRate) {
				if (!this.state.dismissal_signal_fired) {
					this.state.dismissal_signal_fired = true
					this.emit('learner:signal', {
						learnerId: this.id,
						description: `High dismissal rate: rejecting ${(ingestion.dismissalRate * 100).toFixed(0)}% of observations`,
						timestamp: new Date(),
						metrics: { dismissalRate: ingestion.dismissalRate },
					})
				}
			} else {
				this.state.dismissal_signal_fired = false
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
				this.state.metrics.query.relevanceScores = []
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
				this.state.metrics.query.confidenceScores = []
			}
		}

		if (
			!this.state.stagnation_signal_fired &&
			ingestion.observationsSinceLastSynthesis >
				signalThresholds.maxObservationsWithoutSynthesis
		) {
			this.state.stagnation_signal_fired = true
			this.emit('learner:signal', {
				learnerId: this.id,
				description: `Stagnation: no synthesis in ${ingestion.observationsSinceLastSynthesis} observations`,
				timestamp: new Date(),
			})
		}
	}
}
