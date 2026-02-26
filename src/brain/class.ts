import { tool } from 'ai'
import type { CallSettings } from 'ai'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import {
	BaseLearner,
	type GeneratedLearnerConfig,
	type LearnerHealth,
	type LearnerTypeDescriptor,
	MemoryStore,
	type Store,
	type TokenUsage,
	textLearnerDescriptor,
	listLearnerDescriptor,
} from '../learners'
import { generate, Output } from '../llm'
import { TypedEmitter } from '../types/events'
import { synthesize } from './agent'
import { BRAIN_DEFAULTS } from './config.defaults'
import { Evaluator } from './evaluator/class'
import { EVOLUTION_ACTIONS, type EvolutionDecision } from './evaluator/types'
import { EvolutionOrchestrator } from './evolution/orchestrator'
import type { AggregatedEvolutionResult } from './evolution/types'
import { rootDecompositionPrompt } from './prompts/prompt.template.root-decomposition'
import { brainDecompositionSchema } from './schemas/schema.brain-decomposition'
import { MemoryBrainStore } from './stores'
import type { BrainStore } from './stores'
import type {
	BrainAskResult,
	BrainConfig,
	BrainEventMap,
	BrainInjectOptions,
	BrainInjectResult,
	BrainUpdateResult,
	ConsultOptions,
	ConsultResult,
	LearnerBatchResult,
	ResolvedBrainConfig,
} from './types'
import {
	type BrainModelSlots,
	type BrainState,
	type BrainStateTransform,
	createInitialBrainState,
	serializeBrainModelSlots,
} from './state'
import { getInternalLearnerConfigs, INTERNAL_LEARNER_IDS } from './internal-learners'

/**
 * Brain - A learning system that auto-generates and coordinates multiple learners
 *
 * Brain takes a natural language prompt and decomposes it into specialized learners.
 * Data injection routes to all learners, and queries synthesize responses from all learners.
 *
 * Emits events for all operations and forwards learner events.
 */
export class Brain extends TypedEmitter<BrainEventMap> {
	// Persisted state — single source of truth (backed by store.state)
	private state: BrainState

	// Persistence layer
	readonly store: BrainStore

	// State transforms (serialize/deserialize for non-serializable fields)
	private readonly stateTransforms: Record<string, BrainStateTransform> = {
		models: {
			serialize: (value: unknown) =>
				serializeBrainModelSlots(value as BrainModelSlots),
			deserialize: () => this.state.models,
		},
	}

	// Runtime (rebuilt on init)
	readonly learners: Map<string, BaseLearner<unknown>> = new Map()
	readonly internalLearners: Map<string, BaseLearner<unknown>> = new Map()
	readonly learnerTypes: Map<string, LearnerTypeDescriptor>
	private learnerNames: Map<string, string> = new Map()
	private initialized = false
	private evaluator?: Evaluator
	private evolutionOrchestrator?: EvolutionOrchestrator

	// Constructor config (not persisted, used during init only)
	private readonly learnerStoreFactory: (learnerId: string) => Store
	private readonly autoSetup: boolean
	private readonly configLearners?: GeneratedLearnerConfig[]
	private readonly internalLearnersConfig: BrainConfig['internalLearners']
	private readonly dismissedBatchMaxSize: number

	constructor(rawConfig: BrainConfig) {
		super()

		const model = rawConfig.model
		const blueprintModel = rawConfig.blueprintModel ?? model

		this.state = createInitialBrainState({
			prompt: rawConfig.prompt,
			model,
			blueprintModel,
			initModel: rawConfig.init?.model ?? blueprintModel,
			queryModel: rawConfig.query?.model ?? model,
			batchSize: rawConfig.ingest?.batchSize ?? BRAIN_DEFAULTS.ingest.batchSize,
			evolution: {
				enabled: rawConfig.evolution?.enabled ?? BRAIN_DEFAULTS.evolution.enabled,
				evaluatorSignalThreshold:
					rawConfig.evolution?.evaluatorSignalThreshold ??
					BRAIN_DEFAULTS.evolution.evaluatorSignalThreshold,
				autoEvaluate:
					rawConfig.evolution?.autoEvaluate ?? BRAIN_DEFAULTS.evolution.autoEvaluate,
				coverageGap: {
					relevanceThreshold: rawConfig.evolution?.coverageGap?.relevanceThreshold ?? 0.3,
					gapCountThreshold: rawConfig.evolution?.coverageGap?.gapCountThreshold ?? 5,
					windowSize: rawConfig.evolution?.coverageGap?.windowSize ?? 20,
				},
			},
		})
		this.store = rawConfig.store ?? new MemoryBrainStore()
		this.learnerStoreFactory = rawConfig.learning?.store ?? (() => new MemoryStore())
		this.autoSetup = rawConfig.autoSetup ?? true
		this.configLearners = rawConfig.learners
		this.internalLearnersConfig = rawConfig.internalLearners
		this.dismissedBatchMaxSize = rawConfig.dismissedBatchBuffer?.maxSize ?? BRAIN_DEFAULTS.dismissedBatchBuffer.maxSize

		// Register learner type descriptors (default: text + list)
		this.learnerTypes = new Map([
			[textLearnerDescriptor.type, textLearnerDescriptor],
			[listLearnerDescriptor.type, listLearnerDescriptor],
		])
	}

	// ── Public accessors (read from state) ──────────────────────────────────

	get prompt(): string {
		return this.state.prompt
	}

