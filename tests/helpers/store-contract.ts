import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	BrainStore,
	DismissedBatchRecord,
	EvolutionRecord,
	NeuronCollection,
	NeuronStore,
	ObservationRecord,
	StateRecord,
	UnderstandingRecord,
} from '../../src/stores'

interface TestApi {
	describe: (name: string, fn: () => void) => void
	it: (name: string, fn: () => Promise<void> | void) => void
	expect: any
}

type CreateNeuronStore = () => NeuronStore
type CreateBrainStore = () => BrainStore

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

function makeUnderstanding(
	id: string,
	data: unknown,
	confidence = 0.8,
): UnderstandingRecord {
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

function makeBrainState(id: string, value: unknown): BrainStateRecord {
	return { id, value, updated_at: new Date().toISOString() }
}

function makeBrainNeuron(id: string, type: string): BrainNeuronRecord {
	return { id, type }
}

function makeBrainEvolution(id: string, source: string): BrainEvolutionRecord {
	return {
		id,
		decisions: [{ action: 'noop', reason: 'test' }],
		source,
		created_at: new Date().toISOString(),
	}
}

function makeDismissedBatch(id: string): DismissedBatchRecord {
	return {
		id,
		data: [{ value: 'batch item' }],
		gaps: ['missing-signal'],
		timestamp: new Date().toISOString(),
		retryCount: 0,
		status: 'pending',
	}
}

async function expectToThrow(expect: TestApi['expect'], fn: () => Promise<void>) {
	let threw = false
	try {
		await fn()
	} catch (error) {
		threw = true
		expect(error).toBeInstanceOf(Error)
	}
	expect(threw).toBe(true)
}

function registerCollectionCrud<T extends { id: string }>(
	api: TestApi,
	label: string,
	getCollection: (store: NeuronStore) => NeuronCollection<T>,
	makeItem: (id: string) => T,
	makeChanges: () => Partial<Omit<T, 'id'>>,
	createStore: CreateNeuronStore,
) {
	const { describe, it, expect } = api

	describe(`${label} — CRUD`, () => {
		it('starts empty', async () => {
			const store = createStore()
			const collection = getCollection(store)
			expect(await collection.count()).toBe(0)
			expect(await collection.list()).toEqual([])
			expect(await collection.get('missing')).toBeUndefined()
			await store.dispose()
		})

		it('adds, lists, gets, updates, deletes, and clears', async () => {
			const store = createStore()
			const collection = getCollection(store)

			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			await collection.add(makeItem('item-3'))

			expect(await collection.count()).toBe(3)
			expect(await collection.get('item-1')).toBeDefined()
			expect(await collection.list()).toHaveLength(3)

			const changes = makeChanges()
			await collection.update('item-2', changes)
			const updated = await collection.get('item-2')
			expect(updated).toBeDefined()
			for (const [key, value] of Object.entries(changes)) {
				expect((updated as Record<string, unknown>)[key]).toEqual(value)
			}

			await collection.delete('item-1')
			expect(await collection.get('item-1')).toBeUndefined()
			expect(await collection.count()).toBe(2)

			await collection.clear()
			expect(await collection.count()).toBe(0)
			expect(await collection.list()).toEqual([])

			await store.dispose()
		})

		it('throws on missing update/delete', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await expectToThrow(expect, () =>
				collection.update('missing', makeChanges()),
			)
			await expectToThrow(expect, () => collection.delete('missing'))
			await store.dispose()
		})

		it('searches and addBatch work', async () => {
			const store = createStore()
			const collection = getCollection(store)
			await collection.addBatch([
				makeItem('item-1'),
				makeItem('item-2'),
				makeItem('item-3'),
			])

			expect(await collection.count()).toBe(3)
			expect((await collection.search('item-2')).length).toBeGreaterThanOrEqual(1)
			expect(await collection.search('zzz_nonexistent_zzz')).toEqual([])

			await store.dispose()
		})
	})
}

function registerNeuronStoreFeatures(
	api: TestApi,
	adapterName: string,
	createStore: CreateNeuronStore,
) {
	const { describe, it, expect } = api

	describe(`${adapterName} — Features`, () => {
		it('supports filtering and count by filter', async () => {
			const store = createStore()
			await store.observations.add(makeObservation('obs-1', 'first', 0.8, 'pending'))
			await store.observations.add(makeObservation('obs-2', 'second', 0.6, 'pending'))
			await store.observations.add(makeObservation('obs-3', 'third', 0.9, 'processed'))

			expect(await store.observations.list({ metadata_status: 'pending' })).toHaveLength(2)
			expect(await store.observations.count({ metadata_status: 'processed' })).toBe(1)
			await store.dispose()
		})

		it('supports a full text learning lifecycle', async () => {
			const store = createStore()

			await store.state.add(makeState('instructions', 'Track TypeScript best practices'))
			await store.observations.add(makeObservation('obs-1', 'Prefer interfaces', 0.7))
			await store.observations.add(makeObservation('obs-2', 'Use readonly', 0.5))
			await store.understanding.add(
				makeUnderstanding(
					'current',
					'TypeScript best practices: prefer interfaces and use readonly.',
					0.9,
				),
			)

			for (const observation of await store.observations.list({
				metadata_status: 'pending',
			})) {
				await store.observations.update(observation.id, {
					metadata_status: 'processed',
				})
			}

			await store.evolution.add(
				makeEvolution('evo-1', 'notable', 'Initial understanding recorded'),
			)

			expect(await store.observations.count({ metadata_status: 'processed' })).toBe(2)
			expect(await store.understanding.search('interfaces')).toHaveLength(1)
			expect(await store.evolution.count()).toBe(1)

			await store.dispose()
		})

		it('keeps namespaces isolated', async () => {
			const store = createStore()
			await store.understanding.add(makeUnderstanding('u-1', 'some understanding'))
			await store.observations.add(makeObservation('obs-1', 'some observation', 0.5))
			await store.evolution.add(makeEvolution('evo-1', 'routine', 'some evolution'))
			await store.state.add(makeState('state-1', 'some state'))

			await store.observations.clear()

			expect(await store.observations.count()).toBe(0)
			expect(await store.understanding.count()).toBe(1)
			expect(await store.evolution.count()).toBe(1)
			expect(await store.state.count()).toBe(1)

			await store.dispose()
		})
	})
}

