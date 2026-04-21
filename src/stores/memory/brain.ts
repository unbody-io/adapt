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
} from '../types'
import { MemoryBrainCollection } from './collection'

export { MemoryBrainCollection }

// ── MemoryBrainStore ─────────────────────────────────────────────────────────

export class MemoryBrainStore implements BrainStore {
	state: BrainCollection<BrainStateRecord>
	neurons: BrainCollection<BrainNeuronRecord>
	internalNeurons: BrainCollection<BrainNeuronRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dismissedBatches: BrainCollection<DismissedBatchRecord>

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

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}
