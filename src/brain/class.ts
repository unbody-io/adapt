import type { CallSettings } from 'ai'
import { nanoid } from 'nanoid'
import {
	BaseLearner,
	type GeneratedLearnerConfig,
	type LearnerHealth,
	ListLearner,
	TextLearner,
	type TokenUsage,
} from '../learners'
import { generate, Output } from '../llm'
import { TypedEmitter } from '../types/events'
import { synthesize } from './agent'
import { BRAIN_DEFAULTS } from './config.defaults'
import { resolveBrainConfig } from './config.resolver'
import { Evaluator } from './evaluator/class'
import { EVOLUTION_ACTIONS, type EvolutionDecision } from './evaluator/types'
import { EvolutionOrchestrator } from './evolution/orchestrator'
import type { AggregatedEvolutionResult } from './evolution/types'
import { rootDecompositionPrompt } from './prompts/prompt.template.root-decomposition'
import { brainDecompositionSchema } from './schemas/schema.brain-decomposition'
import type {
	BrainAskResult,
	BrainConfig,
	BrainEventMap,
	BrainInjectOptions,
	BrainInjectResult,
	BrainUpdateResult,
	ResolvedBrainConfig,
} from './types'

/**
 * Brain - A learning system that auto-generates and coordinates multiple learners
 *
 * Brain takes a natural language prompt and decomposes it into specialized learners.
 * Data injection routes to all learners, and queries synthesize responses from all learners.
 *
 * Emits events for all operations and forwards learner events.
 */
export class Brain extends TypedEmitter<BrainEventMap> {
	prompt: string
	readonly config: ResolvedBrainConfig
	readonly learners: Map<string, BaseLearner<unknown>> = new Map()
	private learnerNames: Map<string, string> = new Map()
	private initialized = false
	private evaluator?: Evaluator
	private evolutionOrchestrator?: EvolutionOrchestrator

	// Coverage gap tracking
	private coverageGapCount = 0
	private recentQueryCount = 0

	constructor(rawConfig: BrainConfig) {
		super()
		this.config = resolveBrainConfig(rawConfig)
		this.prompt = this.config.prompt
	}

