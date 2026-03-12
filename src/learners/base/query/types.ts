/**
 * Shared QueryMethod interface and types
 *
 * QueryContext does NOT include understanding — each learner provides
 * understanding-access tools to the QueryMethod instead.
 */

import type { LanguageModel } from 'ai'
import type { StreamTextResult } from '../../../llm'
import type { TokenUsage } from '../../types'

/**
 * Options passed through to generateText from ai-sdk
 */
export type QueryMode = 'direct' | 'tool-based'

export interface QueryOptions {
	mode?: QueryMode
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
	/** How related is this query to the learner's domain (0.0 - 1.0) */
	relevance: number
	/** How well the learner could answer from its understanding (0.0 - 1.0) */
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
 *
 * Understanding is NOT included — it's accessed via learner-provided tools.
 */
export interface QueryContext {
	/** The learner's unique identifier */
	learnerId: string
	/** The learner's purpose/instructions */
	instructions: string
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
 * Config accepted by QueryMethod.update()
 */
export interface QueryMethodUpdateConfig {
	model?: LanguageModel
}

/**
 * A query method defines how understanding is queried
 */
export interface QueryMethod {
	/** Unique identifier for this method */
	readonly name: string

	/** Process a query against understanding and generate a response */
	query(
		context: QueryContext,
		options?: QueryOptions,
		callbacks?: QueryCallbacks,
	): Promise<QueryResult>

	/** Stream a query — returns raw ai-sdk StreamTextResult */
	queryStream?(
		context: QueryContext,
		options?: QueryOptions,
	): Promise<StreamTextResult<any, any>>

	/** Update the method's config (e.g. swap model) */
	update(config: QueryMethodUpdateConfig): void
}
