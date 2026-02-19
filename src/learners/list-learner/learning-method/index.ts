/**
 * ListDefaultMethod — list-specific learning method
 *
 * Orchestrates observe → buffer → synthesize → governance flow.
 * Observe extracts discrete items/entities as text observations.
 * Synthesize produces structured operations (add/update/remove).
 * Governance applies mechanical dedup/pruning post-synthesis.
 * Implements the shared LearningMethod interface.
 */

import type { LanguageModel } from 'ai'
import type { SynthesizeThresholds } from '../../base/learning-method'
import { ObservationBuffer } from '../../base/learning-method'
import type {
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	LearningMethod,
} from '../../base/learning-method'
import type { ListItem, ResolvedListGovernanceConfig } from '../types'
import { applyListGovernance } from '../governance'
import { initObserve, observe } from './observe'
import type { ObserveIdentity } from './observe'
import {
	initSynthesize,
	synthesize,
} from './synthesize'
import type { SynthesizeIdentity } from './synthesize'

export interface ListDefaultConfig {
	observe: {
		model: LanguageModel
		blueprintModel: LanguageModel
	}
	synthesize: {
		model: LanguageModel
		blueprintModel: LanguageModel
		thresholds: Required<SynthesizeThresholds>
	}
	governance: ResolvedListGovernanceConfig
}

export class ListDefaultMethod implements LearningMethod {
	readonly name = 'list-default'

	private model: LanguageModel
	private config: ListDefaultConfig
	private buffer: ObservationBuffer
	private instructions: string = ''
	private focus: string = ''

	// Generated during init
	private _observeIdentity: ObserveIdentity | null = null
	private _synthesizeIdentity: SynthesizeIdentity | null = null
	private observeSystemPrompt: string | null = null
	// synthesizeSystemPrompt is dynamically generated (includes current items)
	private synthesizeSystemPrompt: string | null = null

	constructor(model: LanguageModel, config: ListDefaultConfig) {
		this.model = model
		this.config = config
		this.buffer = new ObservationBuffer()
	}

	get observePrompt(): string | null {
		return this.observeSystemPrompt
	}

	get synthesizePrompt(): string | null {
		// Return a marker — actual prompt is generated per-call with current items
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
			const obs = config.observe as Partial<ListDefaultConfig['observe']>
			if (obs.model !== undefined) {
				this.config.observe.model = obs.model
				changedFields.push('observe.model')
			}
			if (obs.blueprintModel !== undefined) {
				this.config.observe.blueprintModel = obs.blueprintModel
				changedFields.push('observe.blueprintModel')
				needsObserveRegen = true
			}
		}

		if (config.synthesize) {
			const syn = config.synthesize as Partial<ListDefaultConfig['synthesize']>
			if (syn.model !== undefined) {
				this.config.synthesize.model = syn.model
				changedFields.push('synthesize.model')
			}
			if (syn.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel = syn.blueprintModel
				changedFields.push('synthesize.blueprintModel')
				needsSynthesizeRegen = true
			}
			if (syn.thresholds !== undefined) {
				Object.assign(this.config.synthesize.thresholds, syn.thresholds)
				changedFields.push('synthesize.thresholds')
			}
		}

		if (config.governance) {
			Object.assign(
				this.config.governance,
				config.governance,
			)
			changedFields.push('governance')
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

			if (needsSynthesizeRegen) {
				promises.push(
					initSynthesize(
						synthesizeBlueprintModel,
						this.instructions,
					).then((result) => {
						this._synthesizeIdentity = result.identity
						// Mark as initialized — actual prompt is generated per synthesize call
						this.synthesizeSystemPrompt = '(list-synthesize: identity initialized)'
					}),
				)
			}

			await Promise.all(promises)
		}

		return { changedFields, promptsRegenerated }
	}

	async learn(
		learnerId: string,
		instructions: string,
		currentUnderstanding: unknown,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		if (!this.observeSystemPrompt || !this._synthesizeIdentity) {
			throw new Error(
				'ListDefaultMethod not initialized. Call init() first.',
			)
		}

		const currentItems = currentUnderstanding as ListItem[]
		const observeModel = this.config.observe.model ?? this.model
		const synthesizeModel = this.config.synthesize.model ?? this.model

		// Handle forceSynthesize with empty data
		if (options?.forceSynthesize && data.length === 0 && this.buffer.count > 0) {
			const observations = this.buffer.getTexts()
			const synthesizeResult = await synthesize(
				synthesizeModel,
				this._synthesizeIdentity,
				{
					learnerId,
					instructions,
					currentItems,
					observations,
				},
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
				newUnderstanding: applyListGovernance(
					synthesizeResult.newItems,
					this.config.governance,
				),
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
		const observations = this.buffer.getTexts()
		callbacks?.onSynthesizeStarted?.(observations.length)
		const synthesizeResult = await synthesize(
			synthesizeModel,
			this._synthesizeIdentity,
			{ learnerId, instructions, currentItems, observations },
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
			newUnderstanding: applyListGovernance(
				synthesizeResult.newItems,
				this.config.governance,
			),
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
}
