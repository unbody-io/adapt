import type { TokenUsage, Significance } from '../../types'
import type { CompareSkill } from '../cognitive-skills/compare'

/**
 * Result from a learning method's processing
 *
 * Focused on WHAT was learned, not HOW the LLM thought.
 * The LLM reasons internally (hypothesizing, abstracting, etc.)
 * but we only capture the outcome.
 */
export interface LearnResult {
	/** Updated understanding text */
	newUnderstanding: string
	/** How relevant the data was to the learner's purpose (0.0 - 1.0) */
	relevance: number
	/** Importance of this learning: routine, notable, or critical */
	significance: Significance
	/** What changed in the understanding and why */
	evolution: string
	/** True if data was dismissed as irrelevant */
	dismissed: boolean
	/** Optional: model's reasoning behind its decisions */
	reasoning?: string
	/** Token usage for this operation */
	usage: TokenUsage
}

/**
 * Context provided to learning methods
 */
export interface LearnContext {
	/** The learner's unique identifier */
	learnerId: string
	/** The learner's purpose/instructions */
	instructions: string
	/** Current understanding (empty string if none) */
	currentUnderstanding: string
	/** Data batch to process */
	data: unknown[]
}

/**
 * A comparison observation (used by ToolBasedMethod for traceability)
 */
export interface ComparisonObservation {
	observation: string
	skill: CompareSkill
	reasoning: string
}

/**
 * Event callbacks for learning method observability
 */
export interface LearnCallbacks {
	/** Called when the LLM produces reasoning text */
	onThinking?: (thoughts: string[], usage: TokenUsage) => void
	/** Called when ToolBasedMethod compares an observation */
	onComparison?: (observation: ComparisonObservation) => void
}

/**
 * Context for initializing a learning method
 */
export interface InitContext {
	/** The learner's purpose/instructions */
	instructions: string
	/** Strategy for maintaining understanding */
	strategy: import('../strategies').Strategy
}

/**
 * Result from initializing a learning method
 */
export interface InitResult {
	/** The generated system prompt */
	systemPrompt: string
	/** Token usage for generation */
	usage: TokenUsage
}

/**
 * A learning method defines how understanding is generated/updated
 *
 * Different methods have different tradeoffs:
 * - tool-based: More control, works with all models, higher token usage
 * - direct: Single call, faster, requires structured output support
 */
export interface LearningMethod {
	/** Unique identifier for this method */
	readonly name: string

	/** Generated system prompt (null if not initialized) */
	readonly systemPrompt: string | null

	/** Initialize the method - generates system prompt from instructions */
	init(context: InitContext): Promise<InitResult>

	/** Process data and generate analysis + updated understanding */
	learn(
		context: LearnContext,
		callbacks?: LearnCallbacks,
	): Promise<LearnResult>
}

/**
 * Available learning method names
 */
export type LearningMethodName = 'tool-based' | 'direct'
