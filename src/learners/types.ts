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
 * Result from processing a single ingest chunk
 *
 * When input exceeds token limits, it's split into chunks.
 * Each chunk is processed independently and returns this result.
 */
export interface IngestChunk {
	id: string // chunk_xxx - unique identifier for this chunk
	index: number // 0-indexed position within the ingest operation
	relevance: number // 0.0 - 1.0, how relevant this chunk was to learner's purpose
}

/**
 * Output from ingesting a batch of data
 *
 * Returns array of chunks - if input fit in token limit, single chunk.
 * If input exceeded token limit, multiple chunks processed sequentially.
 */
export interface IngestResult {
	chunks: IngestChunk[]
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
	'learner:init:completed': { learnerId: string; systemPrompt: string; usage: TokenUsage }
	'learner:init:failed': { learnerId: string; error: string }

	// Ingest
	'learner:ingest:started': { learnerId: string; itemCount: number; chunkCount: number }
	'learner:ingest:chunk:started': { learnerId: string; chunkId: string; chunkIndex: number }
	'learner:ingest:thinking': { learnerId: string; chunkId: string; thoughts: string[]; usage: TokenUsage }
	'learner:ingest:tool:started': { learnerId: string; chunkId: string; toolName: string; input: unknown }
	'learner:ingest:tool:completed': { learnerId: string; chunkId: string; toolName: string; output: unknown }
	'learner:ingest:tool:failed': { learnerId: string; chunkId: string; toolName: string; error: string }
	'learner:ingest:chunk:completed': { learnerId: string; chunkId: string; relevance: number; usage: TokenUsage }
	'learner:ingest:completed': { learnerId: string; totalRelevance: number; usage: TokenUsage }
	'learner:ingest:failed': { learnerId: string; error: string }

	// Ask
	'learner:ask:started': { learnerId: string; query: string }
	'learner:ask:thinking': { learnerId: string; thoughts: string[]; usage: TokenUsage }
	'learner:ask:tool:started': { learnerId: string; toolName: string; input: unknown }
	'learner:ask:tool:completed': { learnerId: string; toolName: string; output: unknown }
	'learner:ask:tool:failed': { learnerId: string; toolName: string; error: string }
	'learner:ask:completed': {
		learnerId: string
		insight: string
		confidence: number
		gaps: string[]
		usage: TokenUsage
	}
	'learner:ask:failed': { learnerId: string; error: string }

	// State changes
	'learner:understanding:updated': {
		learnerId: string
		understanding: string
		previousUnderstanding: string
		entry: EvolutionEntry
	}
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
