import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SQLiteBrainStore, SQLiteNeuronStore } from '../src/sqlite/bun'
import { runBrainRestoreSmoke } from './helpers/brain-restore-smoke'

const tmpDirs: string[] = []

function createTmpDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'adapt-brain-smoke-bun-'))
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

describe('Brain SQLite restore smoke (bun)', () => {
	it('restores a brain from SQLite and answers the same question after reopening', async () => {
		const result = await runBrainRestoreSmoke(createTmpDir(), {
			createBrainStore: (dbPath) => new SQLiteBrainStore(dbPath),
			createNeuronStore: (dbPath) => new SQLiteNeuronStore(dbPath),
		})

		expect(result.injectStatus).toBe('synthesized')
		expect(result.firstUnderstanding).toContain('runtime-specific SQLite adapters')
		expect(result.secondUnderstanding).toBe(result.firstUnderstanding)
		expect(result.firstAsk.insight).toContain('runtime-specific SQLite adapters')
		expect(result.secondAsk.insight).toContain('runtime-specific SQLite adapters')
		expect(result.secondAsk.insight).toBe(result.firstAsk.insight)
		expect(result.restoredNeuronCount).toBe(1)
		expect(result.callsBeforeRestoreInitialize).toBe(0)
		expect(result.callsAfterRestoreInitialize).toBe(0)
		expect(result.callsAfterRestoreAsk).toBe(2)
	})
})
