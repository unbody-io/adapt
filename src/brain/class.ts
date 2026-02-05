import type { CallSettings } from 'ai'
import { nanoid } from 'nanoid'
import {
	type GeneratedLearnerConfig,
	type LearnerGovernance,
	TextLearner,
	type TokenUsage,
} from '../learners'
import { generate, Output } from '../llm'
import { TypedEmitter } from '../types/events'
import { synthesize } from './agent'
import { resolveBrainConfig } from './config.resolver'
import { Evaluator } from './evaluator/class'
import { EVOLUTION_ACTIONS, type EvolutionDecision } from './evaluator/types'
import { EvolutionOrchestrator } from './evolution/orchestrator'
import { rootDecompositionPrompt } from './prompts/prompt.template.root-decomposition'
import { brainDecompositionSchema } from './schemas/schema.brain-decomposition'
import type {
	BrainAskResult,
	BrainConfig,
	BrainEventMap,
	BrainInjectOptions,
	BrainInjectResult,
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
	readonly learners: Map<string, TextLearner> = new Map()
	private learnerNames: Map<string, string> = new Map()
	private initialized = false
	private evaluator?: Evaluator
	private evolutionOrchestrator?: EvolutionOrchestrator

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
		})
	}

	/**
	 * Create a TextLearner from a generated config
	 */
	async createLearnerFromConfig(
		config: GeneratedLearnerConfig & {
			thresholds?: { minImportance?: number; maxObservations?: number }
			governance?: Partial<LearnerGovernance>
		},
	): Promise<TextLearner> {
		const { learning } = this.config

		const learner = new TextLearner(
			{
				id: config.id,
				model: learning.model,
				blueprintModel: learning.blueprintModel,
				instructions: config.instructions,
				origin: 'prompt',
				maintenance: config.maintenance,
				observe: {
					model: learning.observe.model,
					blueprintModel: learning.observe.blueprintModel,
				},
				synthesize: {
					model: learning.synthesize.model,
					blueprintModel: learning.synthesize.blueprintModel,
					thresholds: {
						...learning.synthesize.thresholds,
						...config.thresholds,
					},
				},
				query: {
					model: learning.query.model,
					method: learning.query.method,
				},
				name: config.name,
				description: config.description,
				governance: config.governance,
			} as any,
		)

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
	async addLearner(config: GeneratedLearnerConfig): Promise<TextLearner> {
		return this.createLearnerFromConfig(config)
	}

	/**
	 * Get all learners
	 */
	getLearners(): TextLearner[] {
		return Array.from(this.learners.values())
	}

	/**
	 * Get a specific learner by ID
	 */
	getLearner(id: string): TextLearner | undefined {
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

			// Query all learners in parallel
			const learnerResults = await Promise.all(
				learnerArray.map(async (learner) => {
					const result = await learner.query(query, options)
					return {
						learnerId: learner.id,
						name: this.learnerNames.get(learner.id) ?? learner.id,
						relevant: result.relevant,
						confidence: result.confidence,
						insight: result.insight,
						gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
					}
				}),
			)

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
	signal(signal: { source: string; description: string }): void {
		const signalEvent = {
			source: signal.source,
			description: signal.description,
			timestamp: new Date(),
		}

		this.emit('brain:signal:received', signalEvent)

		// Forward to Evaluator
		if (this.evaluator) {
			this.evaluator.signal(signalEvent)
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
	async evaluateEvolution(): Promise<EvolutionDecision[]> {
		if (!this.evaluator) {
			throw new Error(
				'Evolution is not enabled. Set config.evolution.enabled = true',
			)
		}

		const decisions = await this.evaluator.evaluate()

		// Execute decisions automatically
		await this.executeEvolutionDecisions(decisions)

		return decisions
	}

	/**
	 * Execute evolution decisions (private helper)
	 */
	private async executeEvolutionDecisions(
		decisions: EvolutionDecision[],
	): Promise<void> {
		if (!this.evolutionOrchestrator) {
			throw new Error('Evolution orchestrator not initialized')
		}

		await this.evolutionOrchestrator.executeDecisions(decisions)
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
	async createLearner(guidance: string): Promise<TextLearner> {
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
	): Promise<TextLearner> {
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
	): Promise<TextLearner[]> {
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
	): Promise<TextLearner> {
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
	 * Supports updating:
	 * - prompt: Brain's purpose (triggers authoritative signal for evolution)
	 * - model: Default LLM for all operations
	 * - blueprintModel: Blueprint LLM for all operations
	 * - evolution: Evolution system configuration (enabled, thresholds, autoEvaluate)
	 *
	 * @param updates - Partial configuration updates
	 *
	 * @example
	 * ```ts
	 * // Update prompt (triggers evolution to adapt learners)
	 * await brain.update({
	 *   prompt: 'Track software architecture patterns AND deployment strategies'
	 * })
	 *
	 * // Update models
	 * await brain.update({
	 *   model: newModel,
	 *   blueprintModel: newBlueprintModel
	 * })
	 *
	 * // Toggle evolution features
	 * await brain.update({
	 *   evolution: {
	 *     enabled: false,
	 *     autoEvaluate: false
	 *   }
	 * })
	 * ```
	 */
	async update(updates: {
		prompt?: string
		model?: import('ai').LanguageModel
		blueprintModel?: import('ai').LanguageModel
		evolution?: {
			enabled?: boolean
			evaluatorSignalThreshold?: number
			autoEvaluate?: boolean
		}
	}): Promise<void> {
		const appliedUpdates: typeof updates = {}

		// Handle prompt update with authoritative signal
		if (updates.prompt !== undefined && updates.prompt !== this.prompt) {
			const oldPrompt = this.prompt
			this.prompt = updates.prompt
			this.config.prompt = updates.prompt
			appliedUpdates.prompt = updates.prompt

			// Emit authoritative signal to trigger learner adaptation
			this.signal({
				source: 'brain',
				description: `SYSTEM DIRECTIVE: Brain purpose has been updated.

Old purpose: ${oldPrompt}

New purpose: ${updates.prompt}

Required action: Analyze current learner coverage against the new purpose. Generate decisions to align all learners with the updated requirements. This may require creating new learners, updating existing ones, merging overlapping responsibilities, or splitting overly broad learners to match the new structure.

This is a system-level directive and should be prioritized over organic signals.`,
			})
		}

		// Update model (default LLM)
		if (updates.model !== undefined && updates.model !== this.config.model) {
			this.config.model = updates.model
			this.config.learning.model = updates.model
			appliedUpdates.model = updates.model
		}

		// Update blueprintModel
		if (
			updates.blueprintModel !== undefined &&
			updates.blueprintModel !== this.config.blueprintModel
		) {
			this.config.blueprintModel = updates.blueprintModel
			this.config.learning.blueprintModel = updates.blueprintModel
			appliedUpdates.blueprintModel = updates.blueprintModel
		}

		// Update evolution config
		if (updates.evolution) {
			const evolutionUpdates: typeof updates.evolution = {}

			if (
				updates.evolution.enabled !== undefined &&
				updates.evolution.enabled !== this.config.evolution.enabled
			) {
				this.config.evolution.enabled = updates.evolution.enabled
				evolutionUpdates.enabled = updates.evolution.enabled

				// If enabling evolution and not initialized, initialize evaluator
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
				evolutionUpdates.evaluatorSignalThreshold =
					updates.evolution.evaluatorSignalThreshold

				// Update existing evaluator threshold if it exists
				if (this.evaluator) {
					// Evaluator stores threshold internally - would need to expose setter
					// For now, recreate evaluator with new threshold
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
				evolutionUpdates.autoEvaluate = updates.evolution.autoEvaluate
			}

			if (Object.keys(evolutionUpdates).length > 0) {
				appliedUpdates.evolution = evolutionUpdates
			}
		}

		// Emit brain:config:updated event if any changes were made
		if (Object.keys(appliedUpdates).length > 0) {
			this.emit('brain:config:updated', {
				updates: appliedUpdates,
			})
		}
	}
}
