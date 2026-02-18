/**
 * Core types for Learners
 *
 * A Learner is an autonomous agent that builds understanding over time.
 * It has a fixed purpose, type-specific understanding, and tools it can use.
 */

import type { EventsFromMap } from '../types/events'

export type LearnerOrigin = 'prompt' | 'developer' | 'emergent'
export type LearnerStatus = 'active' | 'dormant'
export type Significance = 'routine' | 'notable' | 'critical'

/**
 * Entry tracking how understanding evolved over time
 */
export interface EvolutionEntry {
	summary: string // what changed and why
	significance: Significance
	timestamp: string // ISO 8601
}

export interface LearnerGovernance {
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
	governance: LearnerGovernance
}

/**
 * Output from asking the learner
 */
export interface AskResult {
	relevant: boolean
	relevance: number // 0.0 - 1.0: how related is this query to my domain
	confidence: number // 0.0 - 1.0: how well could I answer from my understanding
	insight: string
	gaps: string[]
}

/**
 * Base interface all learners implement
 */
export interface Learner<TUnderstanding = unknown> {
	readonly id: string
	readonly instructions: string
	readonly origin: LearnerOrigin

	// Current state
	getUnderstanding(): TUnderstanding
	getGovernance(): LearnerGovernance
	getMetrics(): LearnerMetrics

	// Core operations
	learn(batch: unknown[]): Promise<unknown>
	query(question: string): Promise<unknown>

	// Introspection
	getSummary(): string
	getMetadata(): LearnerMetadata
}

/**
 * Configuration for creating a learner
 */
export interface LearnerConfig<TMaintenance = unknown> {
	id?: string
	instructions: string
	origin?: LearnerOrigin
	maintenance?: TMaintenance
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
 * Base event map that all learner types must emit
 *
 * Specific learner implementations can extend this with additional events.
 */
export interface BaseLearnerEventMap {
	// Init
	'learner:init:started': { learnerId: string }
	'learner:init:completed': {
		learnerId: string
		systemPrompt: string
		usage: TokenUsage
	}
	'learner:init:failed': { learnerId: string; error: string }

	// Query
	'learner:query:started': { learnerId: string; query: string }
	'learner:query:completed': {
		learnerId: string
		insight: string
		relevant: boolean
		relevance: number
		confidence: number
		gaps: string[]
		usage: TokenUsage
	}
	'learner:query:failed': { learnerId: string; error: string }

	// State changes
	'learner:governance:updated': {
		learnerId: string
		activation: number
		status: LearnerStatus
		previousStatus?: LearnerStatus
	}
}

/**
 * Union type of all base learner events
 */
export type BaseLearnerEvent = EventsFromMap<BaseLearnerEventMap>
