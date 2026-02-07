import type { LanguageModel } from 'ai'
import type { TokenUsage } from '../../types'

/**
 * Options passed through to generateText from ai-sdk
 */
export interface QueryOptions {
	model?: LanguageModel
	temperature?: number
	maxOutputTokens?: number
	topP?: number
	topK?: number
	presencePenalty?: number
	frequencyPenalty?: number
	seed?: number
}

/**
 * Result from a query method's processing
 */
export interface QueryResult {
	/** Whether this learner can help with the query */
	relevant: boolean
	/** Confidence in the response (0.0 - 1.0) */
	confidence: number
	/** The insight or response to the query */
	insight: string
	/** What could not be answered (empty string if none) */
	gaps: string
	/** Token usage for this operation */
	usage: TokenUsage
}

/**
 * Context provided to query methods
 */
export interface QueryContext {
	/** The learner's unique identifier */
	learnerId: string
	/** The learner's purpose/instructions */
	instructions: string
	/** Current understanding to query against */
	understanding: string
	/** The question or query to answer */
	question: string
}

/**
 * Event callbacks for query method observability
 */
export interface QueryCallbacks {
	onThinking?: (thoughts: string[], usage: TokenUsage) => void
}

/**
 * A query method defines how understanding is queried
 *
 * Different methods have different tradeoffs:
 * - tool-based: More control, works with all models, higher token usage
 * - direct: Single call, faster, requires structured output support
 */
/**
 * Config accepted by QueryMethod.update()
 */
export interface QueryMethodUpdateConfig {
	model?: LanguageModel
}

export interface QueryMethod {
	/** Unique identifier for this method */
	readonly name: string

	/** Process a query against understanding and generate a response */
	query(
		context: QueryContext,
		options?: QueryOptions,
		callbacks?: QueryCallbacks,
	): Promise<QueryResult>

	/** Update the method's config (e.g. swap model) */
	update(config: QueryMethodUpdateConfig): void
}

/**
 * Available query method names
 */
export type QueryMethodName = 'tool-based' | 'direct'
