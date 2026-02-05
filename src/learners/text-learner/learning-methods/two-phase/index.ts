/**
 * Two-phase learning method
 *
 * Separates observation (capture) from synthesis (understanding update).
 * This reduces understanding degradation by only rewriting during synthesis.
 */

import type { LanguageModel } from 'ai'
import { ObservationBuffer } from './buffer'
import { initObserve, observe } from './observe'
import type { ObserveIdentity } from './observe/schema.identity'
import { initSynthesize, synthesize } from './synthesize'
import type { SynthesizeIdentity } from './synthesize/schema.identity'
import type {
	InitOutput,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	TwoPhaseConfig,
	TwoPhaseUpdateConfig,
	TwoPhaseUpdateResult,
} from './types'

/**
 * Two-phase learning method
 *
 * Orchestrates observe → buffer → synthesize flow.
 */
export class TwoPhaseMethod {
	readonly name = 'two-phase'

	private model: LanguageModel
	private config: TwoPhaseConfig
	private buffer: ObservationBuffer
	private instructions: string = ''

	// Generated during init (identities stored for potential debugging/introspection)
	private _observeIdentity: ObserveIdentity | null = null
	private _synthesizeIdentity: SynthesizeIdentity | null = null
	private observeSystemPrompt: string | null = null
	private synthesizeSystemPrompt: string | null = null

	constructor(model: LanguageModel, config: TwoPhaseConfig) {
		this.model = model
		this.config = config
		this.buffer = new ObservationBuffer()
	}

	/**
	 * Get observe system prompt (null if not initialized)
	 */
	get observePrompt(): string | null {
		return this.observeSystemPrompt
	}

	/**
	 * Get synthesize system prompt (null if not initialized)
	 */
	get synthesizePrompt(): string | null {
		return this.synthesizeSystemPrompt
	}

	/**
	 * Get observe identity (for debugging/introspection)
	 */
	get observeIdentity(): ObserveIdentity | null {
		return this._observeIdentity
	}

	/**
	 * Get synthesize identity (for debugging/introspection)
	 */
	get synthesizeIdentity(): SynthesizeIdentity | null {
		return this._synthesizeIdentity
	}

	/**
	 * Initialize the two-phase method
	 *
	 * Generates identities and system prompts for both phases.
	 * Delegates to update() internally.
	 *
	 * @param instructions - Learner's purpose/instructions
	 */
	async init(instructions: string): Promise<InitOutput> {
		await this.update({ instructions })

		return {
			observeSystemPrompt: this.observeSystemPrompt!,
			synthesizeSystemPrompt: this.synthesizeSystemPrompt!,
		}
	}

	/**
	 * Update config with dependency-driven re-derivation
	 *
	 * Raw constants (models, thresholds) are stored immediately.
	 * Derived values (prompts/identity) are re-generated when their
	 * inputs change (instructions, blueprintModel, strategy).
	 * If prompts are null (first init), regeneration is forced.
	 */
	async update(config: TwoPhaseUpdateConfig): Promise<TwoPhaseUpdateResult> {
		const changedFields: string[] = []
		let needsObserveRegen = false
		let needsSynthesizeRegen = false

		// Default model swap
		if (config.model !== undefined) {
			this.model = config.model
			changedFields.push('model')
		}

		// Instructions change → both prompts need regen
		if (config.instructions !== undefined && config.instructions !== this.instructions) {
			this.instructions = config.instructions
			changedFields.push('instructions')
			needsObserveRegen = true
			needsSynthesizeRegen = true
		}

		// Observe config updates
		if (config.observe) {
			if (config.observe.model !== undefined) {
				this.config.observe.model = config.observe.model
				changedFields.push('observe.model')
			}
			if (config.observe.blueprintModel !== undefined) {
				this.config.observe.blueprintModel = config.observe.blueprintModel
				changedFields.push('observe.blueprintModel')
				needsObserveRegen = true
			}
		}

		// Synthesize config updates
		if (config.synthesize) {
			if (config.synthesize.model !== undefined) {
				this.config.synthesize.model = config.synthesize.model
				changedFields.push('synthesize.model')
			}
			if (config.synthesize.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel = config.synthesize.blueprintModel
				changedFields.push('synthesize.blueprintModel')
				needsSynthesizeRegen = true
			}
			if (config.synthesize.thresholds !== undefined) {
				Object.assign(this.config.synthesize.thresholds, config.synthesize.thresholds)
				changedFields.push('synthesize.thresholds')
			}
		}

		// Strategy change → synthesize prompt needs regen
		if (config.strategy !== undefined && config.strategy !== this.config.strategy) {
			this.config.strategy = config.strategy
			changedFields.push('strategy')
			needsSynthesizeRegen = true
		}

		// Force regen if prompts don't exist yet (first init)
		if (this.observeSystemPrompt === null) needsObserveRegen = true
		if (this.synthesizeSystemPrompt === null) needsSynthesizeRegen = true

		const promptsRegenerated = needsObserveRegen || needsSynthesizeRegen

		if (promptsRegenerated) {
			const observeBlueprintModel = this.config.observe.blueprintModel ?? this.model
			const synthesizeBlueprintModel = this.config.synthesize.blueprintModel ?? this.model

			const promises: Promise<void>[] = []

			if (needsObserveRegen) {
				promises.push(
					initObserve(observeBlueprintModel, this.instructions).then((result) => {
						this._observeIdentity = result.identity
						this.observeSystemPrompt = result.systemPrompt
					}),
				)
			}

			if (needsSynthesizeRegen) {
				promises.push(
					initSynthesize(synthesizeBlueprintModel, this.instructions, this.config.strategy).then((result) => {
						this._synthesizeIdentity = result.identity
						this.synthesizeSystemPrompt = result.systemPrompt
					}),
				)
			}

			await Promise.all(promises)
		}

		return { changedFields, promptsRegenerated }
	}

