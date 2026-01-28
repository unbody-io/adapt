/**
 * Core types for Learners
 *
 * A Learner is an autonomous agent that builds understanding over time.
 * It has a fixed purpose, type-specific understanding, and tools it can use.
 */

export type LearnerOrigin = 'prompt' | 'developer' | 'emergent'
export type LearnerStatus = 'active' | 'dormant'

export interface LearnerGovernance {
	activation: number // 0.0 - 1.0
	threshold: number // gates participation
	status: LearnerStatus
	lastAccessed: Date
	retrievalCount: number
	successRate: number // responses that were useful
}

export interface LearnerMetadata {
	id: string
	purpose: string
	origin: LearnerOrigin
	governance: LearnerGovernance
}

/**
 * Output from processing a batch of data
 */
export interface OnDataResult {
	relevance: number // 0.0 - 1.0, used for governance updates
}

/**
 * Output from handling a query
 */
export interface OnQueryResult {
	relevant: boolean
	confidence: number // 0.0 - 1.0
	insight: string
	gaps: string[]
}

/**
 * Base interface all learners implement
 */
export interface Learner<TUnderstanding = unknown> {
	readonly id: string
	readonly purpose: string
	readonly origin: LearnerOrigin

	// Current state
	getUnderstanding(): TUnderstanding
	getGovernance(): LearnerGovernance

	// Core operations
	onData(batch: unknown[]): Promise<OnDataResult>
	onQuery(query: string): Promise<OnQueryResult>

	// Introspection
	getSummary(): string
	getMetadata(): LearnerMetadata
}

/**
 * Configuration for creating a learner
 */
export interface LearnerConfig<TMaintenance = unknown> {
	id?: string
	purpose: string
	origin?: LearnerOrigin
	maintenance?: TMaintenance
}
