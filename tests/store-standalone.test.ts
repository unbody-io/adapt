/**
 * Store standalone test
 *
 * Tests the store module in complete isolation — no Brain, no LLM, no dependencies.
 * Verifies all Collection<T> operations across all 4 namespaces.
 * Runs the full suite against both MemoryNeuronStore and SQLiteNeuronStore.
 */

import { describe, it, expect } from 'vitest'
import {
	MemoryNeuronStore,
	type NeuronStore,
	type ObservationRecord,
	type UnderstandingRecord,
	type EvolutionRecord,
	type StateRecord,
	type NeuronCollection,
} from '@unbody/adapt'
import { SQLiteNeuronStore } from '@unbody/adapt/sqlite'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeObservation(
	id: string,
	data: unknown,
	importance: number,
	status: 'pending' | 'processed' = 'pending',
): ObservationRecord {
	return {
		id,
		data,
		metadata_importance: importance,
		metadata_tokens: typeof data === 'string' ? Math.ceil(data.length / 4) : 10,
		metadata_status: status,
		metadata_created_at: new Date().toISOString(),
	}
}

function makeUnderstanding(id: string, data: unknown, confidence = 0.8): UnderstandingRecord {
	const now = new Date().toISOString()
	return {
		id,
		data,
		metadata_confidence: confidence,
		metadata_created_at: now,
		metadata_updated_at: now,
	}
}

function makeEvolution(
	id: string,
	significance: 'routine' | 'notable' | 'critical',
	summary: string,
): EvolutionRecord {
	return { id, significance, summary, created_at: new Date().toISOString() }
}

function makeState(id: string, value: unknown): StateRecord {
	return { id, value, updated_at: new Date().toISOString() }
}

type CreateNeuronStore = () => NeuronStore

// ── Generic collection CRUD tests ───────────────────────────────────────────

function describeCollectionCRUD<T extends { id: string }>(
	label: string,
	getCollection: (store: NeuronStore) => NeuronCollection<T>,
	makeItem: (id: string) => T,
	makeChanges: () => Partial<Omit<T, 'id'>>,
	createStore: CreateNeuronStore,
) {
	describe(`${label} — CRUD`, () => {
		it('starts empty', async () => {
			const store = createStore()
			const collection = getCollection(store)
			expect(await collection.count()).toBe(0)
			expect(await collection.list()).toEqual([])
			expect(await collection.get('nonexistent')).toBeUndefined()
			await store.dispose()
		})

		it('add and count', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			expect(await collection.count()).toBe(1)
			await collection.add(makeItem('item-2'))
			await collection.add(makeItem('item-3'))
			expect(await collection.count()).toBe(3)
			await store.dispose()
		})

		it('get returns correct item by id', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			const retrieved = await collection.get('item-1')
			expect(retrieved).toBeDefined()
			expect(retrieved?.id).toBe('item-1')
			await store.dispose()
		})

		it('list returns all items', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			await collection.add(makeItem('item-3'))
			const all = await collection.list()
			expect(all).toHaveLength(3)
			expect(all.some((i) => i.id === 'item-1')).toBe(true)
			expect(all.some((i) => i.id === 'item-2')).toBe(true)
			expect(all.some((i) => i.id === 'item-3')).toBe(true)
			await store.dispose()
		})

		it('list returns a copy', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			const all = await collection.list()
			all.push(makeItem('rogue'))
			expect(await collection.count()).toBe(1)
			await store.dispose()
		})

		it('search finds items containing query', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			const results = await collection.search('item-2')
			expect(results.length).toBeGreaterThanOrEqual(1)
			const empty = await collection.search('zzz_nonexistent_zzz')
			expect(empty).toHaveLength(0)
			await store.dispose()
		})

		it('update applies changes', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			const changes = makeChanges()
			await collection.update('item-1', changes)
			const updated = await collection.get('item-1')
			expect(updated).toBeDefined()
			for (const [key, value] of Object.entries(changes)) {
				expect((updated as Record<string, unknown>)[key]).toEqual(value)
			}
			await store.dispose()
		})

		it('update throws on nonexistent item', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await expect(collection.update('nonexistent', makeChanges())).rejects.toThrow()
			await store.dispose()
		})

		it('delete removes item', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			await collection.delete('item-1')
			expect(await collection.count()).toBe(1)
			expect(await collection.get('item-1')).toBeUndefined()
			await store.dispose()
		})

		it('delete throws on nonexistent item', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await expect(collection.delete('nonexistent')).rejects.toThrow()
			await store.dispose()
		})

		it('clear empties the collection', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			await collection.clear()
			expect(await collection.count()).toBe(0)
			expect(await collection.list()).toEqual([])
			await store.dispose()
		})

		it('clear on empty is safe', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.clear()
			expect(await collection.count()).toBe(0)
			await store.dispose()
		})
	})
}

