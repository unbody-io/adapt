/**
 * Core types for Learners
 *
 * A Learner is an autonomous agent that builds understanding over time.
 * It has a fixed purpose, type-specific understanding, and tools it can use.
 */

export type LearnerOrigin = 'prompt' | 'developer' | 'emergent'
export type LearnerStatus = 'active' | 'dormant'
export type Significance = 'routine' | 'notable' | 'critical'

export interface LearnerHealth {
	activation: number // 0.0 - 1.0
	threshold: number // gates participation
	status: LearnerStatus
	lastAccessed: Date
	signalThresholds: {
		maxDismissalRate: number // Default: 0.8 - alert when dismissal rate exceeds this
		minRelevance: number // Default: 0.3 - alert when query relevance falls below this
		minConfidence: number // Default: 0.3 - alert when query confidence falls below this
		maxObservationsWithoutSynthesis: number // Default: 3 * maxObservations
	}
}

/**
 * Runtime metrics for learner operations, separated by phase
 */
export interface LearnerMetrics {
	ingestion: {
		observationCount: number
		dismissalCount: number
		dismissalRate: number
		synthesisCount: number
		observationsSinceLastSynthesis: number
	}
	query: {
		count: number
		relevanceScores: number[] // rolling window of last 10
		confidenceScores: number[] // rolling window of last 10
		gaps: string[] // accumulated gap descriptions
	}
}

export interface LearnerMetadata {
	id: string
	instructions: string
	origin: LearnerOrigin
	health: LearnerHealth
}

/**
 * Base interface all learners implement
 */
export interface Learner<TUnderstanding = unknown> {
	readonly id: string
	readonly instructions: string
	readonly origin: LearnerOrigin

	// Current state
	getUnderstanding(): Promise<TUnderstanding>
	getHealth(): LearnerHealth
	getMetrics(): LearnerMetrics

	// Core operations
	learn(batch: unknown[]): Promise<unknown>
	query(question: string): Promise<unknown>

	// Introspection
	getSummary(): Promise<string>
	getMetadata(): LearnerMetadata
}

/**
 * Token usage information from LLM calls
 */
export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

/**
 * Static metadata for a learner type.
 * Brain's evolution system uses descriptors for dispatch and LLM prompts.
 */
export interface LearnerTypeDescriptor {
	/** Type identifier: 'text' | 'list' | future types */
	type: string
	/** When to use this type (for evaluator/decomposition prompts) */
	description: string
	/** Instantiate the right class from config + store */
	factory(config: Record<string, unknown>): import('./base/class').BaseLearner<unknown>
	/** Zod schema for merge LLM output (e.g., z.string() for text, z.array() for list) */
	mergeUnderstandingSchema: import('zod').ZodType
	/** Zod schema for split LLM output */
	splitUnderstandingSchema: import('zod').ZodType
}

