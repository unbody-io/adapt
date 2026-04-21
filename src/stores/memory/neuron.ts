/**
 * In-memory store implementation — pure TypeScript, zero dependencies.
 *
 * MemoryNeuronCollection<T> backs every namespace with a plain array.
 * MemoryNeuronStore assembles 4 collections into a Store.
 */

import { createNeuronStoreCollections } from '../internal/builders'
import { extractStrings } from '../internal/search'
import type { StoreCollectionSpec } from '../internal/specs'
import type {
	EvolutionRecord,
	NeuronCollection,
	NeuronStore,
	ObservationRecord,
	StateRecord,
	UnderstandingRecord,
} from '../types'
import { MemoryNeuronCollection } from './collection'

export { extractStrings, MemoryNeuronCollection }

// ── MemoryNeuronStore ─────────────────────────────────────────────────────────────

export class MemoryNeuronStore implements NeuronStore {
	observations: NeuronCollection<ObservationRecord>
	understanding: NeuronCollection<UnderstandingRecord>
	evolution: NeuronCollection<EvolutionRecord>
	state: NeuronCollection<StateRecord>

	constructor() {
		const createCollection = <T extends { id: string }>(
			spec: StoreCollectionSpec<T>,
		): NeuronCollection<T> => new MemoryNeuronCollection(spec)
		const collections = createNeuronStoreCollections(createCollection)
		this.observations = collections.observations
		this.understanding = collections.understanding
		this.evolution = collections.evolution
		this.state = collections.state
	}

	async dispose(): Promise<void> {
		/* no-op for in-memory */
	}
}
