import { describe, expect, it } from 'vitest'
import { MemoryBrainStore, MemoryNeuronStore } from '../src/stores'
import {
	SQLiteBrainStore,
	SQLiteNeuronStore,
} from '../src/stores/sqlite/node'
import {
	registerBrainStoreContract,
	registerNeuronStoreContract,
} from './helpers/store-contract'

const api = { describe, it, expect }

registerNeuronStoreContract(api, 'MemoryNeuronStore', () => new MemoryNeuronStore())
registerNeuronStoreContract(api, 'SQLiteNeuronStore (node)', () => new SQLiteNeuronStore())

registerBrainStoreContract(api, 'MemoryBrainStore', () => new MemoryBrainStore())
registerBrainStoreContract(api, 'SQLiteBrainStore (node)', () => new SQLiteBrainStore())
