/**
 * Types for the TextDefaultMethod (text-specific two-phase learning)
 *
 * Shared types (LearnOutput, LearnOptions, LearnCallbacks, SynthesizeThresholds)
 * live in base/learning-method. This file defines text-specific config.
 */

import type { LanguageModel } from 'ai'
import type { SynthesizeThresholds } from '../../../base/learning-method'
import type { GovernanceConfig, Strategy } from '../../strategies'

// Re-export shared types from base for backwards compat
export type {
	InitOutput,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	SynthesizeThresholds,
	Usage,
} from '../../../base/learning-method'

// Re-export phase types
export type {
	ObserveCallbacks,
	ObserveContext,
	ObserveOutput,
} from './observe/types'
export type {
	SynthesizeCallbacks,
	SynthesizeContext,
	SynthesizeOutput,
} from './synthesize/types'

/**
 * Configuration for observe phase (input — optional models)
 */
export interface ObserveConfig {
	method: 'direct'
	model?: LanguageModel
	blueprintModel?: LanguageModel
}

/**
 * Resolved observe config (all fields required)
 */
export interface ResolvedObserveConfig {
	method: 'direct'
	model: LanguageModel
	blueprintModel: LanguageModel
}

/**
 * Configuration for synthesize phase (input — optional models)
 */
export interface SynthesizeConfig {
	method: 'direct'
	model?: LanguageModel
	blueprintModel?: LanguageModel
	thresholds: SynthesizeThresholds
}

/**
 * Resolved synthesize config (all fields required)
 */
export interface ResolvedSynthesizeConfig {
	method: 'direct'
	model: LanguageModel
	blueprintModel: LanguageModel
	thresholds: Required<SynthesizeThresholds>
}

/**
 * Resolved governance config (all fields required)
 */
export interface ResolvedGovernanceConfig {
	strategy: Strategy
	maxTokens: number
}

/**
 * Configuration for TextDefaultMethod (resolved — ready to use)
 */
export interface TextDefaultConfig {
	observe: ResolvedObserveConfig
	synthesize: ResolvedSynthesizeConfig
	governance: ResolvedGovernanceConfig
}

/**
 * Config accepted by TextDefaultMethod.update()
 */
export interface TextDefaultUpdateConfig {
	model?: LanguageModel
	instructions?: string
	focus?: string
	observe?: Partial<ObserveConfig>
	synthesize?: Partial<SynthesizeConfig>
	governance?: Partial<GovernanceConfig>
}

/**
 * Result from TextDefaultMethod.update()
 */
export interface TextDefaultUpdateResult {
	changedFields: string[]
	promptsRegenerated: boolean
}