function registerBrainCollectionCrud<T extends { id: string }>(
	api: TestApi,
	label: string,
	getCollection: (store: BrainStore) => BrainCollection<T>,
	makeItem: (id: string) => T,
	makeChanges: () => Partial<Omit<T, 'id'>>,
	createStore: CreateBrainStore,
) {
	const { describe, it, expect } = api

	describe(`${label} — CRUD`, () => {
		it('starts empty and supports full CRUD', async () => {
			const store = createStore()
			const collection = getCollection(store)

			expect(await collection.count()).toBe(0)
			expect(await collection.list()).toEqual([])

			await collection.add(makeItem('item-1'))
			await collection.add(makeItem('item-2'))
			expect(await collection.count()).toBe(2)
			expect(await collection.get('item-1')).toBeDefined()

			await collection.update('item-1', makeChanges())
			expect(await collection.get('item-1')).toBeDefined()

			await collection.delete('item-2')
			expect(await collection.count()).toBe(1)

			await collection.clear()
			expect(await collection.count()).toBe(0)

			await collection.dispose()
			await store.dispose()
		})
	})
}

function registerBrainStoreFeatures(
	api: TestApi,
	adapterName: string,
	createStore: CreateBrainStore,
) {
	const { describe, it, expect } = api

	describe(`${adapterName} — Features`, () => {
		it('keeps neuron registries isolated', async () => {
			const store = createStore()
			await store.neurons.add(makeBrainNeuron('neuron-1', 'text'))
			await store.internalNeurons.add(makeBrainNeuron('internal-1', 'text'))

			expect(await store.neurons.count()).toBe(1)
			expect(await store.internalNeurons.count()).toBe(1)
			expect(await store.neurons.get('internal-1')).toBeUndefined()

			await store.dispose()
		})

		it('supports addBatch and filters on dismissed batches', async () => {
			const store = createStore()
			await store.dismissedBatches.addBatch([
				makeDismissedBatch('batch-1'),
				{ ...makeDismissedBatch('batch-2'), status: 'retried', retryCount: 1 },
			])

			expect(await store.dismissedBatches.count()).toBe(2)
			expect(await store.dismissedBatches.list({ status: 'retried' })).toHaveLength(1)

			await store.dispose()
		})
	})
}

export function registerNeuronStoreContract(
	api: TestApi,
	adapterName: string,
	createStore: CreateNeuronStore,
) {
	const { describe } = api

	describe(adapterName, () => {
		registerCollectionCrud(
			api,
			'observations',
			(store) => store.observations,
			(id) => makeObservation(id, `observation ${id}`, 0.6),
			() => ({ data: 'updated content', metadata_importance: 0.99 }),
			createStore,
		)
		registerCollectionCrud(
			api,
			'understanding',
			(store) => store.understanding,
			(id) => makeUnderstanding(id, `understanding ${id}`),
			() => ({ data: 'updated understanding', metadata_confidence: 0.95 }),
			createStore,
		)
		registerCollectionCrud(
			api,
			'evolution',
			(store) => store.evolution,
			(id) => makeEvolution(id, 'routine', `evolution ${id}`),
			() => ({ significance: 'critical', summary: 'updated summary' }),
			createStore,
		)
		registerCollectionCrud(
			api,
			'state',
			(store) => store.state,
			(id) => makeState(id, { key: id }),
			() => ({ value: 'updated value' }),
			createStore,
		)
		registerNeuronStoreFeatures(api, adapterName, createStore)
	})
}

export function registerBrainStoreContract(
	api: TestApi,
	adapterName: string,
	createStore: CreateBrainStore,
) {
	const { describe } = api

	describe(adapterName, () => {
		registerBrainCollectionCrud(
			api,
			'state',
			(store) => store.state,
			(id) => makeBrainState(id, { key: id }),
			() => ({ value: 'updated value' }),
			createStore,
		)
		registerBrainCollectionCrud(
			api,
			'neurons',
			(store) => store.neurons,
			(id) => makeBrainNeuron(id, 'text'),
			() => ({ type: 'list' }),
			createStore,
		)
		registerBrainCollectionCrud(
			api,
			'internalNeurons',
			(store) => store.internalNeurons,
			(id) => makeBrainNeuron(id, 'text'),
			() => ({ type: 'list' }),
			createStore,
		)
		registerBrainCollectionCrud(
			api,
			'evolution',
			(store) => store.evolution,
			(id) => makeBrainEvolution(id, 'auto'),
			() => ({ source: 'manual' }),
			createStore,
		)
		registerBrainCollectionCrud(
			api,
			'dismissedBatches',
			(store) => store.dismissedBatches,
			(id) => makeDismissedBatch(id),
			() => ({ status: 'retried', retryCount: 1 }),
			createStore,
		)
		registerBrainStoreFeatures(api, adapterName, createStore)
	})
}
