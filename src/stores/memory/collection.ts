import { matchesSearchQuery } from '../internal/search'
import type { StoreCollectionSpec } from '../internal/specs'
import type { BrainCollection, NeuronCollection } from '../types'

class MemoryRecordCollection<T extends { id: string }> {
	private items: T[] = []

	constructor(protected readonly spec?: StoreCollectionSpec<T>) {}

	async add(item: T): Promise<void> {
		if (this.items.some((existing) => existing.id === item.id)) {
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
				([key, value]) => (item as Record<string, unknown>)[key] === value,
			),
		)
	}

	async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void> {
		const index = this.items.findIndex((item) => item.id === id)
		if (index === -1) {
			throw new Error(`Record with id "${id}" not found`)
		}
		this.items[index] = { ...this.items[index], ...changes }
	}

	async delete(id: string): Promise<void> {
		const index = this.items.findIndex((item) => item.id === id)
		if (index === -1) {
			throw new Error(`Record with id "${id}" not found`)
		}
		this.items.splice(index, 1)
	}

	async clear(): Promise<void> {
		this.items = []
	}

	async count(filter?: Record<string, unknown>): Promise<number> {
		if (!filter) return this.items.length
		const filtered = this.items.filter((item) =>
			Object.entries(filter).every(
				([key, value]) => (item as Record<string, unknown>)[key] === value,
			),
		)
		return filtered.length
	}

	async search(query: string): Promise<T[]> {
		return this.items.filter((item) => matchesSearchQuery(item, query))
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

export class MemoryNeuronCollection<T extends { id: string }>
	extends MemoryRecordCollection<T>
	implements NeuronCollection<T> {}

export class MemoryBrainCollection<T extends { id: string }>
	extends MemoryRecordCollection<T>
	implements BrainCollection<T> {}
