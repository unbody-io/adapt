import type { LanguageModel } from 'ai'
import type { IngestChunk, TokenUsage } from '../learners/types'
import type { TextLearnerEventMap } from '../learners/text-learner/types'
import type { EventsFromMap } from '../types/events'
import type { GeneratedLearnerConfig } from '../learners/schema.config'

/**
 * Configuration for creating a Brain
 */
export interface BrainConfig {
	/** Natural language prompt describing what to track and learn */
	prompt: string
	/** AI SDK language model shared by all learners */
	model: LanguageModel
	/** Max items per batch sent to learners (default: 20) */
	batchSize?: number
	/** Max estimated tokens for learner input before chunking (default: 30000) */
	maxInputTokens?: number
}

/**
 * Options for brain.inject()
 */
export interface BrainInjectOptions {
	/** Custom inject ID. If not provided, auto-generated with inject_ prefix */
	id?: string
}

/**
 * Result from a single learner within a batch
 */
export interface LearnerBatchResult {
	learnerId: string
	chunks: IngestChunk[]
}

/**
 * Result from processing a single batch
 */
export interface BatchResult {
	/** Unique batch identifier (batch_xxx) */
	id: string
	/** 0-indexed position within the inject operation */
	index: number
	/** Results from each learner for this batch */
	results: LearnerBatchResult[]
}

/**
 * Result from injecting data into the Brain
 */
export interface BrainInjectResult {
	/** Unique inject identifier (inject_xxx) */
	id: string
	/** Results grouped by batch */
	batches: BatchResult[]
}

/**
 * Result from asking the Brain a question
 */
export interface BrainAskResult {
	/** Synthesized answer integrating all learner insights */
	insight: string
	/** Individual learner responses */
	sources: Array<{
		learnerId: string
		confidence: number
		insight: string
	}>
	/** Aggregated gaps from all learners */
	gaps: string[]
}

/**
 * Learner response for ask synthesis
 */
export interface LearnerResponse {
	learnerId: string
	relevant: boolean
	confidence: number
	insight: string
	gaps: string[]
}

/**
 * Brain's own events (not forwarded from learners)
 */
export interface BrainOwnEventMap {
	// Init
	'brain:init:started': Record<string, never>
	'brain:init:config:generating': Record<string, never>
	'brain:init:config:generated': { configs: GeneratedLearnerConfig[]; usage: TokenUsage }
	'brain:init:completed': { learnerIds: string[] }
	'brain:init:failed': { error: string }

	// Inject
	'brain:inject:started': { injectId: string; itemCount: number; batchCount: number }
	'brain:inject:batch:started': { injectId: string; batchId: string; batchIndex: number; itemCount: number }
	'brain:inject:batch:completed': { injectId: string; batchId: string; batchIndex: number; results: LearnerBatchResult[] }
	'brain:inject:completed': { injectId: string; batches: BatchResult[] }
	'brain:inject:failed': { injectId: string; error: string }

	// Ask
	'brain:ask:started': { queryId: string; query: string }
	'brain:ask:synthesis:started': { queryId: string; learnerResponses: LearnerResponse[] }
	'brain:ask:completed': { queryId: string; insight: string; sources: BrainAskResult['sources']; gaps: string[]; usage: TokenUsage }
	'brain:ask:failed': { queryId: string; error: string }

	// Learner management
	'brain:learner:added': { learnerId: string; name: string; instructions: string }
}

/**
 * Combined Brain event map (Brain's own events + forwarded learner events)
 */
export type BrainEventMap = BrainOwnEventMap & TextLearnerEventMap

/**
 * Union type of all Brain events
 */
export type BrainEvent = EventsFromMap<BrainEventMap>
