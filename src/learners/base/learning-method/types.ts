/**
 * Shared LearningMethod interface + types
 *
 * Each learner type implements this with a specific variant
 * (TextDefaultMethod, ListDefaultMethod, etc.)
 */

import type { Significance } from '../../types'

/**
 * Usage data from an LLM call
 */
export interface Usage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

/**
 * Output from learn() - discriminated union of all possible outcomes
 *
 * newUnderstanding is `unknown` because each learner type has a different shape.
 * Concrete implementations return their specific type (string, ListItem[], etc.)
 */
export type LearnOutput =
	// Observe outcomes
	| { status: 'observed'; output: string[]; usage?: Usage }
	| { status: 'observe:dismissed'; output: string[]; usage?: Usage }
	| { status: 'observe:error'; error: unknown }
	// Synthesize outcomes
	| {
			status: 'synthesized'
			newUnderstanding: unknown
			significance: Significance
			evolution: string
			reasoning?: string
			usage?: Usage
	  }
	| { status: 'synthesize:dismissed'; output: string; usage?: Usage }
	| { status: 'synthesize:error'; error: unknown }

/**
 * Thresholds that trigger synthesis
 */
export interface SynthesizeThresholds {
	maxObservations?: number
	maxTokens?: number
	minImportance?: number
}

/**
 * Options for learn() call
 */
export interface LearnOptions {
	forceSynthesize?: boolean
}

/**
 * Callbacks for learning observability
 */
export interface LearnCallbacks {
	onObserveStarted?: (itemCount: number) => void
	onObserveThinking?: (thoughts: string[]) => void
	onSynthesizeStarted?: (observationCount: number) => void
	onSynthesizeThinking?: (thoughts: string[]) => void
}

/**
 * Result from init()
 */
export interface InitOutput {
	observeSystemPrompt: string
	synthesizeSystemPrompt: string
}

/**
 * LearningMethod interface — pluggable learning strategy
 *
 * Each learner type wires its own variant:
 * - TextDefaultMethod: observe → buffer → synthesize prose
 * - ListDefaultMethod: observe → buffer → synthesize structured operations
 */
export interface LearningMethod {
	readonly name: string

	// Prompt state
	observePrompt: string | null
	synthesizePrompt: string | null

	// Lifecycle
	init(instructions: string, focus?: string): Promise<InitOutput>
	update(config: Record<string, unknown>): Promise<{
		changedFields: string[]
		promptsRegenerated: boolean
	}>

	// Core pipeline
	learn(
		learnerId: string,
		instructions: string,
		understanding: unknown,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput>

	// Buffer access
	getBufferState(): { count: number; avgImportance: number; totalTokens: number }
	getBufferedObservations(): Array<{ text: string; importance: number }>
}
