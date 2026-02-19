/**
 * BaseLearningMethod — abstract base for all learning method variants
 *
 * Owns the shared observe → buffer → synthesize pipeline orchestration.
 * Subclasses provide 7 hooks for type-specific behavior:
 *
 * Init:   regenObserve, regenSynthesize
 * Learn:  callObserve, callSynthesize, postProcessSynthesis
 * Config: handleTypeSpecificConfigUpdate, isReadyForLearn
 */

import type { LanguageModel } from 'ai'
import { ObservationBuffer } from './buffer'
import type {
	BaseLearningMethodConfig,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	LearningMethod,
	ObserveCallResult,
	SynthesizeCallResult,
} from './types'

export abstract class BaseLearningMethod<
	TConfig extends BaseLearningMethodConfig,
> implements LearningMethod
{
	abstract readonly name: string

	protected model: LanguageModel
	protected config: TConfig
	protected buffer: ObservationBuffer
	protected learnerId: string = ''
	protected instructions: string = ''
	protected focus: string = ''

	protected _observeIdentity: unknown = null
	protected _synthesizeIdentity: unknown = null
	protected observeSystemPrompt: string | null = null
	protected synthesizeSystemPrompt: string | null = null

	constructor(model: LanguageModel, config: TConfig) {
		this.model = model
		this.config = config
		this.buffer = new ObservationBuffer()
	}

	// ── Getters (LearningMethod interface) ────────────────────────────────

	get observePrompt(): string | null {
		return this.observeSystemPrompt
	}

	get synthesizePrompt(): string | null {
		return this.synthesizeSystemPrompt
	}

	// ── Init ──────────────────────────────────────────────────────────────

	async init(instructions: string, focus?: string) {
		await this.update({ instructions, focus })
		return {
			observeSystemPrompt: this.observeSystemPrompt!,
			synthesizeSystemPrompt: this.synthesizeSystemPrompt!,
		}
	}

	// ── Update ────────────────────────────────────────────────────────────

	async update(
		config: Record<string, unknown>,
	): Promise<{ changedFields: string[]; promptsRegenerated: boolean }> {
		const changedFields: string[] = []
		let needsObserveRegen = false
		let needsSynthesizeRegen = false

		if (config.model !== undefined) {
			this.model = config.model as LanguageModel
			changedFields.push('model')
		}

		if (
			config.instructions !== undefined &&
			config.instructions !== this.instructions
		) {
			this.instructions = config.instructions as string
			changedFields.push('instructions')
			needsObserveRegen = true
			needsSynthesizeRegen = true
		}

		if (config.focus !== undefined && config.focus !== this.focus) {
			this.focus = config.focus as string
			changedFields.push('focus')
			needsObserveRegen = true
		}

		if (config.observe) {
			const obs = config.observe as Partial<TConfig['observe']>
			if (obs.model !== undefined) {
				this.config.observe.model = obs.model!
				changedFields.push('observe.model')
			}
			if (obs.blueprintModel !== undefined) {
				this.config.observe.blueprintModel = obs.blueprintModel!
				changedFields.push('observe.blueprintModel')
				needsObserveRegen = true
			}
		}

		if (config.synthesize) {
			const syn = config.synthesize as Partial<TConfig['synthesize']>
			if (syn.model !== undefined) {
				this.config.synthesize.model = syn.model!
				changedFields.push('synthesize.model')
			}
			if (syn.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel = syn.blueprintModel!
				changedFields.push('synthesize.blueprintModel')
				needsSynthesizeRegen = true
			}
			if (syn.thresholds !== undefined) {
				Object.assign(this.config.synthesize.thresholds, syn.thresholds)
				changedFields.push('synthesize.thresholds')
			}
		}

		// Type-specific config (e.g. governance fields)
		const typeResult = this.handleTypeSpecificConfigUpdate(
			config,
			changedFields,
		)
		if (typeResult.needsSynthesizeRegen) {
			needsSynthesizeRegen = true
		}

		// Force regen if prompts don't exist yet (first init)
		if (this.observeSystemPrompt === null) needsObserveRegen = true
		if (this.synthesizeSystemPrompt === null) needsSynthesizeRegen = true

		const promptsRegenerated = needsObserveRegen || needsSynthesizeRegen

		if (promptsRegenerated) {
			const observeBlueprintModel =
				this.config.observe.blueprintModel ?? this.model
			const synthesizeBlueprintModel =
				this.config.synthesize.blueprintModel ?? this.model

			const promises: Promise<void>[] = []

			if (needsObserveRegen) {
				promises.push(
					this.regenObserve(
						observeBlueprintModel,
						this.instructions,
						this.focus || undefined,
					).then((result) => {
						this._observeIdentity = result.identity
						this.observeSystemPrompt = result.systemPrompt
					}),
				)
			}

			if (needsSynthesizeRegen) {
				promises.push(
					this.regenSynthesize(
						synthesizeBlueprintModel,
						this.instructions,
					),
				)
			}

			await Promise.all(promises)
		}

		return { changedFields, promptsRegenerated }
	}

	// ── Learn ─────────────────────────────────────────────────────────────

	async learn(
		learnerId: string,
		_instructions: string,
		currentUnderstanding: unknown,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		if (!this.isReadyForLearn()) {
			throw new Error(
				`${this.name} not initialized. Call init() first.`,
			)
		}

		this.learnerId = learnerId
		const observeModel = this.config.observe.model ?? this.model
		const synthesizeModel = this.config.synthesize.model ?? this.model

		// Handle forceSynthesize with empty data
		if (
			options?.forceSynthesize &&
			data.length === 0 &&
			this.buffer.count > 0
		) {
			return this.synthesizeFromBuffer(
				synthesizeModel,
				currentUnderstanding,
				callbacks,
			)
		}

		// Phase 1: Observe
		callbacks?.onObserveStarted?.(data.length)
		const observeResult = await this.callObserve(
			observeModel,
			this.observeSystemPrompt!,
			data,
			{ onThinking: callbacks?.onObserveThinking },
		)

		if (observeResult.status === 'error') {
			return { status: 'observe:error', error: observeResult.error }
		}

		if (observeResult.status === 'dismissed') {
			return {
				status: 'observe:dismissed',
				output: observeResult.output,
				usage: observeResult.usage,
			}
		}

		// Filter by importance threshold
		const minImportance =
			this.config.synthesize.thresholds.minImportance
		if (
			minImportance !== undefined &&
			observeResult.importance < minImportance
		) {
			return {
				status: 'observe:dismissed',
				output: observeResult.output,
				usage: observeResult.usage,
			}
		}

		// Buffer observations
		for (const text of observeResult.output) {
			this.buffer.add({ text, importance: observeResult.importance })
		}

		// Check if synthesis should happen
		const shouldSynthesize =
			options?.forceSynthesize ||
			this.buffer.shouldSynthesize(this.config.synthesize.thresholds)

		if (!shouldSynthesize) {
			return {
				status: 'observed',
				output: observeResult.output,
				usage: observeResult.usage,
			}
		}

		// Phase 2: Synthesize
		return this.synthesizeFromBuffer(
			synthesizeModel,
			currentUnderstanding,
			callbacks,
		)
	}

	// ── Buffer access ─────────────────────────────────────────────────────

	getBufferState(): {
		count: number
		avgImportance: number
		totalTokens: number
	} {
		return {
			count: this.buffer.count,
			avgImportance: this.buffer.avgImportance,
			totalTokens: this.buffer.totalTokens,
		}
	}

	getBufferedObservations(): Array<{ text: string; importance: number }> {
		return this.buffer.getAll()
	}

	// ── Private helpers ───────────────────────────────────────────────────

	private async synthesizeFromBuffer(
		model: LanguageModel,
		currentUnderstanding: unknown,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		const observations = this.buffer.getTexts()
		callbacks?.onSynthesizeStarted?.(observations.length)

		const synthesizeResult = await this.callSynthesize(
			model,
			currentUnderstanding,
			observations,
			{ onThinking: callbacks?.onSynthesizeThinking },
		)

		this.buffer.clear()

		if (synthesizeResult.status === 'error') {
			return { status: 'synthesize:error', error: synthesizeResult.error }
		}

		if (synthesizeResult.status === 'dismissed') {
			return {
				status: 'synthesize:dismissed',
				output: synthesizeResult.output,
				usage: synthesizeResult.usage,
			}
		}

		return {
			status: 'synthesized',
			newUnderstanding: await this.postProcessSynthesis(
				synthesizeResult.newUnderstanding,
			),
			significance: synthesizeResult.significance,
			evolution: synthesizeResult.evolution,
			reasoning: synthesizeResult.reasoning,
			usage: synthesizeResult.usage,
		}
	}

	// ── Abstract hooks — subclass implements ──────────────────────────────

	/** Generate observe identity + system prompt */
	protected abstract regenObserve(
		model: LanguageModel,
		instructions: string,
		focus?: string,
	): Promise<{ identity: unknown; systemPrompt: string }>

	/** Generate synthesize identity + prompt (stores result internally) */
	protected abstract regenSynthesize(
		model: LanguageModel,
		instructions: string,
	): Promise<void>

	/** Execute the observe phase */
	protected abstract callObserve(
		model: LanguageModel,
		systemPrompt: string,
		data: unknown[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<ObserveCallResult>

	/** Execute the synthesize phase */
	protected abstract callSynthesize(
		model: LanguageModel,
		understanding: unknown,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<SynthesizeCallResult>

	/** Transform raw synthesis output (e.g. apply strategy, dedup, pruning) */
	protected abstract postProcessSynthesis(
		raw: unknown,
	): unknown | Promise<unknown>

	/** Handle type-specific config fields during update */
	protected abstract handleTypeSpecificConfigUpdate(
		config: Record<string, unknown>,
		changedFields: string[],
	): { needsSynthesizeRegen: boolean }

	/** Check if this method is initialized and ready to learn */
	protected abstract isReadyForLearn(): boolean
}
