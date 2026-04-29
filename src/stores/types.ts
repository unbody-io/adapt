/**
 * Store types — persistence layer interfaces for both Neurons and Brain.
 */

import type { Significance } from '../neurons/types'

// ═══════════════════════════════════════════════════════════════════════════════
// Neuron Store Types
// ═══════════════════════════════════════════════════════════════════════════════

// ── Collection ──────────────────────────────────────────────────────────────

/**
 * Universal CRUD interface for all store namespaces.
 * Every record must have a string `id` field.
 * All methods are async for adapter compatibility (in-memory returns resolved promises).
 */
export interface NeuronCollection<T extends { id: string }> {
	add(item: T): Promise<void>
	get(id: string): Promise<T | undefined>
	list(filter?: Record<string, unknown>): Promise<T[]>
	update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void>
	delete(id: string): Promise<void>
	clear(): Promise<void>
	count(filter?: Record<string, unknown>): Promise<number>
	search(query: string): Promise<T[]>
	addBatch(items: T[]): Promise<void>
}

// ── Store ───────────────────────────────────────────────────────────────────

/**
 * NeuronStore — no type parameter. UnderstandingRecord is universal.
 * Injected into neuron. Caller decides the adapter.
 */
export interface NeuronStore {
	observations: NeuronCollection<ObservationRecord>
	understanding: NeuronCollection<UnderstandingRecord>
	evolution: NeuronCollection<EvolutionRecord>
	state: NeuronCollection<StateRecord>
	dispose(): Promise<void>
}

// ── Record types ────────────────────────────────────────────────────────────

/**
 * Buffered observer output — permanent raw record.
 * After understand, marked metadata_status='processed', not deleted.
 */
export interface ObservationRecord {
	id: string
	data: unknown
	metadata_importance: number
	metadata_tokens: number
	metadata_status: 'pending' | 'processed'
	metadata_created_at: string // ISO 8601
}

/**
 * Universal understanding record — same shape for all neuron types.
 * Only `data` varies (text = string, list = object per item).
 * LLM-specific fields (e.g. list item `signals`) live inside `data`.
 */
export interface UnderstandingRecord {
	id: string
	data: unknown
	metadata_confidence: number // 0-1
	metadata_created_at: string // ISO 8601
	metadata_updated_at: string // ISO 8601
}

/**
 * Change history entry — fully flat, no data wrapper, no metadata prefix.
 */
export interface EvolutionRecord {
	id: string
	summary: string
	reasoning?: string
	significance: Significance
	created_at: string // ISO 8601
}

/**
 * Key-value state (config + runtime: prompts, identities, schemas).
 * The neuron knows the semantics, the store doesn't.
 */
export interface StateRecord {
	id: string // acts as key name (e.g. "identity", "observe_prompt")
	value: unknown
	updated_at: string // ISO 8601
}

// ═══════════════════════════════════════════════════════════════════════════════
// Brain Store Types
// ═══════════════════════════════════════════════════════════════════════════════

// ── Collection Interface ─────────────────────────────────────────────────────

export interface BrainCollection<T extends { id: string }> {
	add(item: T): Promise<void>
	get(id: string): Promise<T | undefined>
	list(filter?: Record<string, unknown>): Promise<T[]>
	update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void>
	delete(id: string): Promise<void>
	clear(): Promise<void>
	count(filter?: Record<string, unknown>): Promise<number>
	addBatch(items: T[]): Promise<void>
	dispose(): Promise<void>
}

// ── Store Interface ──────────────────────────────────────────────────────────

export interface BrainStore {
	state: BrainCollection<BrainStateRecord>
	neurons: BrainCollection<BrainNeuronRecord>
	internalNeurons: BrainCollection<BrainNeuronRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dismissedBatches: BrainCollection<DismissedBatchRecord>
	dispose(): Promise<void>
}

// ── Record Types ─────────────────────────────────────────────────────────────

/** Key-value pairs for Brain config and runtime state */
export interface BrainStateRecord {
	id: string // key name: 'prompt', 'config', 'coverage_gap_state', etc.
	value: unknown // serialized value
	updated_at: string
}

/**
 * Lifecycle status for a Brain-managed neuron.
 * - 'active': fully participating in inject fan-out and evolution evaluation
 * - 'inactive': skipped during inject and evolution; queries still hit it
 *
 * Open enum: future states (archived, frozen, etc.) can be added without
 * breaking persisted records. Missing/undefined is treated as 'active' so
 * pre-existing records continue to work.
 */
export type NeuronStatus = 'active' | 'inactive'

/** One record per neuron — minimal ref, neuron's own store has everything else */
export interface BrainNeuronRecord {
	id: string // neuron ID
	type: string // 'text' | 'list' | future types
	status?: NeuronStatus // defaults to 'active' when missing
}

/** Evaluator decisions history */
export interface BrainEvolutionRecord {
	id: string
	decisions: unknown // serialized EvolutionDecision[]
	source: string // 'auto' | 'manual'
	created_at: string
}

/** Dismissed injection batch — stored when all external neurons dismiss */
export interface DismissedBatchRecord {
	id: string // batchId
	data: unknown // JSON-serialized original items
	gaps: unknown // JSON-serialized string[]
	timestamp: string
	retryCount: number
	status: string // 'pending' | 'retried'
}