// ── Feature-specific tests ──────────────────────────────────────────────────

function describeFeatureTests(adapterName: string, createStore: CreateNeuronStore) {
	describe(`${adapterName} — Filtering`, () => {
		it('list(filter) returns matching items', async () => {
			const store = createStore()
			await store.observations.add(makeObservation('obs-1', 'first', 0.8, 'pending'))
			await store.observations.add(makeObservation('obs-2', 'second', 0.6, 'pending'))
			await store.observations.add(makeObservation('obs-3', 'third', 0.9, 'processed'))
			await store.observations.add(makeObservation('obs-4', 'fourth', 0.7, 'pending'))

			const pending = await store.observations.list({ metadata_status: 'pending' })
			expect(pending).toHaveLength(3)
			expect(pending.every((o) => o.metadata_status === 'pending')).toBe(true)

			const processed = await store.observations.list({ metadata_status: 'processed' })
			expect(processed).toHaveLength(1)
			expect(processed[0].id).toBe('obs-3')
			await store.dispose()
		})

		it('count(filter) returns matching count', async () => {
			const store = createStore()
			await store.observations.add(makeObservation('obs-1', 'first', 0.8, 'pending'))
			await store.observations.add(makeObservation('obs-2', 'second', 0.6, 'pending'))
			await store.observations.add(makeObservation('obs-3', 'third', 0.9, 'processed'))

			expect(await store.observations.count({ metadata_status: 'pending' })).toBe(2)
			expect(await store.observations.count({ metadata_status: 'processed' })).toBe(1)
			expect(await store.observations.count()).toBe(3)
			await store.dispose()
		})
	})

	describe(`${adapterName} — addBatch`, () => {
		it('adds multiple items at once', async () => {
			const store = createStore()
			const observations = [
				makeObservation('batch-1', 'observation A', 0.5),
				makeObservation('batch-2', 'observation B', 0.6),
				makeObservation('batch-3', 'observation C', 0.7),
			]
			await store.observations.addBatch(observations)
			expect(await store.observations.count()).toBe(3)
			const first = await store.observations.get('batch-1')
			expect(first).toBeDefined()
			expect(first?.data).toBe('observation A')
			await store.dispose()
		})
	})

	describe(`${adapterName} — Text pipeline simulation`, () => {
		it('full text neuron lifecycle', async () => {
			const store = createStore()

			// 1. Store initial state
			await store.state.add(makeState('instructions', 'Track TypeScript best practices'))
			await store.state.add(makeState('observe_identity', { identity: 'You are a TypeScript observer', domain: 'typescript' }))
			expect(await store.state.count()).toBe(2)

			// 2. Buffer observations
			await store.observations.add(makeObservation('obs-1', 'Prefer interfaces over type aliases for object shapes', 0.7))
			await store.observations.add(makeObservation('obs-2', 'Use readonly for immutable properties', 0.5))
			await store.observations.add(makeObservation('obs-3', 'Avoid enums, prefer const objects with as const', 0.8))
			expect(await store.observations.count()).toBe(3)
			expect(await store.observations.count({ metadata_status: 'pending' })).toBe(3)

			// 3. Check threshold
			const pending = await store.observations.list({ metadata_status: 'pending' })
			const avgImportance = pending.reduce((sum, o) => sum + o.metadata_importance, 0) / pending.length
			expect(avgImportance).toBeGreaterThan(0.5)

			// 4. Store understanding
			await store.understanding.add(makeUnderstanding('understanding',
				'TypeScript best practices: prefer interfaces for object shapes, use readonly for immutability, avoid enums in favor of const objects.',
				0.9))
			expect(await store.understanding.count()).toBe(1)
			const understanding = await store.understanding.get('understanding')
			expect(typeof understanding?.data === 'string' && understanding.data.includes('interfaces')).toBe(true)

			// 5. Mark observations as processed
			for (const obs of pending) {
				await store.observations.update(obs.id, { metadata_status: 'processed' as const })
			}
			expect(await store.observations.count({ metadata_status: 'pending' })).toBe(0)
			expect(await store.observations.count({ metadata_status: 'processed' })).toBe(3)
			expect(await store.observations.count()).toBe(3)

			// 6. Track evolution
			await store.evolution.add(makeEvolution('evo-1', 'notable', 'Initial understanding of TypeScript patterns'))

			// 7. Second cycle
			await store.observations.add(makeObservation('obs-4', 'Use discriminated unions for type narrowing', 0.9))
			await store.observations.add(makeObservation('obs-5', 'Prefer unknown over any for type safety', 0.6))
			expect(await store.observations.count({ metadata_status: 'pending' })).toBe(2)

			// 8. Update understanding
			await store.understanding.update('understanding', {
				data: 'TypeScript best practices: prefer interfaces, use readonly, avoid enums, use discriminated unions, prefer unknown over any.',
				metadata_confidence: 0.95,
				metadata_updated_at: new Date().toISOString(),
			})
			const updated = await store.understanding.get('understanding')
			expect(typeof updated?.data === 'string' && updated.data.includes('discriminated')).toBe(true)
			expect(updated?.metadata_confidence).toBe(0.95)

			// Mark second batch
			const pending2 = await store.observations.list({ metadata_status: 'pending' })
			for (const obs of pending2) {
				await store.observations.update(obs.id, { metadata_status: 'processed' as const })
			}
			expect(await store.observations.count({ metadata_status: 'processed' })).toBe(5)

			await store.evolution.add(makeEvolution('evo-2', 'routine', 'Added type narrowing patterns'))
			expect(await store.evolution.count()).toBe(2)

			await store.dispose()
		})
	})

	describe(`${adapterName} — List pipeline simulation`, () => {
		it('full list neuron lifecycle', async () => {
			const store = createStore()

			// 1. Store initial state
			await store.state.add(makeState('instructions', 'Track technology stack: tools, frameworks, libraries'))

			// 2. Buffer observations
			await store.observations.add(makeObservation('obs-1', 'Migrated from Express to Hono for the API layer', 0.8))
			await store.observations.add(makeObservation('obs-2', 'Using PostgreSQL 15 with Drizzle ORM', 0.6))
			await store.observations.add(makeObservation('obs-3', 'Frontend is Next.js 14 with React 18', 0.7))

			// 3. Store list items
			await store.understanding.add(makeUnderstanding('item-1', { name: 'Hono', category: 'API Framework', status: 'active' }, 0.9))
			await store.understanding.add(makeUnderstanding('item-2', { name: 'PostgreSQL 15', category: 'Database', status: 'active' }, 0.85))
			await store.understanding.add(makeUnderstanding('item-3', { name: 'Next.js 14', category: 'Frontend', status: 'active' }, 0.8))
			await store.understanding.add(makeUnderstanding('item-4', { name: 'React 18', category: 'UI Library', status: 'active' }, 0.8))
			expect(await store.understanding.count()).toBe(4)

			// Mark observations processed
			const pending = await store.observations.list({ metadata_status: 'pending' })
			for (const obs of pending) {
				await store.observations.update(obs.id, { metadata_status: 'processed' as const })
			}
			await store.evolution.add(makeEvolution('evo-1', 'notable', 'Initial tech stack captured'))

			// 4. Update existing item
			await store.understanding.update('item-3', {
				data: { name: 'Next.js 15', category: 'Frontend', status: 'active', note: 'Upgraded' },
				metadata_updated_at: new Date().toISOString(),
			})
			const updated = await store.understanding.get('item-3')
			expect((updated?.data as any)?.name).toBe('Next.js 15')

			// 5. Add new item
			await store.understanding.add(makeUnderstanding('item-5', { name: 'Tailwind CSS', category: 'CSS', status: 'active' }, 0.75))
			expect(await store.understanding.count()).toBe(5)

			// 6. Remove item
			await store.understanding.delete('item-4')
			expect(await store.understanding.count()).toBe(4)
			expect(await store.understanding.get('item-4')).toBeUndefined()

			// 7. Search
			const honoResults = await store.understanding.search('Hono')
			expect(honoResults).toHaveLength(1)
			expect((honoResults[0].data as any).name).toBe('Hono')

			// 8. List all
			const allItems = await store.understanding.list()
			const names = allItems.map((i) => (i.data as any).name).sort()
			expect(names).toContain('Hono')
			expect(names).toContain('Next.js 15')
			expect(names).toContain('Tailwind CSS')

			await store.dispose()
		})
	})

	describe(`${adapterName} — Cross-namespace isolation`, () => {
		it('clearing one namespace does not affect others', async () => {
			const store = createStore()
			await store.understanding.add(makeUnderstanding('u-1', 'some understanding'))
			await store.observations.add(makeObservation('obs-1', 'some observation', 0.5))
			await store.evolution.add(makeEvolution('evo-1', 'routine', 'some evolution'))
			await store.state.add(makeState('key-1', 'some state'))

			await store.observations.clear()
			expect(await store.observations.count()).toBe(0)
			expect(await store.understanding.count()).toBe(1)
			expect(await store.evolution.count()).toBe(1)
			expect(await store.state.count()).toBe(1)

			await store.understanding.delete('u-1')
			expect(await store.understanding.count()).toBe(0)
			expect(await store.evolution.count()).toBe(1)
			expect(await store.state.count()).toBe(1)
			await store.dispose()
		})
	})

	describe(`${adapterName} — Store independence`, () => {
		it('two stores do not share data', async () => {
			const store1 = createStore()
			const store2 = createStore()
			await store1.observations.add(makeObservation('obs-1', 'only in store1', 0.5))
			await store2.observations.add(makeObservation('obs-2', 'only in store2', 0.6))
			await store2.observations.add(makeObservation('obs-3', 'also in store2', 0.7))

			expect(await store1.observations.count()).toBe(1)
			expect(await store2.observations.count()).toBe(2)
			expect(await store1.observations.get('obs-2')).toBeUndefined()
			expect(await store2.observations.get('obs-1')).toBeUndefined()
			await store1.dispose()
			await store2.dispose()
		})
	})

	describe(`${adapterName} — dispose`, () => {
		it('completes without error', async () => {
			const store = createStore()
			await store.observations.add(makeObservation('obs-1', 'test', 0.5))
			await expect(store.dispose()).resolves.toBeUndefined()
		})
	})
}

