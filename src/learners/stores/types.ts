/**
 * Store types — dumb CRUD adapter interfaces
 *
 * Every store exposes 4 namespaces: understanding, observations, evolution, state.
 * Every namespace is a Collection<T> with identical operations.
 * UnderstandingRecord is universal — Store is uniform across all learner types.
 *
 * Designed for in-memory now, SQLite later — same interfaces, different backend.
 */

import type { Significance } from '../types'

// ── Collection ──────────────────────────────────────────────────────────────

/**
 * Universal CRUD interface for all store namespaces.
 * Every record must have a string `id` field.
 * All methods are async for adapter compatibility (in-memory returns resolved promises).
 */
export interface Collection<T extends { id: string }> {
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
 * Store — no type parameter. UnderstandingRecord is universal.
 * Injected into learner. Caller decides the adapter.
 */
export interface Store {
	observations: Collection<ObservationRecord>
	understanding: Collection<UnderstandingRecord>
	evolution: Collection<EvolutionRecord>
	state: Collection<StateRecord>
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
 * Universal understanding record — same shape for all learner types.
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
	createdAt: string // ISO 8601
}

/**
 * Key-value state (config + runtime: prompts, identities, schemas).
 * The learner knows the semantics, the store doesn't.
 */
export interface StateRecord {
	id: string // acts as key name (e.g. "identity", "observe_prompt")
	value: unknown
	updatedAt: string // ISO 8601
}
