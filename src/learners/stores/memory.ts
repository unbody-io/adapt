/**
 * In-memory store implementation — pure TypeScript, zero dependencies.
 *
 * MemoryCollection<T> backs every namespace with a plain array.
 * MemoryStore assembles 4 collections into a Store.
 */

import type {
	Collection,
	EvolutionRecord,
	ObservationRecord,
	StateRecord,
	Store,
	UnderstandingRecord,
} from './types'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively extract all string values from an object */
export function extractStrings(obj: unknown): string[] {
	if (typeof obj === 'string') return [obj]
	if (obj === null || obj === undefined) return []
	if (Array.isArray(obj)) return obj.flatMap(extractStrings)
	if (typeof obj === 'object') return Object.values(obj).flatMap(extractStrings)
	return []
}

// ── MemoryCollection ────────────────────────────────────────────────────────

export class MemoryCollection<T extends { id: string }>
	implements Collection<T>
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

	async search(query: string): Promise<T[]> {
		const q = query.toLowerCase()
		return this.items.filter((item) =>
			extractStrings(item).some((s) => s.toLowerCase().includes(q)),
		)
	}

	async addBatch(items: T[]): Promise<void> {
		for (const item of items) {
			this.items.push(item)
		}
	}
}

// ── MemoryStore ─────────────────────────────────────────────────────────────

export class MemoryStore implements Store {
	observations = new MemoryCollection<ObservationRecord>()
	understanding = new MemoryCollection<UnderstandingRecord>()
	evolution = new MemoryCollection<EvolutionRecord>()
	state = new MemoryCollection<StateRecord>()

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}
