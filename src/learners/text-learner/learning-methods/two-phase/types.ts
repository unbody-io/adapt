/**
 * Types for the TextDefaultMethod (text-specific two-phase learning)
 *
 * Shared types (LearnOutput, LearnOptions, LearnCallbacks, SynthesizeThresholds)
 * live in base/learning-method. This file defines text-specific config.
 */

import type { LanguageModel } from 'ai'
import type { MaintenanceConfig } from '../../strategies'

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
 * Configuration for observe phase
 */
export interface ObserveConfig {
	method: 'direct'
	model?: LanguageModel
	blueprintModel?: LanguageModel
}

/**
 * Configuration for synthesize phase
 */
export interface SynthesizeConfig {
	method: 'direct'
	model?: LanguageModel
	blueprintModel?: LanguageModel
	thresholds: import('../../../base/learning-method').SynthesizeThresholds
}

/**
 * Configuration for TextDefaultMethod
 */
export interface TextDefaultConfig {
	observe: ObserveConfig
	synthesize: SynthesizeConfig
	maintenance: MaintenanceConfig
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
	maintenance?: Partial<MaintenanceConfig>
}

/**
 * Result from TextDefaultMethod.update()
 */
export interface TextDefaultUpdateResult {
	changedFields: string[]
	promptsRegenerated: boolean
}
