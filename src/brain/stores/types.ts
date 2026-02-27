/**
 * Brain store types — persistence layer for Brain-level state.
 *
 * Fully isolated from learner stores (src/learners/stores/).
 * Same CRUD pattern, independently defined.
 */

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
	learners: BrainCollection<BrainLearnerRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dispose(): Promise<void>
}

// ── Record Types ─────────────────────────────────────────────────────────────

/** Key-value pairs for Brain config and runtime state */
export interface BrainStateRecord {
	id: string // key name: 'prompt', 'config', 'coverage_gap_state', etc.
	value: unknown // serialized value
	updated_at: string
}

/** One record per learner — minimal ref, learner's own store has everything else */
export interface BrainLearnerRecord {
	id: string // learner ID
	type: string // 'text' | 'list' | future types
}

/** Evaluator decisions history */
export interface BrainEvolutionRecord {
	id: string
	decisions: unknown // serialized EvolutionDecision[]
	source: string // 'auto' | 'manual'
	created_at: string
}