	/**
	 * Computed view of state in the ResolvedBrainConfig shape.
	 * External readers (evaluator, evolution handlers, evals) use this.
	 * Internally, always read from this.state directly.
	 */
	get config(): ResolvedBrainConfig {
		return {
			prompt: this.state.prompt,
			model: this.state.models.default,
			blueprintModel: this.state.models.blueprint,
			init: { model: this.state.models.init },
			query: { model: this.state.models.query },
			ingest: this.state.ingest,
			evolution: this.state.evolution,
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// State persistence (mirrors BaseLearner pattern)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Update cache + persist changed keys to store.state.
	 * Each top-level key in updates → one row in store.state.
	 */
	private async setState(updates: Partial<BrainState>): Promise<void> {
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
	private async loadState(): Promise<boolean> {
		const records = await this.store.state.list()
		if (records.length === 0) return false

		for (const record of records) {
			const transform = this.stateTransforms[record.id]
			const deserialized = transform ? transform.deserialize(record.value) : record.value
			;(this.state as unknown as Record<string, unknown>)[record.id] = deserialized
		}

		return true
	}

	/**
	 * Explicitly initialize the Brain (parse prompt and generate learners)
	 * Called automatically on first inject() or ask() if not called explicitly.
	 *
	 * Tries restore-from-store first. If state exists, recreates learners from
	 * store.learners list (no LLM call). Otherwise, does fresh LLM decomposition.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		this.emit('brain:init:started', {})

		try {
			// Try restore from store first
			const restored = await this.loadState()

			if (restored) {
				await this.restoreLearners()
				await this.restoreInternalLearners()
			} else {
				await this.freshInitialize()
			}

			// Initialize Evaluator and EvolutionOrchestrator if evolution is enabled
			this.initEvolution()

			this.initialized = true
			this.emit('brain:init:completed', {
				learnerIds: Array.from(this.learners.keys()),
			})
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			this.emit('brain:init:failed', { error: errorMessage })
			throw error
		}
	}

	/**
	 * Fresh initialization: create explicit learners + LLM decomposition → persist state
	 *
	 * Flow:
	 * 1. If explicit `learners` provided → create those first
	 * 2. If `autopilot` is true → also run LLM decomposition for additional learners
	 * 3. Persist brain state for future restores
	 */
	private async freshInitialize(): Promise<void> {
		// 1. Create explicit learners if provided
		if (this.configLearners?.length) {
			for (const config of this.configLearners) {
				await this.createLearnerFromConfig(config)
			}
		}

		// 2. LLM decomposition (when autopilot is on)
		if (this.autoSetup) {
			this.emit('brain:init:config:generating', {})

			const { output, usage: llmUsage } = await this.generateLearnerConfigs()

			if (!output) {
				const error = 'Failed to generate learner configurations'
				this.emit('brain:init:failed', { error })
				throw new Error(error)
			}

			const usage: TokenUsage = {
				inputTokens: llmUsage?.inputTokens ?? 0,
				outputTokens: llmUsage?.outputTokens ?? 0,
				totalTokens: llmUsage?.totalTokens ?? 0,
			}

			this.emit('brain:init:config:generated', {
				configs: output.learners,
				usage,
			})

			for (const config of output.learners) {
				// Skip if a learner with this ID was already created from explicit config
				if (this.learners.has(config.id)) continue
				await this.createLearnerFromConfig(config)
			}
		}

		// Create internal learners
		await this.createInternalLearners()

		// Persist brain state for future restores
		await this.setState({ ...this.state })
	}

	/**
	 * Restore learners from store.learners list (no LLM call).
	 * Each record is just { id, type }. The learner's own store has everything
	 * else — init() → loadState() handles the rest.
	 */
	private async restoreLearners(): Promise<void> {
		const records = await this.store.learners.list()

		for (const record of records) {
			const descriptor = this.learnerTypes.get(record.type)
			if (!descriptor) {
				throw new Error(`Unknown learner type: ${record.type}`)
			}

			const learner = descriptor.factory({
				id: record.id,
				model: this.state.models.default,
				blueprintModel: this.state.models.blueprint,
				// Placeholder values — init() → loadState() overwrites from learner's own store
				instructions: '',
				name: '',
				description: '',
				origin: 'prompt' as const,
				store: this.learnerStoreFactory(record.id),
			})

			// Forward all learner events through Brain
			learner.on((event) => {
				this.emit(event.type as keyof BrainEventMap, event.payload as never)
			})

			learner.on('learner:signal', (event) => {
				this.signal({
					source: event.learnerId,
					description: event.description,
				})
			})

			// Feed synthesis events to global injection understanding
			this.wireExternalLearnerSynthesisEvents(learner)

			// init() → loadState() restores everything from the learner's own store
			await learner.init()

			this.learners.set(record.id, learner)
			this.learnerNames.set(record.id, learner.name)
		}
	}

	/**
	 * Restore internal learners from store.internalLearners (no LLM call).
	 * Same pattern as restoreLearners() but writes to this.internalLearners.
	 * Internal learner signals are NOT forwarded to the evaluator.
	 */
	private async restoreInternalLearners(): Promise<void> {
		const records = await this.store.internalLearners.list()

		for (const record of records) {
			const descriptor = this.learnerTypes.get(record.type)
			if (!descriptor) {
				throw new Error(`Unknown learner type: ${record.type}`)
			}

			const learner = descriptor.factory({
				id: record.id,
				model: this.state.models.default,
				blueprintModel: this.state.models.blueprint,
				instructions: '',
				name: '',
				description: '',
				origin: 'prompt' as const,
				store: this.learnerStoreFactory(record.id),
			})

			// Forward events through Brain but do NOT forward signals to evaluator
			learner.on((event) => {
				this.emit(event.type as keyof BrainEventMap, event.payload as never)
			})

			await learner.init()

			this.internalLearners.set(record.id, learner)
		}
	}

	/**
	 * Create internal learners from definitions during fresh init.
	 * Uses the same factory as external learners but stores in the internal map/store.
	 */
	private async createInternalLearners(): Promise<void> {
		const configs = getInternalLearnerConfigs(this.internalLearnersConfig)

		for (const config of configs) {
			const descriptor = this.learnerTypes.get(config.type)
			if (!descriptor) continue

			const governance = config.type === 'text' && !config.governance
				? { strategy: BRAIN_DEFAULTS.learning.governance.strategy, maxTokens: BRAIN_DEFAULTS.learning.governance.maxTokens }
				: config.governance

			const learner = descriptor.factory({
				id: config.id,
				model: this.state.models.default,
				blueprintModel: this.state.models.blueprint,
				instructions: config.instructions,
				origin: 'prompt' as const,
				name: config.name,
				description: config.description,
				store: this.learnerStoreFactory(config.id),
				governance,
				understand: {
					thresholds: {
						maxObservations: 3,
						maxTokens: BRAIN_DEFAULTS.learning.understand.thresholds.maxTokens,
						minImportance: 0.1,
					},
				},
			})

			// Forward events but do NOT forward signals to evaluator
			learner.on((event) => {
				this.emit(event.type as keyof BrainEventMap, event.payload as never)
			})

			await learner.init()

			this.internalLearners.set(config.id, learner)
			await this.store.internalLearners.add({
				id: config.id,
				type: config.type,
			})
		}
	}

	/**
	 * Initialize evolution system (evaluator + orchestrator)
	 */
	private initEvolution(): void {
		if (!this.state.evolution.enabled) return

		this.evaluator = new Evaluator(
			this,
			this.state.evolution.evaluatorSignalThreshold,
		)

		// Forward all Evaluator events through Brain
		this.evaluator.on((event) => {
			this.emit(event.type as keyof BrainEventMap, event.payload as never)
		})

		// Auto-execute decisions from signal-triggered evaluations
		this.evaluator.on('evaluator:evaluation:completed', async (event) => {
			if (event.source === 'auto' && event.decisions.length > 0) {
				await this.executeEvolutionDecisions(event.decisions)
			}
		})

		// Initialize evolution orchestrator
		this.evolutionOrchestrator = new EvolutionOrchestrator(this)

		// Re-inject dismissed batches after evolution creates new learners
		this.on('evolution:action:executed', (event) => {
			if (event.action === 'create' && event.result.newLearnerIds?.length) {
				this.reinjectDismissedBatches(event.result.newLearnerIds).catch((err) => {
				console.error(`[internal-learner] feed error:`, err?.message ?? err)
			})
			}
		})

		// Restore evolution history from store
		this.restoreEvolutionHistory()
	}

	/**
	 * Restore evolution history from brain store into evaluator
	 */
	private async restoreEvolutionHistory(): Promise<void> {
		if (!this.evaluator) return

		const records = await this.store.evolution.list()
		for (const record of records) {
			const decisions = record.decisions as Array<{
				action: string
				targets: string[]
				reasoning: string
			}>
			this.evaluator.restoreHistoryEntry({
				timestamp: new Date(record.created_at),
				decisions,
			})
		}
	}

	/**
	 * Generate learner configs from prompt via LLM
	 */
	private async generateLearnerConfigs() {
		return generate({
			model: this.state.models.init,
			prompt: rootDecompositionPrompt(this.prompt, Array.from(this.learnerTypes.values())),
			output: Output.object({ schema: brainDecompositionSchema }),
			repairSchema: brainDecompositionSchema,
		})
	}

	/**
	 * Create a learner from a generated config (factory — routes by config.type)
	 */
	async createLearnerFromConfig(
		config: GeneratedLearnerConfig & {
			thresholds?: { minImportance?: number; maxObservations?: number }
			health?: Partial<LearnerHealth>
		},
	): Promise<BaseLearner<unknown>> {
		const shared = {
			id: config.id,
			model: this.state.models.default,
			blueprintModel: this.state.models.blueprint,
			instructions: config.instructions,
			origin: 'prompt' as const,
			name: config.name,
			description: config.description,
			health: config.health,
			understand: {
				thresholds: {
					maxObservations: BRAIN_DEFAULTS.learning.understand.thresholds.maxObservations,
					maxTokens: BRAIN_DEFAULTS.learning.understand.thresholds.maxTokens,
					minImportance: BRAIN_DEFAULTS.learning.understand.thresholds.minImportance,
					...config.thresholds,
				},
			},
		}

		const descriptor = this.learnerTypes.get(config.type)
		if (!descriptor) {
			throw new Error(`Unknown learner type: ${config.type}`)
		}

		// Apply default governance for text learners if not provided
		const governance = config.type === 'text' && !config.governance
			? { strategy: BRAIN_DEFAULTS.learning.governance.strategy, maxTokens: BRAIN_DEFAULTS.learning.governance.maxTokens }
			: config.governance

		const learner = descriptor.factory({
			...shared,
			store: this.learnerStoreFactory(config.id),
			governance,
		})

		// Forward all learner events through Brain
		learner.on((event) => {
			this.emit(event.type as keyof BrainEventMap, event.payload as never)
		})

		// Forward learner:signal events to Evaluator (when implemented)
		learner.on('learner:signal', (event) => {
			// In Stage 2, this will forward to Evaluator
			// For now, just re-emit through Brain
			this.signal({
				source: event.learnerId,
				description: event.description,
			})
		})

		// Feed synthesis events to global injection understanding
		this.wireExternalLearnerSynthesisEvents(learner)

		// Initialize the learner (generates observe/synthesize prompts)
		await learner.init()

		this.learners.set(config.id, learner)
		this.learnerNames.set(config.id, config.name)

		// Persist learner ref (learner's own store has everything else)
		await this.store.learners.add({
			id: config.id,
			type: config.type,
		})

		this.emit('brain:learner:added', {
			learnerId: config.id,
			name: config.name,
			instructions: config.instructions,
		})

		return learner
	}

	/**
	 * Ensure Brain is initialized before operations
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}
	}

	/**
	 * Add a learner manually
	 */
	async addLearner(config: GeneratedLearnerConfig): Promise<BaseLearner<unknown>> {
		return this.createLearnerFromConfig(config)
	}

	/**
	 * Remove a learner (basic tier — no evolution required)
	 *
	 * Disposes learner store, removes from map, emits event.
	 */
	async removeLearner(id: string): Promise<void> {
		const learner = this.learners.get(id)
		if (!learner) {
			throw new Error(`Learner ${id} not found`)
		}
		await this.__removeLearner(id)
	}

	/**
	 * Adjust a learner's behavior (basic tier — no evolution required)
	 *
	 * Pass-through to learner.adjust(directive). Incrementally evolves
	 * the learner's instructions, prompts, and schemas.
	 */
	async adjustLearner(id: string, directive: string): Promise<BaseLearner<unknown>> {
		const learner = this.learners.get(id)
		if (!learner) {
			throw new Error(`Learner ${id} not found`)
		}
		await learner.adjust(directive)
		return learner
	}

	/**
	 * Get all learners
	 */
	getLearners(): BaseLearner<unknown>[] {
		return Array.from(this.learners.values())
	}

	/**
	 * Get a specific learner by ID
	 */
	getLearner(id: string): BaseLearner<unknown> | undefined {
		return this.learners.get(id)
	}

	/**
	 * Get a specific internal learner by ID
	 */
	getInternalLearner(id: string): BaseLearner<unknown> | undefined {
		return this.internalLearners.get(id)
	}

	/**
	 * Inject data into all learners
	 *
	 * Data is batched by batchSize and sent to ALL learners.
	 * Each learner processes independently and may further chunk by token limit.
	 */
	async inject(
		data: unknown | unknown[],
		options?: BrainInjectOptions,
	): Promise<BrainInjectResult> {
		await this.ensureInitialized()

		const injectId = options?.id ?? `inject_${nanoid()}`
		const items = Array.isArray(data) ? data : [data]
		const learnerArray = this.getLearners()

		// Split items into batches by batchSize
		const batchSize = this.state.ingest.batchSize
		const batches: unknown[][] = []
		for (let i = 0; i < items.length; i += batchSize) {
			batches.push(items.slice(i, i + batchSize))
		}

		this.emit('brain:inject:started', {
			injectId,
			itemCount: items.length,
			batchCount: batches.length,
		})

		try {
			// Process batches sequentially
			const batchResults: BrainInjectResult['batches'] = []
			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batch = batches[batchIndex]
				const batchId = `batch_${nanoid()}`

				this.emit('brain:inject:batch:started', {
					injectId,
					batchId,
					batchIndex,
					itemCount: batch.length,
				})

				// Send batch to all learners in parallel
				const learnerResults = await Promise.all(
					learnerArray.map(async (learner) => {
						const result = await learner.learn(batch)
						return {
							learnerId: learner.id,
							result,
						}
					}),
				)

				this.emit('brain:inject:batch:completed', {
					injectId,
					batchId,
					batchIndex,
					results: learnerResults,
				})

				// Check if all learners dismissed this batch
				await this.handleDismissedBatch(batchId, batch, learnerResults)

				batchResults.push({
					id: batchId,
					index: batchIndex,
					results: learnerResults,
				})
			}

			this.emit('brain:inject:completed', {
				injectId,
				batches: batchResults,
			})

			return { id: injectId, batches: batchResults }
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			this.emit('brain:inject:failed', { injectId, error: errorMessage })
			throw error
		}
	}

	/**
	 * Ask all learners and synthesize a unified response
	 *
	 * Query is sent to ALL learners. Responses are synthesized via LLM.
	 *
	 * @param query - The question to ask
	 * @param options - Optional generation options (temperature, etc.)
	 */
	async ask(
		query: string,
		options?: CallSettings & { model?: import('ai').LanguageModel },
	): Promise<BrainAskResult> {
		await this.ensureInitialized()

		const queryId = `query_${nanoid()}`
		this.emit('brain:ask:started', { queryId, query })

		try {
			const learnerArray = this.getLearners()

			// Skip learners with no understanding and no buffered observations
			const bufferStates = await Promise.all(
				learnerArray.map(async (l) => ({
					learner: l,
					buffer: await l.getBufferState(),
				})),
			)
			const queryableLearnerChecks = await Promise.all(
				bufferStates.map(async ({ learner, buffer }) => ({
					learner,
					hasKnowledge: !!(await learner.getUnderstanding()) || buffer.count > 0,
				})),
			)
			const queryableLearners = queryableLearnerChecks
				.filter(({ hasKnowledge }) => hasKnowledge)
				.map(({ learner }) => learner)

			// Query all learners in parallel
			const learnerResults = await Promise.all(
				queryableLearners.map(async (learner) => {
					const result = await learner.query(query, options)
					return {
						learnerId: learner.id,
						name: this.learnerNames.get(learner.id) ?? learner.id,
						relevant: result.relevant,
						relevance: result.relevance,
						confidence: result.confidence,
						insight: result.insight,
						gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
					}
				}),
			)

			// Check for coverage gaps
			this.checkCoverageGap(learnerResults)

			// Feed internal learners (fire-and-forget)
			this.feedAskToInternalLearners(query, learnerResults)

			this.emit('brain:ask:synthesis:started', {
				queryId,
				learnerResponses: learnerResults,
			})

			// Synthesize responses (with consult tools for internal learners)
			const { model: modelOverride, ...generateOptions } = options ?? {}
			const consultTools = await this.buildConsultTools()
			const result = await synthesize(
				modelOverride ?? this.state.models.query,
				{
					brainPrompt: this.prompt,
					query,
					responses: learnerResults,
					consultTools,
					...generateOptions,
				},
			)

			this.emit('brain:ask:completed', {
				queryId,
				insight: result.insight,
				sources: result.sources,
				gaps: result.gaps,
				usage: result.usage,
			})

			return {
				insight: result.insight,
				sources: result.sources,
				gaps: result.gaps,
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			this.emit('brain:ask:failed', { queryId, error: errorMessage })
			throw error
		}
	}

	/**
	 * Query internal learners for Brain's self-knowledge.
	 *
	 * @param query - Question to ask internal learners
	 * @param options - Optional: target a specific internal learner by ID
	 */
	async consult(query: string, options?: ConsultOptions): Promise<ConsultResult> {
		await this.ensureInitialized()

		// Target a specific internal learner
		if (options?.learner) {
			const learner = this.internalLearners.get(options.learner)
			if (!learner) {
				throw new Error(`Internal learner ${options.learner} not found`)
			}
			const result = await learner.query(query)
			return {
				insight: result.insight,
				sources: [{
					learnerId: learner.id,
					relevance: result.relevance,
					confidence: result.confidence,
					insight: result.insight,
				}],
				gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
			}
		}

		// Query all internal learners
		const learnerArray = Array.from(this.internalLearners.values())
		if (learnerArray.length === 0) {
			return { insight: '', sources: [], gaps: [] }
		}

		// Check which learners have knowledge
		const queryable = await Promise.all(
			learnerArray.map(async (l) => ({
				learner: l,
				hasKnowledge: await l.hasKnowledge(),
			})),
		)
		const withKnowledge = queryable.filter((q) => q.hasKnowledge).map((q) => q.learner)

		if (withKnowledge.length === 0) {
			return { insight: '', sources: [], gaps: [] }
		}

		// Query in parallel
		const responses = await Promise.all(
			withKnowledge.map(async (learner) => {
				const result = await learner.query(query)
				return {
					learnerId: learner.id,
					name: learner.name,
					relevant: result.relevant,
					relevance: result.relevance,
					confidence: result.confidence,
					insight: result.insight,
					gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
				}
			}),
		)

		// Synthesize
		const result = await synthesize(
			this.state.models.query,
			{
				brainPrompt: this.prompt,
				query,
				responses,
			},
		)

		return {
			insight: result.insight,
			sources: result.sources,
			gaps: result.gaps,
		}
	}

	/**
	 * Send a signal to the evolution system (Living Brain)
	 *
	 * @param signal - Signal with source and description
	 */
	signal(signal: { source: string; description: string; bypass?: boolean }): void {
		const signalEvent = {
			source: signal.source,
			description: signal.description,
			timestamp: new Date(),
			bypass: signal.bypass,
		}

		this.emit('brain:signal:received', signalEvent)

		// Forward to Evaluator
		if (this.evaluator) {
			this.evaluator.signal(signalEvent)
		}
	}

	/**
	 * Trigger evolution directly, bypassing the signal buffer.
	 * Sends the signal as a bypass signal to the evaluator for immediate evaluation.
	 */
	async triggerEvolution(signal: { source: string; description: string }): Promise<void> {
		if (!this.evaluator) return

		this.signal({
			source: signal.source,
			description: signal.description,
			bypass: true,
		})
	}

	/**
	 * Build consult tools for ask() synthesis — one tool per internal learner with knowledge.
	 */
	private async buildConsultTools(): Promise<Record<string, unknown> | undefined> {
		if (this.internalLearners.size === 0) return undefined

		const consultInputSchema = z.object({
			question: z.string().describe('The question to ask this knowledge source'),
		})

		const toolDefs: Array<{ id: string; name: string; description: string }> = [
			{
				id: INTERNAL_LEARNER_IDS.globalInjectionUnderstanding,
				name: 'consultGlobalUnderstanding',
				description: 'Query the system\'s cross-domain understanding of all ingested data. Use when the question spans multiple knowledge areas.',
			},
			{
				id: INTERNAL_LEARNER_IDS.globalQueryUnderstanding,
				name: 'consultQueryPatterns',
				description: 'Query patterns of what users have been asking. Use to understand query trends and topic clusters.',
			},
			{
				id: INTERNAL_LEARNER_IDS.injectionGaps,
				name: 'consultInjectionGaps',
				description: 'Query what topics have been consistently missed by the system. Use when asking about coverage gaps.',
			},
			{
				id: INTERNAL_LEARNER_IDS.queryGaps,
				name: 'consultQueryGaps',
				description: 'Query what questions the system has been unable to answer well. Use when asking about knowledge limitations.',
			},
		]

		const tools: Record<string, unknown> = {}

		// Only include tools for internal learners that have knowledge
		for (const def of toolDefs) {
			const learner = this.internalLearners.get(def.id)
			if (!learner) continue

			if (!(await learner.hasKnowledge())) continue

			tools[def.name] = tool({
				description: def.description,
				inputSchema: consultInputSchema,
				execute: async ({ question }: { question: string }) => {
					const result = await learner.query(question)
					return {
						relevant: result.relevant,
						insight: result.insight,
						gaps: result.gaps,
					}
				},
			})
		}

		return Object.keys(tools).length > 0 ? tools : undefined
	}

	/**
	 * Re-inject pending dismissed batches into newly created learners.
	 * If accepted → remove from buffer. If dismissed again → increment retryCount.
	 */
	private async reinjectDismissedBatches(newLearnerIds: string[]): Promise<void> {
		const pending = await this.store.dismissedBatches.list({ status: 'pending' })
		if (pending.length === 0) return

		const newLearners = newLearnerIds
			.map((id) => this.learners.get(id))
			.filter((l): l is BaseLearner<unknown> => l !== undefined)
		if (newLearners.length === 0) return

		const resolvedGaps: string[] = []

		for (const batch of pending) {
			const data = batch.data as unknown[]

			let accepted = false
			for (const learner of newLearners) {
				const result = await learner.learn(data)
				if (result.status !== 'observe:dismissed') {
					accepted = true
					break
				}
			}

			if (accepted) {
				await this.store.dismissedBatches.delete(batch.id)
				const gaps = batch.gaps as string[] | undefined
				if (gaps?.length) resolvedGaps.push(...gaps)
			} else {
				await this.store.dismissedBatches.update(batch.id, {
					retryCount: batch.retryCount + 1,
					status: 'retried',
				})
			}
		}

		// Notify gap learner that these gaps are now covered
		if (resolvedGaps.length > 0) {
			const gapLearner = this.internalLearners.get(INTERNAL_LEARNER_IDS.injectionGaps)
			if (gapLearner) {
				const resolvedText = `Gap resolved: new learner(s) created to cover previously dismissed topics. Now covered: ${resolvedGaps.join(', ')}.`
				gapLearner.learn([resolvedText]).catch((err) => {
					const msg = err instanceof Error ? err.message : String(err)
					console.error(`[internal-learner] gap resolution feed error:`, msg)
				})
			}
		}
	}

	/**
	 * Feed ask() data to internal learners.
	 * - Global query understanding always receives query data
	 * - Query gap learner receives when all responses have low relevance
	 */
	private async feedAskToInternalLearners(
		query: string,
		learnerResults: Array<{ learnerId: string; relevance: number; gaps: string[] }>,
	): Promise<void> {
		const now = new Date().toISOString()
		const { relevanceThreshold } = this.state.evolution.coverageGap

		// Feed global query understanding (every ask)
		const queryLearner = this.internalLearners.get(
			INTERNAL_LEARNER_IDS.globalQueryUnderstanding,
		)
		if (queryLearner) {
			const relevantLearners = learnerResults
				.filter((r) => r.relevance >= relevanceThreshold)
				.map((r) => r.learnerId)
			const allGaps = learnerResults.flatMap((r) => r.gaps)

			try {
				await queryLearner.learn([{
					question: query,
					relevantLearners,
					gaps: allGaps,
					timestamp: now,
				}])
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				console.error(`[internal-learner] query feed error:`, msg)
			}
		}

		// Feed query gap learner (only when all learners have low relevance)
		const allLowRelevance = learnerResults.every(
			(r) => r.relevance < relevanceThreshold,
		)
		if (allLowRelevance) {
			const gapLearner = this.internalLearners.get(
				INTERNAL_LEARNER_IDS.queryGaps,
			)
			if (gapLearner) {
				const allGaps = learnerResults.flatMap((r) => r.gaps)
				try {
					await gapLearner.learn([{
						question: query,
						gaps: allGaps,
						timestamp: now,
					}])
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					console.error(`[internal-learner] query gap feed error:`, msg)
				}
			}
		}
	}

	/**
	 * Wire an external learner's synthesis events to the global injection understanding learner.
	 * Feeds all synthesis events — the internal learner's observer decides relevance.
	 */
	private wireExternalLearnerSynthesisEvents(learner: BaseLearner<unknown>): void {
		learner.on('learner:synthesized', (event) => {
			const globalLearner = this.internalLearners.get(
				INTERNAL_LEARNER_IDS.globalInjectionUnderstanding,
			)
			if (!globalLearner) return

			globalLearner.learn([{
				learnerId: event.learnerId,
				summary: typeof event.newUnderstanding === 'string'
					? event.newUnderstanding.slice(0, 500)
					: JSON.stringify(event.newUnderstanding).slice(0, 500),
				significance: event.significance,
				evolution: event.evolution,
			}]).catch((err) => {
				console.error(`[internal-learner] feed error:`, err?.message ?? err)
			})
		})
	}

	/**
	 * Handle a batch that was dismissed by all external learners.
	 * Persists to dismissed batch buffer and feeds the injection gap learner.
	 */
	private async handleDismissedBatch(
		batchId: string,
		batch: unknown[],
		learnerResults: LearnerBatchResult[],
	): Promise<void> {
		const allDismissed = learnerResults.every(
			(r) => r.result.status === 'observe:dismissed',
		)
		if (!allDismissed) return

		// Collect gaps from all dismissals
		const gaps: string[] = []
		for (const r of learnerResults) {
			if (r.result.status === 'observe:dismissed' && r.result.gaps) {
				gaps.push(...r.result.gaps)
			}
		}

		const now = new Date().toISOString()

		// Persist dismissed batch
		await this.store.dismissedBatches.add({
			id: batchId,
			data: batch,
			gaps,
			timestamp: now,
			retryCount: 0,
			status: 'pending',
		})

		// Size-based eviction
		const count = await this.store.dismissedBatches.count()
		if (count > this.dismissedBatchMaxSize) {
			const all = await this.store.dismissedBatches.list()
			all.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
			const toEvict = all.slice(0, count - this.dismissedBatchMaxSize)
			for (const record of toEvict) {
				await this.store.dismissedBatches.delete(record.id)
			}
		}

		// Feed injection gap learner (awaited so observations are stored before we continue)
		const gapLearner = this.internalLearners.get(INTERNAL_LEARNER_IDS.injectionGaps)
		if (gapLearner) {
			try {
				const readableDate = new Date().toLocaleString('en-US', {
					month: 'long', day: 'numeric', year: 'numeric',
					hour: 'numeric', minute: '2-digit', hour12: true,
				})
				const gapText = gaps.length > 0
					? `[${readableDate}] Injection gap: all ${learnerResults.length} learner(s) dismissed incoming data. Topics not covered: ${gaps.join(', ')}.`
					: `[${readableDate}] Injection gap: all ${learnerResults.length} learner(s) dismissed incoming data. No learner matched this content.`
				await gapLearner.learn([gapText])
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				console.error(`[internal-learner] injection gap feed error:`, msg)
			}
		}

		// Trigger direct evolution with gap context
		this.triggerEvolution({
			source: 'brain:injection-gap',
			description: `All learners dismissed batch ${batchId}. Gaps: ${gaps.join('; ')}`,
		}).catch((err) => {
			const msg = err instanceof Error ? err.message : String(err)
			console.error(`[internal-learner] evolution trigger error:`, msg)
		})
	}

	/**
	 * Check for coverage gaps after ask() collects learner responses
	 */
	private checkCoverageGap(
		responses: Array<{ relevance: number }>,
	): void {
		if (!this.state.evolution.enabled) return

		const { relevanceThreshold, gapCountThreshold, windowSize } =
			this.state.evolution.coverageGap

		this.state.recentQueryCount++

		const allLowRelevance = responses.every(
			(r) => r.relevance < relevanceThreshold,
		)
		if (allLowRelevance) {
			this.state.coverageGapCount++
		}

		if (this.state.recentQueryCount >= windowSize) {
			if (this.state.coverageGapCount >= gapCountThreshold) {
				this.signal({
					source: 'brain',
					description: `Coverage gap: ${this.state.coverageGapCount} of last ${this.state.recentQueryCount} queries had no relevant learner`,
				})
			}
			this.state.coverageGapCount = 0
			this.state.recentQueryCount = 0
		}
	}

	/**
	 * Manually trigger evolution evaluation (Living Brain)
	 *
	 * Evaluates buffered signals and returns evolution decisions.
	 * Decisions are not automatically executed - use evolution action handlers for that.
	 *
	 * @returns Array of evolution decisions (empty if no changes needed)
	 * @throws Error if evolution is not enabled
	 */
	async evaluateEvolution(options?: { dryRun?: boolean; includeUnderstanding?: boolean }): Promise<{
		decisions: EvolutionDecision[]
		results: AggregatedEvolutionResult
	}> {
		if (!this.evaluator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		if (options?.includeUnderstanding !== undefined) {
			this.evaluator.includeUnderstanding = options.includeUnderstanding
		}

		const decisions = await this.evaluator.evaluate('manual')

		// In dryRun mode, return decisions without executing them
		if (options?.dryRun) {
			return {
				decisions,
				results: { created: [], updated: [], deleted: [], merged: [], split: [] },
			}
		}

		// Execute decisions automatically
		const results = await this.executeEvolutionDecisions(decisions)

		return { decisions, results }
	}

	/**
	 * Execute evolution decisions (private helper)
	 */
	private async executeEvolutionDecisions(
		decisions: EvolutionDecision[],
	): Promise<AggregatedEvolutionResult> {
		if (!this.evolutionOrchestrator) {
			throw new Error('Evolution orchestrator not initialized')
		}

		return this.evolutionOrchestrator.executeDecisions(decisions)
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Evolution Handler Helpers (internal, used by evolution action handlers)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Internal: Remove learner (used by evolution handlers)
	 * @internal
	 */
	async __removeLearner(learnerId: string): Promise<void> {
		const learner = this.learners.get(learnerId)
		if (learner) {
			await learner.dispose()
		}
		this.learners.delete(learnerId)
		this.learnerNames.delete(learnerId)
		await this.store.learners.delete(learnerId)
		this.emit('brain:learner:removed', { learnerId })
	}

	/**
	 * Internal: Emit evolution event (used by evolution handlers)
	 * @internal
	 */
	__emitEvolutionEvent(
		eventName: keyof BrainEventMap,
		payload: any,
	): void {
		this.emit(eventName as any, payload as never)
	}

	/**
	 * Internal: Update learner name in Brain's name map (used by evolution handlers)
	 * @internal
	 */
	__updateLearnerName(learnerId: string, newName: string): void {
		this.learnerNames.set(learnerId, newName)
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Manual Evolution API
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Create a new learner based on natural language guidance
	 *
	 * @param guidance - Natural language description of the learner to create
	 * @returns The newly created learner
	 * @throws If evolution is not enabled
	 *
	 * @example
	 * ```ts
	 * const learner = await brain.createLearner('Track API design patterns and best practices')
	 * ```
	 */
	async createLearner(guidance: string): Promise<BaseLearner<unknown>> {
		if (!this.evolutionOrchestrator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decision: EvolutionDecision = {
			action: EVOLUTION_ACTIONS.create,
			reasoning: 'Manual creation',
			guidance,
			targets: [],
		}

		const result = await this.evolutionOrchestrator.executeSingleDecision(
			decision,
		)
		const learnerId = result.newLearnerIds[0]
		return this.learners.get(learnerId)!
	}

	/**
	 * Merge multiple learners into a single unified learner
	 *
	 * @param learnerIds - IDs of learners to merge (minimum 2)
	 * @param guidance - Natural language description of how to merge
	 * @returns The newly created merged learner
	 * @throws If evolution is not enabled or learner IDs invalid
	 *
	 * @example
	 * ```ts
	 * const merged = await brain.mergeLearners(
	 *   ['learner1', 'learner2'],
	 *   'Combine into unified testing practices learner'
	 * )
	 * ```
	 */
	async mergeLearners(
		learnerIds: string[],
		guidance: string,
	): Promise<BaseLearner<unknown>> {
		if (!this.evolutionOrchestrator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decision: EvolutionDecision = {
			action: EVOLUTION_ACTIONS.merge,
			reasoning: 'Manual merge',
			guidance,
			targets: learnerIds,
		}

		const result = await this.evolutionOrchestrator.executeSingleDecision(
			decision,
		)
		const learnerId = result.newLearnerIds[0]
		return this.learners.get(learnerId)!
	}

	/**
	 * Split a learner into multiple focused learners
	 *
	 * @param learnerId - ID of learner to split
	 * @param guidance - Natural language description of how to split
	 * @returns Array of newly created split learners
	 * @throws If evolution is not enabled or learner ID invalid
	 *
	 * @example
	 * ```ts
	 * const learners = await brain.splitLearner(
	 *   'learner3',
	 *   'Split into frontend-focused and backend-focused learners'
	 * )
	 * ```
	 */
	async splitLearner(
		learnerId: string,
		guidance: string,
	): Promise<BaseLearner<unknown>[]> {
		if (!this.evolutionOrchestrator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decision: EvolutionDecision = {
			action: EVOLUTION_ACTIONS.split,
			reasoning: 'Manual split',
			guidance,
			targets: [learnerId],
		}

		const result = await this.evolutionOrchestrator.executeSingleDecision(
			decision,
		)
		return result.newLearnerIds.map((id: string) => this.learners.get(id)!)
	}

	/**
	 * Update a learner's configuration
	 *
	 * @param learnerId - ID of learner to update
	 * @param guidance - Natural language description of updates needed
	 * @returns The updated learner
	 * @throws If evolution is not enabled or learner ID invalid
	 *
	 * @example
	 * ```ts
	 * const learner = await brain.updateLearner(
	 *   'learner4',
	 *   'Narrow scope to focus only on React hooks, increase importance threshold'
	 * )
	 * ```
	 */
	async updateLearner(
		learnerId: string,
		guidance: string,
	): Promise<BaseLearner<unknown>> {
		if (!this.evolutionOrchestrator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decision: EvolutionDecision = {
			action: EVOLUTION_ACTIONS.update,
			reasoning: 'Manual update',
			guidance,
			targets: [learnerId],
		}

		await this.evolutionOrchestrator.executeSingleDecision(decision)
		return this.learners.get(learnerId)!
	}

	/**
	 * Delete a learner from the Brain
	 *
	 * @param learnerId - ID of learner to delete
	 * @throws If evolution is not enabled or learner ID invalid
	 *
	 * @example
	 * ```ts
	 * await brain.deleteLearner('learner5')
	 * ```
	 */
	async deleteLearner(learnerId: string): Promise<void> {
		if (!this.evolutionOrchestrator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decision: EvolutionDecision = {
			action: EVOLUTION_ACTIONS.delete,
			reasoning: 'Manual deletion',
			guidance: `Delete learner ${learnerId}`,
			targets: [learnerId],
		}

		await this.evolutionOrchestrator.executeSingleDecision(decision)
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Brain Configuration Update
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Update Brain configuration
	 *
	 * Accepts a partial of the constructor config. Each field is categorized by
	 * its downstream effect:
	 *
	 * 1. **Brain-only** — persisted to state, no downstream propagation
	 * 2. **Mechanical cascade** — forwarded to all learners via learner.update()
	 * 3. **Signal-driven** — semantic changes routed through the evaluator
	 *
	 * @param updates - Partial configuration updates (same shape as BrainConfig)
	 * @returns Result with changed fields, learner results, and evolution results
	 */
	async update(updates: Partial<BrainConfig>): Promise<BrainUpdateResult> {
		const changedFields: string[] = []
		const learnerResults: BrainUpdateResult['learnerResults'] = []
		let evolutionResults: BrainUpdateResult['evolutionResults'] | undefined
		const stateChanges: Partial<BrainState> = {}

		// ── 1. Collect brain-only state changes ──

		// Model slot changes
		let modelsChanged = false
		const newModels = { ...this.state.models }

		if (updates.init?.model !== undefined) {
			newModels.init = updates.init.model
			modelsChanged = true
			changedFields.push('init.model')
		}
		if (updates.query?.model !== undefined) {
			newModels.query = updates.query.model
			modelsChanged = true
			changedFields.push('query.model')
		}
		if (updates.model !== undefined) {
			newModels.default = updates.model
			modelsChanged = true
			changedFields.push('model')
		}
		if (updates.blueprintModel !== undefined) {
			newModels.blueprint = updates.blueprintModel
			modelsChanged = true
			changedFields.push('blueprintModel')
		}
		if (modelsChanged) {
			stateChanges.models = newModels
		}

		if (updates.ingest?.batchSize !== undefined) {
			stateChanges.ingest = { batchSize: updates.ingest.batchSize }
			changedFields.push('ingest.batchSize')
		}

		// Evolution config
		if (updates.evolution) {
			const evo = { ...this.state.evolution }
			let evoChanged = false

			if (
				updates.evolution.enabled !== undefined &&
				updates.evolution.enabled !== this.state.evolution.enabled
			) {
				evo.enabled = updates.evolution.enabled
				evoChanged = true
				changedFields.push('evolution.enabled')
			}

			if (
				updates.evolution.evaluatorSignalThreshold !== undefined &&
				updates.evolution.evaluatorSignalThreshold !==
					this.state.evolution.evaluatorSignalThreshold
			) {
				evo.evaluatorSignalThreshold = updates.evolution.evaluatorSignalThreshold
				evoChanged = true
				changedFields.push('evolution.evaluatorSignalThreshold')
			}

			if (
				updates.evolution.autoEvaluate !== undefined &&
				updates.evolution.autoEvaluate !== this.state.evolution.autoEvaluate
			) {
				evo.autoEvaluate = updates.evolution.autoEvaluate
				evoChanged = true
				changedFields.push('evolution.autoEvaluate')
			}

			if (evoChanged) {
				stateChanges.evolution = evo
			}
		}

		// Prompt (capture old value before applying)
		const semanticChanges: string[] = []

		if (updates.prompt !== undefined && updates.prompt !== this.state.prompt) {
			const oldPrompt = this.state.prompt
			stateChanges.prompt = updates.prompt
			changedFields.push('prompt')
			semanticChanges.push(
				`Brain purpose has been updated by the user.\n` +
				`Previous purpose: ${oldPrompt}\n` +
				`New purpose: ${updates.prompt}\n\n` +
				`IMPORTANT: This update does NOT necessarily mean all existing learners should be deleted and recreated. ` +
				`Consider the relationship between the old and new purpose:\n` +
				`- If the new purpose is a REFINEMENT or NARROWING of the old one, ADJUST existing learners to match.\n` +
				`- If the new purpose OVERLAPS with the old one, keep learners whose knowledge is still relevant (check "What it has learned so far"), adjust their instructions, and only create new ones for gaps.\n` +
				`- If the new purpose ADDS a new dimension, create new learners for the new area while keeping existing ones.\n` +
				`- Only DELETE a learner if its accumulated knowledge is genuinely irrelevant to the new purpose.\n` +
				`- Prefer ADJUST over DELETE+CREATE — adjusting preserves accumulated understanding, deleting destroys it.`
			)
		}

		// ── Apply all state changes ──

		if (Object.keys(stateChanges).length > 0) {
			await this.setState(stateChanges)
		}

		// ── Side effects after state applied ──

		if (
			changedFields.includes('evolution.enabled') &&
			this.state.evolution.enabled && !this.evaluator && this.initialized
		) {
			this.initEvolution()
		}

		if (changedFields.includes('evolution.evaluatorSignalThreshold') && this.evaluator) {
			this.evaluator = new Evaluator(
				this,
				this.state.evolution.evaluatorSignalThreshold,
			)
			this.evaluator.on((event) => {
				this.emit(event.type as keyof BrainEventMap, event.payload as never)
			})
		}

		// ── 2. Mechanical cascade to learners ──

		const learnerUpdate: Record<string, unknown> = {}

		if (updates.model !== undefined) {
			learnerUpdate.model = updates.model
		}
		if (updates.blueprintModel !== undefined) {
			learnerUpdate.blueprintModel = updates.blueprintModel
		}

		// Map learning.* mechanical fields to learnerUpdate shape
		if (updates.learning?.model) learnerUpdate.model ??= updates.learning.model
		if (updates.learning?.blueprintModel) learnerUpdate.blueprintModel ??= updates.learning.blueprintModel
		if (updates.learning?.observer) {
			learnerUpdate.observer = updates.learning.observer
		}
		if (updates.learning?.understand) {
			const s = updates.learning.understand
			learnerUpdate.understand = {
				...(s.model ? { model: s.model } : {}),
				...(s.blueprintModel ? { blueprintModel: s.blueprintModel } : {}),
				...(s.thresholds ? { thresholds: s.thresholds } : {}),
			}
		}
		if (updates.learning?.query) {
			learnerUpdate.query = updates.learning.query
		}
		if (updates.learning?.governance) {
			learnerUpdate.governance = updates.learning.governance
		}

		// Forward to all learners (each ignores fields it doesn't recognize)
		if (Object.keys(learnerUpdate).length > 0) {
			for (const learner of this.learners.values()) {
				const result = await learner.update(learnerUpdate)
				learnerResults.push({ learnerId: learner.id, changedFields: result.changedFields })
			}
		}

		// ── 3. Signal-driven (semantic changes) ──

		if (updates.learning?.instructions) {
			semanticChanges.push(`Learner instructions update requested: ${updates.learning.instructions}`)
		}
		if (updates.learning?.name) {
			semanticChanges.push(`Learner name update requested: ${updates.learning.name}`)
		}
		if (updates.learning?.description) {
			semanticChanges.push(`Learner description update requested: ${updates.learning.description}`)
		}

		if (semanticChanges.length > 0) {
			this.signal({
				source: 'brain',
				description: `SYSTEM DIRECTIVE: ${semanticChanges.join('\n\n')}`,
				bypass: true,
			})

			// Await full evaluation + execution
			if (this.evaluator) {
				const { decisions, results } = await this.evaluateEvolution()
				evolutionResults = {
					decisions,
					...results,
				}
			}
		}

		// ── 4. Emit event ──

		if (changedFields.length > 0) {
			this.emit('brain:config:updated', { updates, changedFields })
		}

		return {
			changedFields,
			config: this.config,
			learnerResults,
			evolutionResults,
		}
	}

	/**
	 * Dispose Brain: disposes all learners and the brain store
	 */
	async dispose(): Promise<void> {
		for (const learner of this.learners.values()) {
			await learner.dispose()
		}
		for (const learner of this.internalLearners.values()) {
			await learner.dispose()
		}
		this.learners.clear()
		this.internalLearners.clear()
		this.learnerNames.clear()
		await this.store.dispose()
	}
}
