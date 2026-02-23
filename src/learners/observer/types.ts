/**
 * Types for the Observe phase (shared across all learner types)
 *
 * Observe is purely attention-oriented — extract what's relevant to purpose.
 * No comparison to understanding, no classification, just extraction.
 */

/**
 * Usage data from LLM call
 */
export interface Usage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

/**
 * Output from the observe phase
 *
 * - observed: relevant content found, extracted with importance score
 * - dismissed: data examined but nothing relevant to purpose
 * - error: LLM failure
 */
export type ObserveOutput =
	| { status: 'observed'; output: string[]; importance: number; usage?: Usage }
	| { status: 'dismissed'; output: string[]; usage?: Usage }
	| { status: 'error'; output: null; error: unknown }

/**
 * Context provided to observe methods
 */
export interface ObserveContext {
	/** The learner's unique identifier */
	learnerId: string
	/** The learner's purpose/instructions */
	instructions: string
	/** Data to observe */
	data: unknown[]
}

/**
 * Callbacks for observe phase observability
 */
export interface ObserveCallbacks {
	/** Called when the LLM produces reasoning text */
	onThinking?: (thoughts: string[]) => void
}
