/**
 * Types for the Synthesize phase
 *
 * Synthesize compares buffered observations against current understanding
 * and produces updated understanding. This is where cognitive skills guide reasoning.
 */

import type { Significance } from '../../../../types'

/**
 * Output from the synthesize phase
 *
 * - synthesized: understanding was updated
 * - dismissed: observations didn't change understanding
 * - error: LLM failure
 */
export type SynthesizeOutput =
	| {
			status: 'synthesized'
			newUnderstanding: string
			significance: Significance
			evolution: string
			reasoning?: string
	  }
	| { status: 'dismissed'; output: string }
	| { status: 'error'; output: null; error: unknown }

/**
 * Context provided to synthesize methods
 */
export interface SynthesizeContext {
	/** The learner's unique identifier */
	learnerId: string
	/** The learner's purpose/instructions */
	instructions: string
	/** Current understanding (empty string if none) */
	currentUnderstanding: string
	/** Buffered observations to synthesize */
	observations: string[]
}

/**
 * Callbacks for synthesize phase observability
 */
export interface SynthesizeCallbacks {
	/** Called when the LLM produces reasoning text */
	onThinking?: (thoughts: string[]) => void
}