// ── Run suites ──────────────────────────────────────────────────────────────

describe('MemoryNeuronStore', () => {
	const createStore: CreateNeuronStore = () => new MemoryNeuronStore()

	describeCollectionCRUD(
		'observations',
		(s) => s.observations,
		(id) => makeObservation(id, `observation ${id}`, 0.5 + Math.random() * 0.5),
		() => ({ data: 'updated content', metadata_importance: 0.99 }),
		createStore,
	)

	describeCollectionCRUD(
		'evolution',
		(s) => s.evolution,
		(id) => makeEvolution(id, 'routine', `evolution ${id}`),
		() => ({ significance: 'critical' as const, summary: 'updated summary' }),
		createStore,
	)

	describeCollectionCRUD(
		'state',
		(s) => s.state,
		(id) => makeState(id, { key: id }),
		() => ({ value: 'updated value' }),
		createStore,
	)

	describeCollectionCRUD(
		'understanding',
		(s) => s.understanding,
		(id) => makeUnderstanding(id, `understanding ${id}`),
		() => ({ data: 'updated understanding', metadata_confidence: 0.95 }),
		createStore,
	)

	describeFeatureTests('MemoryNeuronStore', createStore)
})

describe('SQLiteNeuronStore', () => {
	const createStore: CreateNeuronStore = () => new SQLiteNeuronStore()

	describeCollectionCRUD(
		'observations',
		(s) => s.observations,
		(id) => makeObservation(id, `observation ${id}`, 0.5 + Math.random() * 0.5),
		() => ({ data: 'updated content', metadata_importance: 0.99 }),
		createStore,
	)

	describeCollectionCRUD(
		'evolution',
		(s) => s.evolution,
		(id) => makeEvolution(id, 'routine', `evolution ${id}`),
		() => ({ significance: 'critical' as const, summary: 'updated summary' }),
		createStore,
	)

	describeCollectionCRUD(
		'state',
		(s) => s.state,
		(id) => makeState(id, { key: id }),
		() => ({ value: 'updated value' }),
		createStore,
	)

	describeCollectionCRUD(
		'understanding',
		(s) => s.understanding,
		(id) => makeUnderstanding(id, `understanding ${id}`),
		() => ({ data: 'updated understanding', metadata_confidence: 0.95 }),
		createStore,
	)

	describeFeatureTests('SQLiteNeuronStore', createStore)
})
