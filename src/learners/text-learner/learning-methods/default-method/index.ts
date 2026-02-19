/**
 * TextDefaultMethod — text-specific default learning method
 *
 * Extends BaseLearningMethod with text-specific observe/synthesize
 * implementations and strategy-based post-synthesis governance.
 */

import type { LanguageModel } from 'ai'
import { BaseLearningMethod } from '../../../base/learning-method'
import type {
	ObserveCallResult,
	SynthesizeCallResult,
} from '../../../base/learning-method'
import { applyStrategy } from '../../strategies'
import { initObserve, observe } from './observe'
import { initSynthesize, synthesize } from './synthesize'
import type { TextDefaultConfig } from './types'

export class TextDefaultMethod extends BaseLearningMethod<TextDefaultConfig> {
	readonly name = 'text-default'

	get observeIdentity() {
		return this._observeIdentity
	}

	get synthesizeIdentity() {
		return this._synthesizeIdentity
	}

	// ── Pipeline hooks ────────────────────────────────────────────────────

	protected async regenObserve(
		model: LanguageModel,
		instructions: string,
		focus?: string,
	) {
		return initObserve(model, instructions, focus)
	}

	protected async regenSynthesize(
		model: LanguageModel,
		instructions: string,
	) {
		const result = await initSynthesize(
			model,
			instructions,
			this.config.governance.strategy,
		)
		this._synthesizeIdentity = result.identity
		this.synthesizeSystemPrompt = result.systemPrompt
	}

	protected async callObserve(
		model: LanguageModel,
		systemPrompt: string,
		data: unknown[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<ObserveCallResult> {
		return observe(model, systemPrompt, { learnerId: this.learnerId, instructions: this.instructions, data }, callbacks)
	}

	protected async callSynthesize(
		model: LanguageModel,
		understanding: unknown,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<SynthesizeCallResult> {
		const result = await synthesize(
			model,
			this.synthesizeSystemPrompt!,
			{
				learnerId: this.learnerId,
				instructions: this.instructions,
				currentUnderstanding: understanding as string,
				observations,
			},
			callbacks,
		)

		if (result.status === 'error') {
			return { status: 'error', error: result.error }
		}
		if (result.status === 'dismissed') {
			return { status: 'dismissed', output: result.output, usage: result.usage }
		}
		return {
			status: 'synthesized',
			newUnderstanding: result.newUnderstanding,
			significance: result.significance,
			evolution: result.evolution,
			reasoning: result.reasoning,
			usage: result.usage,
		}
	}

	protected async postProcessSynthesis(raw: unknown): Promise<unknown> {
		const result = await applyStrategy({
			understanding: raw as string,
			model: this.model,
			config: this.config.governance,
		})
		return result.understanding
	}

	// ── Lifecycle hooks ───────────────────────────────────────────────────

	protected handleTypeSpecificConfigUpdate(
		config: Record<string, unknown>,
		changedFields: string[],
	): { needsSynthesizeRegen: boolean } {
		let needsSynthesizeRegen = false
		const governance = config.governance as
			| Partial<TextDefaultConfig['governance']>
			| undefined

		if (governance) {
			if (
				governance.strategy !== undefined &&
				governance.strategy !== this.config.governance.strategy
			) {
				this.config.governance.strategy = governance.strategy
				changedFields.push('governance.strategy')
				needsSynthesizeRegen = true
			}
			if (governance.maxTokens !== undefined) {
				this.config.governance.maxTokens = governance.maxTokens
				changedFields.push('governance.maxTokens')
			}
		}

		return { needsSynthesizeRegen }
	}

	protected isReadyForLearn(): boolean {
		return (
			this.observeSystemPrompt !== null &&
			this.synthesizeSystemPrompt !== null
		)
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
