/**
 * In-memory brain store implementation — pure TypeScript, zero dependencies.
 *
 * MemoryBrainCollection<T> backs every namespace with a plain array.
 * MemoryBrainStore assembles 5 collections into a BrainStore.
 */

import { createBrainStoreCollections } from '../internal/builders'
import type { StoreCollectionSpec } from '../internal/specs'
import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	BrainStore,
	DismissedBatchRecord,
	NeuronStore,
} from '../types'
import { MemoryBrainCollection } from './collection'
import { MemoryNeuronStore } from './neuron'

export { MemoryBrainCollection }

// ── MemoryBrainStore ─────────────────────────────────────────────────────────

export class MemoryBrainStore implements BrainStore {
	state: BrainCollection<BrainStateRecord>
	neurons: BrainCollection<BrainNeuronRecord>
	internalNeurons: BrainCollection<BrainNeuronRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dismissedBatches: BrainCollection<DismissedBatchRecord>

	// Cached per id — the cache IS the persistence layer for memory: a Brain
	// disposed and restored against the same MemoryBrainStore must see the
	// same neuron data on restore.
	private readonly neuronStores = new Map<string, NeuronStore>()

	constructor() {
		const createCollection = <T extends { id: string }>(
			spec: StoreCollectionSpec<T>,
		): BrainCollection<T> => new MemoryBrainCollection(spec)
		const collections = createBrainStoreCollections(createCollection)
		this.state = collections.state
		this.neurons = collections.neurons
		this.internalNeurons = collections.internalNeurons
		this.evolution = collections.evolution
		this.dismissedBatches = collections.dismissedBatches
	}

	getNeuronStore(neuronId: string): NeuronStore {
		let store = this.neuronStores.get(neuronId)
		if (!store) {
			store = new MemoryNeuronStore()
			this.neuronStores.set(neuronId, store)
		}
		return store
	}

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}