	/**
	 * Explicitly initialize the Brain (parse prompt and generate learners)
	 * Called automatically on first inject() or ask() if not called explicitly.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		this.emit('brain:init:started', {})

		try {
			this.emit('brain:init:config:generating', {})

			// Try to generate learner configs, with JSON repair fallback
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
				await this.createLearnerFromConfig(config)
			}

			// Initialize Evaluator and EvolutionOrchestrator if evolution is enabled
			if (this.config.evolution.enabled) {
				this.evaluator = new Evaluator(
					this,
					this.config.evolution.evaluatorSignalThreshold,
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
			}

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
	 * Generate learner configs from prompt via LLM
	 */
	private async generateLearnerConfigs() {
		return generate({
			model: this.config.init.model,
			prompt: rootDecompositionPrompt(this.prompt),
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
			model: this.config.model,
			blueprintModel: this.config.blueprintModel,
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

		let learner: BaseLearner<unknown>

		if (config.type === 'list') {
			learner = new ListLearner({
				...shared,
				governance: config.governance,
			})
		} else {
			learner = new TextLearner({
				...shared,
				governance: config.governance ?? {
					strategy: BRAIN_DEFAULTS.learning.governance.strategy,
					maxTokens: BRAIN_DEFAULTS.learning.governance.maxTokens,
				},
			} as any)
		}

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

		// Initialize the learner (generates observe/synthesize prompts)
		await learner.init()

		this.learners.set(config.id, learner)
		this.learnerNames.set(config.id, config.name)

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
		const batchSize = this.config.ingest.batchSize
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
			const queryableLearners = bufferStates
				.filter(({ learner, buffer }) => {
					return !!learner.getUnderstanding() || buffer.count > 0
				})
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

			this.emit('brain:ask:synthesis:started', {
				queryId,
				learnerResponses: learnerResults,
			})

			// Synthesize responses
			const { model: modelOverride, ...generateOptions } = options ?? {}
			const result = await synthesize(
				modelOverride ?? this.config.query.model,
				{
					brainPrompt: this.prompt,
					query,
					responses: learnerResults,
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
	 * Check for coverage gaps after ask() collects learner responses
	 */
	private checkCoverageGap(
		responses: Array<{ relevance: number }>,
	): void {
		if (!this.config.evolution.enabled) return

		const { relevanceThreshold, gapCountThreshold, windowSize } =
			this.config.evolution.coverageGap

		this.recentQueryCount++

		const allLowRelevance = responses.every(
			(r) => r.relevance < relevanceThreshold,
		)
		if (allLowRelevance) {
			this.coverageGapCount++
		}

		if (this.recentQueryCount >= windowSize) {
			if (this.coverageGapCount >= gapCountThreshold) {
				this.signal({
					source: 'brain',
					description: `Coverage gap: ${this.coverageGapCount} of last ${this.recentQueryCount} queries had no relevant learner`,
				})
			}
			this.coverageGapCount = 0
			this.recentQueryCount = 0
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
	__removeLearner(learnerId: string): void {
		this.learners.delete(learnerId)
		this.learnerNames.delete(learnerId)
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
	 * 1. **Brain-only** — stored on this.config, no downstream propagation
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

		// ── 1. Brain-only fields ──

		if (updates.init?.model !== undefined) {
			this.config.init.model = updates.init.model
			changedFields.push('init.model')
		}
		if (updates.query?.model !== undefined) {
			this.config.query.model = updates.query.model
			changedFields.push('query.model')
		}
		if (updates.ingest?.batchSize !== undefined) {
			this.config.ingest.batchSize = updates.ingest.batchSize
			changedFields.push('ingest.batchSize')
		}

		// Evolution config
		if (updates.evolution) {
			if (
				updates.evolution.enabled !== undefined &&
				updates.evolution.enabled !== this.config.evolution.enabled
			) {
				this.config.evolution.enabled = updates.evolution.enabled
				changedFields.push('evolution.enabled')

				if (updates.evolution.enabled && !this.evaluator && this.initialized) {
					this.evaluator = new Evaluator(
						this,
						this.config.evolution.evaluatorSignalThreshold,
					)
					this.evaluator.on((event) => {
						this.emit(event.type as keyof BrainEventMap, event.payload as never)
					})
					this.evolutionOrchestrator = new EvolutionOrchestrator(this)
				}
			}

			if (
				updates.evolution.evaluatorSignalThreshold !== undefined &&
				updates.evolution.evaluatorSignalThreshold !==
					this.config.evolution.evaluatorSignalThreshold
			) {
				this.config.evolution.evaluatorSignalThreshold =
					updates.evolution.evaluatorSignalThreshold
				changedFields.push('evolution.evaluatorSignalThreshold')

				if (this.evaluator) {
					this.evaluator = new Evaluator(
						this,
						updates.evolution.evaluatorSignalThreshold,
					)
					this.evaluator.on((event) => {
						this.emit(event.type as keyof BrainEventMap, event.payload as never)
					})
				}
			}

			if (
				updates.evolution.autoEvaluate !== undefined &&
				updates.evolution.autoEvaluate !== this.config.evolution.autoEvaluate
			) {
				this.config.evolution.autoEvaluate = updates.evolution.autoEvaluate
				changedFields.push('evolution.autoEvaluate')
			}
		}

		// ── 2. Mechanical cascade to learners ──

		// Shared learner update — each learner's update() picks up what it recognizes
		const learnerUpdate: Record<string, unknown> = {}

		if (updates.model !== undefined) {
			this.config.model = updates.model
			changedFields.push('model')
			learnerUpdate.model = updates.model
		}
		if (updates.blueprintModel !== undefined) {
			this.config.blueprintModel = updates.blueprintModel
			changedFields.push('blueprintModel')
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
			const m = updates.learning.governance
			learnerUpdate.governance = {
				...(m.strategy ? { strategy: m.strategy } : {}),
				...(m.maxTokens !== undefined ? { maxTokens: m.maxTokens } : {}),
			}
		}

		// Forward to all learners (each ignores fields it doesn't recognize)
		if (Object.keys(learnerUpdate).length > 0) {
			for (const learner of this.learners.values()) {
				const result = await learner.update(learnerUpdate as any)
				learnerResults.push({ learnerId: learner.id, changedFields: result.changedFields })
			}
		}

		// ── 3. Signal-driven (semantic changes) ──

		const semanticChanges: string[] = []

		if (updates.prompt !== undefined && updates.prompt !== this.prompt) {
			const oldPrompt = this.prompt
			this.prompt = updates.prompt
			this.config.prompt = updates.prompt
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
			config: { ...this.config },
			learnerResults,
			evolutionResults,
		}
	}
}
