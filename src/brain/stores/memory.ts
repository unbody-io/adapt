/**
 * In-memory brain store implementation — pure TypeScript, zero dependencies.
 *
 * MemoryBrainCollection<T> backs every namespace with a plain array.
 * MemoryBrainStore assembles 3 collections into a BrainStore.
 */

import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainLearnerRecord,
	BrainStateRecord,
	BrainStore,
	DismissedBatchRecord,
} from './types'

// ── MemoryBrainCollection ────────────────────────────────────────────────────

export class MemoryBrainCollection<T extends { id: string }>
	implements BrainCollection<T>
{
	private items: T[] = []

	async add(item: T): Promise<void> {
		if (this.items.some((i) => i.id === item.id)) {
			throw new Error(`Record with id "${item.id}" already exists`)
		}
		this.items.push(item)
	}

	async get(id: string): Promise<T | undefined> {
		return this.items.find((item) => item.id === id)
	}

	async list(filter?: Record<string, unknown>): Promise<T[]> {
		if (!filter) return [...this.items]
		return this.items.filter((item) =>
			Object.entries(filter).every(
				([k, v]) => (item as Record<string, unknown>)[k] === v,
			),
		)
	}

	async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void> {
		const idx = this.items.findIndex((item) => item.id === id)
		if (idx === -1) {
			throw new Error(`Record with id "${id}" not found`)
		}
		this.items[idx] = { ...this.items[idx], ...changes }
	}

	async delete(id: string): Promise<void> {
		const idx = this.items.findIndex((item) => item.id === id)
		if (idx === -1) {
			throw new Error(`Record with id "${id}" not found`)
		}
		this.items.splice(idx, 1)
	}

	async clear(): Promise<void> {
		this.items = []
	}

	async count(filter?: Record<string, unknown>): Promise<number> {
		if (!filter) return this.items.length
		const filtered = this.items.filter((item) =>
			Object.entries(filter).every(
				([k, v]) => (item as Record<string, unknown>)[k] === v,
			),
		)
		return filtered.length
	}

	async addBatch(items: T[]): Promise<void> {
		for (const item of items) {
			this.items.push(item)
		}
	}

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}

// ── MemoryBrainStore ─────────────────────────────────────────────────────────

export class MemoryBrainStore implements BrainStore {
	state = new MemoryBrainCollection<BrainStateRecord>()
	learners = new MemoryBrainCollection<BrainLearnerRecord>()
	internalLearners = new MemoryBrainCollection<BrainLearnerRecord>()
	evolution = new MemoryBrainCollection<BrainEvolutionRecord>()
	dismissedBatches = new MemoryBrainCollection<DismissedBatchRecord>()

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}
