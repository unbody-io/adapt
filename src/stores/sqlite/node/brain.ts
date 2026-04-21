/**
 * SQLite brain store implementation — persistent adapter using better-sqlite3.
 */

import { createBrainStoreCollections } from '../../internal/builders'
import {
	brainEvolutionCollectionSpec,
	brainInternalNeuronCollectionSpec,
	brainNeuronCollectionSpec,
	brainStateCollectionSpec,
	dismissedBatchCollectionSpec,
	type StoreCollectionSpec,
} from '../../internal/specs'
import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	BrainStore,
	DismissedBatchRecord,
} from '../../types'
import { SQLiteBrainCollection } from '../core/collection'
import { ensureSqliteCollectionSchema } from '../core/schema'
import type { SQLiteDatabase } from '../core/types'
import { openNodeSQLiteDatabase } from './driver'

export { SQLiteBrainCollection }

function initializeBrainStoreSchema(db: SQLiteDatabase): void {
	ensureSqliteCollectionSchema(db, brainStateCollectionSpec)
	ensureSqliteCollectionSchema(db, brainNeuronCollectionSpec)
	ensureSqliteCollectionSchema(db, brainInternalNeuronCollectionSpec)
	ensureSqliteCollectionSchema(db, brainEvolutionCollectionSpec)
	ensureSqliteCollectionSchema(db, dismissedBatchCollectionSpec)
}

export class SQLiteBrainStore implements BrainStore {
	private readonly db: SQLiteDatabase
	state: BrainCollection<BrainStateRecord>
	neurons: BrainCollection<BrainNeuronRecord>
	internalNeurons: BrainCollection<BrainNeuronRecord>
	evolution: BrainCollection<BrainEvolutionRecord>
	dismissedBatches: BrainCollection<DismissedBatchRecord>

	constructor(path: string = ':memory:') {
		this.db = openNodeSQLiteDatabase(path)
		this.db.exec('PRAGMA journal_mode = WAL')
		initializeBrainStoreSchema(this.db)

		const createCollection = <T extends { id: string }>(
			spec: StoreCollectionSpec<T>,
		): BrainCollection<T> => new SQLiteBrainCollection(this.db, spec)
		const collections = createBrainStoreCollections(createCollection)
		this.state = collections.state
		this.neurons = collections.neurons
		this.internalNeurons = collections.internalNeurons
		this.evolution = collections.evolution
		this.dismissedBatches = collections.dismissedBatches
	}

	async dispose(): Promise<void> {
		this.db.close()
	}
}