	/**
	 * Learn from data
	 *
	 * Observes data, buffers observations, and synthesizes when thresholds met.
	 *
	 * @param learnerId - Learner's unique identifier
	 * @param instructions - Learner's purpose/instructions
	 * @param currentUnderstanding - Current understanding
	 * @param data - Data to learn from
	 * @param options - Learn options (forceSynthesize, etc.)
	 * @param callbacks - Callbacks for observability
	 */
	async learn(
		learnerId: string,
		instructions: string,
		currentUnderstanding: string,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		if (!this.observeSystemPrompt || !this.synthesizeSystemPrompt) {
			throw new Error('TwoPhaseMethod not initialized. Call init() first.')
		}

		const observeModel = this.config.observe.model ?? this.model
		const synthesizeModel = this.config.synthesize.model ?? this.model

		// Handle forceSynthesize with empty data — skip observe, go straight to synthesis
		if (
			options?.forceSynthesize &&
			data.length === 0 &&
			this.buffer.count > 0
		) {
			const observations = this.buffer.getTexts()
			const synthesizeResult = await synthesize(
				synthesizeModel,
				this.synthesizeSystemPrompt,
				{ learnerId, instructions, currentUnderstanding, observations },
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
				newUnderstanding: synthesizeResult.newUnderstanding,
				significance: synthesizeResult.significance,
				evolution: synthesizeResult.evolution,
				reasoning: synthesizeResult.reasoning,
				usage: synthesizeResult.usage,
			}
		}

		// Phase 1: Observe
		callbacks?.onObserveStarted?.(data.length)
		const observeResult = await observe(
			observeModel,
			this.observeSystemPrompt,
			{ learnerId, instructions, data },
			{ onThinking: callbacks?.onObserveThinking },
		)

		// Handle observe outcomes
		if (observeResult.status === 'error') {
			return {
				status: 'observe:error',
				error: observeResult.error,
			}
		}

		if (observeResult.status === 'dismissed') {
			return {
				status: 'observe:dismissed',
				output: observeResult.output,
				usage: observeResult.usage,
			}
		}

		// Buffer the observation
		this.buffer.add({
			text: observeResult.output,
			importance: observeResult.importance,
		})

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
		const observations = this.buffer.getTexts()
		callbacks?.onSynthesizeStarted?.(observations.length)
		const synthesizeResult = await synthesize(
			synthesizeModel,
			this.synthesizeSystemPrompt,
			{ learnerId, instructions, currentUnderstanding, observations },
			{ onThinking: callbacks?.onSynthesizeThinking },
		)

		// Clear buffer after synthesis
		this.buffer.clear()

		// Handle synthesize outcomes
		if (synthesizeResult.status === 'error') {
			return {
				status: 'synthesize:error',
				error: synthesizeResult.error,
			}
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
			newUnderstanding: synthesizeResult.newUnderstanding,
			significance: synthesizeResult.significance,
			evolution: synthesizeResult.evolution,
			reasoning: synthesizeResult.reasoning,
			usage: synthesizeResult.usage,
		}
	}

	/**
	 * Get current buffer state (for debugging/observability)
	 */
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

	/**
	 * Get all buffered observations (for debugging/observability)
	 */
	getBufferedObservations(): Array<{ text: string; importance: number }> {
		return this.buffer.getAll()
	}
}

export type { ObserveIdentity } from './observe/schema.identity'

export type { ObserveContext, ObserveOutput } from './observe/types'
export type { SynthesizeIdentity } from './synthesize/schema.identity'
export type { SynthesizeContext, SynthesizeOutput } from './synthesize/types'
// Re-export types
export type {
	InitOutput,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
	TwoPhaseConfig,
	TwoPhaseUpdateConfig,
	TwoPhaseUpdateResult,
} from './types'
