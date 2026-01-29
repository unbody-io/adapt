/**
 * Core types for Learners
 *
 * A Learner is an autonomous agent that builds understanding over time.
 * It has a fixed purpose, type-specific understanding, and tools it can use.
 */

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
	retrievalCount: number
	successRate: number // responses that were useful
}

export interface LearnerMetadata {
	id: string
	instructions: string
	origin: LearnerOrigin
	governance: LearnerGovernance
}

/**
 * Output from ingesting a batch of data
 */
export interface IngestResult {
	relevance: number // 0.0 - 1.0, used for governance updates
}

/**
 * Output from asking the learner
 */
export interface AskResult {
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
	readonly instructions: string
	readonly origin: LearnerOrigin

	// Current state
	getUnderstanding(): TUnderstanding
	getGovernance(): LearnerGovernance

	// Core operations
	ingest(batch: unknown[]): Promise<IngestResult>
	ask(query: string): Promise<AskResult>

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
