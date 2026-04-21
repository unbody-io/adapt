import type {
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	DismissedBatchRecord,
	EvolutionRecord,
	ObservationRecord,
	StateRecord,
	UnderstandingRecord,
} from '../types'

export type CollectionFieldKind = 'text' | 'real' | 'integer' | 'json'

export interface CollectionFieldSpec<T extends { id: string }> {
	name: keyof T & string
	kind: CollectionFieldKind
	nullable?: boolean
	defaultSql?: string
}

export interface CollectionSearchSpec {
	strategy: 'fulltext'
}

export interface StoreCollectionSpec<T extends { id: string }> {
	table: string
	fields: readonly CollectionFieldSpec<T>[]
	indexes?: readonly (keyof T & string)[]
	search?: CollectionSearchSpec
}

export const observationCollectionSpec: StoreCollectionSpec<ObservationRecord> =
	{
		table: 'observations',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'data', kind: 'json' },
			{ name: 'metadata_importance', kind: 'real' },
			{ name: 'metadata_tokens', kind: 'integer' },
			{ name: 'metadata_status', kind: 'text' },
			{ name: 'metadata_created_at', kind: 'text' },
		],
		indexes: ['metadata_status'],
	}

export const understandingCollectionSpec: StoreCollectionSpec<UnderstandingRecord> =
	{
		table: 'understanding',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'data', kind: 'json' },
			{ name: 'metadata_confidence', kind: 'real' },
			{ name: 'metadata_created_at', kind: 'text' },
			{ name: 'metadata_updated_at', kind: 'text' },
		],
		indexes: ['metadata_updated_at'],
		search: { strategy: 'fulltext' },
	}

export const neuronEvolutionCollectionSpec: StoreCollectionSpec<EvolutionRecord> =
	{
		table: 'evolution',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'summary', kind: 'text' },
			{ name: 'reasoning', kind: 'text', nullable: true },
			{ name: 'significance', kind: 'text' },
			{ name: 'created_at', kind: 'text' },
		],
		indexes: ['created_at'],
	}

export const neuronStateCollectionSpec: StoreCollectionSpec<StateRecord> = {
	table: 'state',
	fields: [
		{ name: 'id', kind: 'text' },
		{ name: 'value', kind: 'json' },
		{ name: 'updated_at', kind: 'text' },
	],
	indexes: ['updated_at'],
}

export const brainStateCollectionSpec: StoreCollectionSpec<BrainStateRecord> = {
	table: 'state',
	fields: [
		{ name: 'id', kind: 'text' },
		{ name: 'value', kind: 'json' },
		{ name: 'updated_at', kind: 'text' },
	],
	indexes: ['updated_at'],
}

export const brainNeuronCollectionSpec: StoreCollectionSpec<BrainNeuronRecord> =
	{
		table: 'neurons',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'type', kind: 'text' },
		],
		indexes: ['type'],
	}

export const brainInternalNeuronCollectionSpec: StoreCollectionSpec<BrainNeuronRecord> =
	{
		...brainNeuronCollectionSpec,
		table: 'internal_neurons',
	}

export const brainEvolutionCollectionSpec: StoreCollectionSpec<BrainEvolutionRecord> =
	{
		table: 'evolution',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'decisions', kind: 'json' },
			{ name: 'source', kind: 'text' },
			{ name: 'created_at', kind: 'text' },
		],
		indexes: ['created_at'],
	}

export const dismissedBatchCollectionSpec: StoreCollectionSpec<DismissedBatchRecord> =
	{
		table: 'dismissed_batches',
		fields: [
			{ name: 'id', kind: 'text' },
			{ name: 'data', kind: 'json' },
			{ name: 'gaps', kind: 'json' },
			{ name: 'timestamp', kind: 'text' },
			{ name: 'retryCount', kind: 'integer', defaultSql: '0' },
			{ name: 'status', kind: 'text', defaultSql: "'pending'" },
		],
		indexes: ['status', 'timestamp'],
	}
