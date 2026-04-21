import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SQLiteBrainStore, SQLiteNeuronStore } from '../src/sqlite'

const tmpDirs: string[] = []

function createTmpDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'adapt-store-node-'))
	tmpDirs.push(dir)
	return dir
}

afterEach(() => {
	while (tmpDirs.length > 0) {
		const dir = tmpDirs.pop()
		if (dir) {
			rmSync(dir, { recursive: true, force: true })
		}
	}
})

describe('SQLite store persistence (node)', () => {
	it('restores neuron store data after reopening the same database', async () => {
		const dir = createTmpDir()
		const dbPath = join(dir, 'neuron.db')

		{
			const store = new SQLiteNeuronStore(dbPath)
			await store.state.add({
				id: 'instructions',
				value: 'Track engineering preferences.',
				updated_at: new Date().toISOString(),
			})
			await store.observations.add({
				id: 'obs-1',
				data: 'Prefers composition over inheritance.',
				metadata_importance: 0.8,
				metadata_tokens: 6,
				metadata_status: 'processed',
				metadata_created_at: new Date().toISOString(),
			})
			await store.understanding.add({
				id: 'current',
				data: 'Engineering preferences: composition over inheritance.',
				metadata_confidence: 0.95,
				metadata_created_at: new Date().toISOString(),
				metadata_updated_at: new Date().toISOString(),
			})
			await store.evolution.add({
				id: 'evo-1',
				summary: 'Captured engineering preference',
				significance: 'notable',
				created_at: new Date().toISOString(),
			})
			await store.dispose()
		}

		{
			const reopened = new SQLiteNeuronStore(dbPath)
			expect(await reopened.state.get('instructions')).toMatchObject({
				value: 'Track engineering preferences.',
			})
			expect(await reopened.observations.count({ metadata_status: 'processed' })).toBe(1)
			expect(await reopened.understanding.search('composition')).toHaveLength(1)
			expect(await reopened.evolution.get('evo-1')).toMatchObject({
				summary: 'Captured engineering preference',
			})
			await reopened.dispose()
		}
	})

	it('restores brain store data after reopening the same database', async () => {
		const dir = createTmpDir()
		const dbPath = join(dir, 'brain.db')

		{
			const store = new SQLiteBrainStore(dbPath)
			await store.state.add({
				id: 'prompt',
				value: 'Track engineering patterns.',
				updated_at: new Date().toISOString(),
			})
			await store.neurons.add({ id: 'engineering', type: 'text' })
			await store.internalNeurons.add({ id: '__internal_gaps', type: 'text' })
			await store.evolution.add({
				id: 'brain-evo-1',
				decisions: [{ action: 'create', neuronId: 'engineering' }],
				source: 'auto',
				created_at: new Date().toISOString(),
			})
			await store.dismissedBatches.add({
				id: 'batch-1',
				data: [{ note: 'ignored input' }],
				gaps: ['engineering'],
				timestamp: new Date().toISOString(),
				retryCount: 0,
				status: 'pending',
			})
			await store.dispose()
		}

		{
			const reopened = new SQLiteBrainStore(dbPath)
			expect(await reopened.state.get('prompt')).toMatchObject({
				value: 'Track engineering patterns.',
			})
			expect(await reopened.neurons.get('engineering')).toMatchObject({
				type: 'text',
			})
			expect(await reopened.internalNeurons.get('__internal_gaps')).toMatchObject({
				type: 'text',
			})
			expect(await reopened.evolution.count()).toBe(1)
			expect(await reopened.dismissedBatches.list({ status: 'pending' })).toHaveLength(1)
			await reopened.dispose()
		}
	})
})
