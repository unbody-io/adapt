/**
 * SQLite store implementation — persistent adapter using better-sqlite3.
 */

import { createNeuronStoreCollections } from '../../internal/builders'
import {
	neuronEvolutionCollectionSpec,
	neuronStateCollectionSpec,
	observationCollectionSpec,
	type StoreCollectionSpec,
	understandingCollectionSpec,
} from '../../internal/specs'
import type {
	EvolutionRecord,
	NeuronCollection,
	NeuronStore,
	ObservationRecord,
	StateRecord,
	UnderstandingRecord,
} from '../../types'
import { SQLiteNeuronCollection } from '../core/collection'
import { ensureSqliteCollectionSchema } from '../core/schema'
import type { SQLiteDatabase } from '../core/types'
import { openNodeSQLiteDatabase } from './driver'

export { SQLiteNeuronCollection }

function initializeNeuronStoreSchema(db: SQLiteDatabase): void {
	ensureSqliteCollectionSchema(db, observationCollectionSpec)
	ensureSqliteCollectionSchema(db, understandingCollectionSpec)
	ensureSqliteCollectionSchema(db, neuronEvolutionCollectionSpec)
	ensureSqliteCollectionSchema(db, neuronStateCollectionSpec)
}

export class SQLiteNeuronStore implements NeuronStore {
	private readonly db: SQLiteDatabase
	observations: NeuronCollection<ObservationRecord>
	understanding: NeuronCollection<UnderstandingRecord>
	evolution: NeuronCollection<EvolutionRecord>
	state: NeuronCollection<StateRecord>

	constructor(path: string = ':memory:') {
		this.db = openNodeSQLiteDatabase(path)
		this.db.exec('PRAGMA journal_mode = WAL')
		initializeNeuronStoreSchema(this.db)

		const createCollection = <T extends { id: string }>(
			spec: StoreCollectionSpec<T>,
		): NeuronCollection<T> => new SQLiteNeuronCollection(this.db, spec)
		const collections = createNeuronStoreCollections(createCollection)
		this.observations = collections.observations
		this.understanding = collections.understanding
		this.evolution = collections.evolution
		this.state = collections.state
	}

	async dispose(): Promise<void> {
		this.db.close()
	}
}
