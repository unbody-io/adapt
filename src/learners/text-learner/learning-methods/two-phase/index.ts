/**
 * TextDefaultMethod — text-specific two-phase learning
 *
 * Orchestrates observe → buffer → synthesize flow.
 * Strategy application is internal — returns post-strategy understanding.
 * Implements the shared LearningMethod interface.
 */

import type { LanguageModel } from 'ai'
import { ObservationBuffer } from '../../../base/learning-method'
import type {
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	LearningMethod,
} from '../../../base/learning-method'
import { applyStrategy } from '../../strategies'
import { initObserve, observe } from './observe'
import type { ObserveIdentity } from './observe/schema.identity'
import { initSynthesize, synthesize } from './synthesize'
import type { SynthesizeIdentity } from './synthesize/schema.identity'
import type {
	TextDefaultConfig,
	TextDefaultUpdateConfig,
	TextDefaultUpdateResult,
} from './types'

export class TextDefaultMethod implements LearningMethod {
	readonly name = 'text-default'

	private model: LanguageModel
	private config: TextDefaultConfig
	private buffer: ObservationBuffer
	private instructions: string = ''
	private focus: string = ''

	// Generated during init
	private _observeIdentity: ObserveIdentity | null = null
	private _synthesizeIdentity: SynthesizeIdentity | null = null
	private observeSystemPrompt: string | null = null
	private synthesizeSystemPrompt: string | null = null

	constructor(model: LanguageModel, config: TextDefaultConfig) {
		this.model = model
		this.config = config
		this.buffer = new ObservationBuffer()
	}

	get observePrompt(): string | null {
		return this.observeSystemPrompt
	}

	get synthesizePrompt(): string | null {
		return this.synthesizeSystemPrompt
	}

	get observeIdentity(): ObserveIdentity | null {
		return this._observeIdentity
	}

	get synthesizeIdentity(): SynthesizeIdentity | null {
		return this._synthesizeIdentity
	}

	async init(instructions: string, focus?: string) {
		await this.update({ instructions, focus })
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
	async update(config: TextDefaultUpdateConfig): Promise<TextDefaultUpdateResult> {
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

		// Focus change → observe prompt needs regen
		if (config.focus !== undefined && config.focus !== this.focus) {
			this.focus = config.focus
			changedFields.push('focus')
			needsObserveRegen = true
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

		// Governance updates
		if (config.governance) {
			if (config.governance.strategy !== undefined && config.governance.strategy !== this.config.governance.strategy) {
				this.config.governance.strategy = config.governance.strategy
				changedFields.push('governance.strategy')
				needsSynthesizeRegen = true
			}
			if (config.governance.maxTokens !== undefined) {
				this.config.governance.maxTokens = config.governance.maxTokens
				changedFields.push('governance.maxTokens')
			}
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
					initObserve(observeBlueprintModel, this.instructions, this.focus || undefined).then((result) => {
						this._observeIdentity = result.identity
						this.observeSystemPrompt = result.systemPrompt
					}),
				)
			}

			if (needsSynthesizeRegen) {
				promises.push(
					initSynthesize(synthesizeBlueprintModel, this.instructions, this.config.governance.strategy).then((result) => {
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
	 * Observes data, buffers observations, synthesizes when thresholds met,
	 * and applies strategy maintenance to the resulting understanding.
	 */
	async learn(
		learnerId: string,
		instructions: string,
		currentUnderstanding: unknown,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		if (!this.observeSystemPrompt || !this.synthesizeSystemPrompt) {
			throw new Error('TextDefaultMethod not initialized. Call init() first.')
		}

		const understanding = currentUnderstanding as string
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
				{ learnerId, instructions, currentUnderstanding: understanding, observations },
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
				newUnderstanding: await this.applyGovernanceStrategy(synthesizeResult.newUnderstanding),
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
		const minImportance = this.config.synthesize.thresholds.minImportance
		if (minImportance !== undefined && observeResult.importance < minImportance) {
			return {
				status: 'observe:dismissed',
				output: observeResult.output,
				usage: observeResult.usage,
			}
		}

		// Buffer each observation
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
		const observations = this.buffer.getTexts()
		callbacks?.onSynthesizeStarted?.(observations.length)
		const synthesizeResult = await synthesize(
			synthesizeModel,
			this.synthesizeSystemPrompt,
			{ learnerId, instructions, currentUnderstanding: understanding, observations },
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
			newUnderstanding: await this.applyGovernanceStrategy(synthesizeResult.newUnderstanding),
			significance: synthesizeResult.significance,
			evolution: synthesizeResult.evolution,
			reasoning: synthesizeResult.reasoning,
			usage: synthesizeResult.usage,
		}
	}

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

	/**
	 * Apply strategy-specific governance to post-synthesis understanding
	 */
	private async applyGovernanceStrategy(understanding: string): Promise<string> {
		const result = await applyStrategy({
			understanding,
			model: this.model,
			config: this.config.governance,
		})
		return result.understanding
	}
}

export type { ObserveIdentity } from './observe/schema.identity'
export type { ObserveContext, ObserveOutput } from './observe/types'
export type { SynthesizeIdentity } from './synthesize/schema.identity'
export type { SynthesizeContext, SynthesizeOutput } from './synthesize/types'
export type {
	ObserveConfig,
	ResolvedGovernanceConfig,
	ResolvedObserveConfig,
	ResolvedSynthesizeConfig,
	SynthesizeConfig,
	TextDefaultConfig,
	TextDefaultUpdateConfig,
	TextDefaultUpdateResult,
} from './types'
// Re-export shared types
export type {
	InitOutput,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	SynthesizeThresholds,
} from './types'
