import { describe, expect, it } from 'bun:test'
import { MemoryBrainStore, MemoryNeuronStore } from '../src/stores'
import {
	SQLiteBrainStore,
	SQLiteNeuronStore,
} from '../src/stores/sqlite/bun'
import {
	registerBrainStoreContract,
	registerNeuronStoreContract,
} from './helpers/store-contract'

const api = { describe, it, expect }

registerNeuronStoreContract(api, 'MemoryNeuronStore (bun)', () => new MemoryNeuronStore())
registerNeuronStoreContract(api, 'SQLiteNeuronStore (bun)', () => new SQLiteNeuronStore())

registerBrainStoreContract(api, 'MemoryBrainStore (bun)', () => new MemoryBrainStore())
registerBrainStoreContract(api, 'SQLiteBrainStore (bun)', () => new SQLiteBrainStore())
