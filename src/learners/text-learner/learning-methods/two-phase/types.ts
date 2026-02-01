/**
 * Types for the two-phase learning method
 *
 * Two-phase learning separates observation (capture) from synthesis (understanding update).
 * This reduces understanding degradation by only rewriting during synthesis.
 */

import type { LanguageModel } from 'ai'
import type { Significance } from '../../../types'
import type { Strategy } from '../../strategies'

// Re-export phase types
export type { ObserveOutput, ObserveContext, ObserveCallbacks } from './observe/types'
export type { SynthesizeOutput, SynthesizeContext, SynthesizeCallbacks } from './synthesize/types'

/**
 * Output from learn() - discriminated union of all possible outcomes
 */
export type LearnOutput =
	// Observe outcomes
	| { status: 'observed'; output: string }
	| { status: 'observe:dismissed'; output: string }
	| { status: 'observe:error'; error: unknown }
	// Synthesize outcomes
	| {
			status: 'synthesized'
			newUnderstanding: string
			significance: Significance
			evolution: string
			reasoning?: string
	  }
	| { status: 'synthesize:dismissed'; output: string }
	| { status: 'synthesize:error'; error: unknown }

/**
 * Thresholds that trigger synthesis
 *
 * Synthesis is triggered when any threshold is met.
 */
export interface SynthesizeThresholds {
	/** Maximum number of observations before synthesis */
	maxObservations?: number
	/** Maximum total tokens in buffer before synthesis */
	maxTokens?: number
	/** Minimum average importance to trigger early synthesis */
	minImportance?: number
}

/**
 * Configuration for observe phase
 */
export interface ObserveConfig {
	/** Method to use (currently only 'direct' supported) */
	method: 'direct'
	/** Optional model override for observe phase */
	model?: LanguageModel
}

/**
 * Configuration for synthesize phase
 */
export interface SynthesizeConfig {
	/** Method to use (currently only 'direct' supported) */
	method: 'direct'
	/** Optional model override for synthesize phase */
	model?: LanguageModel
	/** Thresholds that trigger synthesis */
	thresholds: SynthesizeThresholds
}

/**
 * Configuration for two-phase learning method
 */
export interface TwoPhaseConfig {
	/** Observe phase configuration */
	observe: ObserveConfig
	/** Synthesize phase configuration */
	synthesize: SynthesizeConfig
	/** Strategy for maintaining understanding (applied after synthesis) */
	strategy: Strategy
}

/**
 * Context for initializing the two-phase learning method
 */
export interface InitContext {
	/** The learner's purpose/instructions */
	instructions: string
	/** Two-phase configuration */
	config: TwoPhaseConfig
}

/**
 * Result from initializing the two-phase learning method
 */
export interface InitOutput {
	/** System prompt for observe phase */
	observeSystemPrompt: string
	/** System prompt for synthesize phase */
	synthesizeSystemPrompt: string
}

/**
 * Options for learn() call
 */
export interface LearnOptions {
	/** Force synthesis regardless of thresholds */
	forceSynthesize?: boolean
}

/**
 * Callbacks for two-phase learning observability
 */
export interface LearnCallbacks {
	/** Called when observe phase thinks */
	onObserveThinking?: (thoughts: string[]) => void
	/** Called when synthesize phase thinks */
	onSynthesizeThinking?: (thoughts: string[]) => void
}
