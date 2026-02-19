/**
 * ListDefaultMethod — list-specific learning method
 *
 * Extends BaseLearningMethod with list-specific observe/synthesize
 * implementations and mechanical governance (dedup/pruning).
 */

import type { LanguageModel } from 'ai'
import { BaseLearningMethod } from '../../../base/learning-method'
import type {
	ObserveCallResult,
	SynthesizeCallResult,
} from '../../../base/learning-method'
import type { ListItem, ResolvedListGovernanceConfig } from '../../types'
import { applyListGovernance } from '../../governance'
import { initObserve, observe } from './observe'
import { initSynthesize, synthesize } from './synthesize'
import type { SynthesizeIdentity } from './synthesize'

export interface ListDefaultConfig {
	observe: {
		model: LanguageModel
		blueprintModel: LanguageModel
	}
	synthesize: {
		model: LanguageModel
		blueprintModel: LanguageModel
		thresholds: Required<import('../../../base/learning-method').SynthesizeThresholds>
	}
	governance: ResolvedListGovernanceConfig
}

export class ListDefaultMethod extends BaseLearningMethod<ListDefaultConfig> {
	readonly name = 'list-default'

	get observeIdentity() {
		return this._observeIdentity
	}

	get synthesizeIdentity() {
		return this._synthesizeIdentity as SynthesizeIdentity | null
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
		const result = await initSynthesize(model, instructions)
		this._synthesizeIdentity = result.identity
		// Mark as initialized — actual prompt is generated per synthesize call
		this.synthesizeSystemPrompt = '(list-synthesize: identity initialized)'
	}

	protected async callObserve(
		model: LanguageModel,
		systemPrompt: string,
		data: unknown[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<ObserveCallResult> {
		return observe(
			model,
			systemPrompt,
			{ learnerId: this.learnerId, instructions: this.instructions, data },
			callbacks,
		)
	}

	protected async callSynthesize(
		model: LanguageModel,
		understanding: unknown,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<SynthesizeCallResult> {
		const result = await synthesize(
			model,
			this._synthesizeIdentity as SynthesizeIdentity,
			{
				learnerId: this.learnerId,
				instructions: this.instructions,
				currentItems: understanding as ListItem[],
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
			newUnderstanding: result.newItems,
			significance: result.significance,
			evolution: result.evolution,
			reasoning: result.reasoning,
			usage: result.usage,
		}
	}

	protected postProcessSynthesis(raw: unknown): unknown {
		return applyListGovernance(
			raw as ListItem[],
			this.config.governance,
		)
	}

	// ── Lifecycle hooks ───────────────────────────────────────────────────

	protected handleTypeSpecificConfigUpdate(
		config: Record<string, unknown>,
		changedFields: string[],
	): { needsSynthesizeRegen: boolean } {
		if (config.governance) {
			Object.assign(this.config.governance, config.governance)
			changedFields.push('governance')
		}
		return { needsSynthesizeRegen: false }
	}

	protected isReadyForLearn(): boolean {
		return (
			this.observeSystemPrompt !== null &&
			this._synthesizeIdentity !== null
		)
	}
}
