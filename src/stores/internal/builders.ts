import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	DismissedBatchRecord,
	EvolutionRecord,
	NeuronCollection,
	ObservationRecord,
	StateRecord,
	UnderstandingRecord,
} from '../types'
import {
	brainEvolutionCollectionSpec,
	brainInternalNeuronCollectionSpec,
	brainNeuronCollectionSpec,
	brainStateCollectionSpec,
	dismissedBatchCollectionSpec,
	neuronEvolutionCollectionSpec,
	neuronStateCollectionSpec,
	observationCollectionSpec,
	type StoreCollectionSpec,
	understandingCollectionSpec,
} from './specs'

export interface NeuronStoreCollections {
	observations: NeuronCollection<ObservationRecord>
	understanding: NeuronCollection<UnderstandingRecord>
	evolution: NeuronCollection<EvolutionRecord>
	state: NeuronCollection<StateRecord>
}

export interface BrainStoreCollections {
	state: BrainCollection<BrainStateRecord>
	neurons: BrainCollection<BrainNeuronRecord>
	internalNeurons: BrainCollection<BrainNeuronRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dismissedBatches: BrainCollection<DismissedBatchRecord>
}

export type NeuronCollectionFactory = <T extends { id: string }>(
	spec: StoreCollectionSpec<T>,
) => NeuronCollection<T>

export type BrainCollectionFactory = <T extends { id: string }>(
	spec: StoreCollectionSpec<T>,
) => BrainCollection<T>

export function createNeuronStoreCollections(
	createCollection: NeuronCollectionFactory,
): NeuronStoreCollections {
	return {
		observations: createCollection(observationCollectionSpec),
		understanding: createCollection(understandingCollectionSpec),
		evolution: createCollection(neuronEvolutionCollectionSpec),
		state: createCollection(neuronStateCollectionSpec),
	}
}

export function createBrainStoreCollections(
	createCollection: BrainCollectionFactory,
): BrainStoreCollections {
	return {
		state: createCollection(brainStateCollectionSpec),
		neurons: createCollection(brainNeuronCollectionSpec),
		internalNeurons: createCollection(brainInternalNeuronCollectionSpec),
		evolution: createCollection(brainEvolutionCollectionSpec),
		dismissedBatches: createCollection(dismissedBatchCollectionSpec),
	}
}
