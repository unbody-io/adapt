/**
 * SQLite brain store implementation — persistent adapter using better-sqlite3.
 *
 * SQLiteBrainCollection<T> is generic across all 3 namespaces.
 * SQLiteBrainStore assembles 3 collections into a BrainStore, creating tables on construction.
 */

import Database from 'better-sqlite3'
import type {
	BrainCollection,
	BrainEvolutionRecord,
	BrainNeuronRecord,
	BrainStateRecord,
	BrainStore,
	DismissedBatchRecord,
} from '../types'

// ── Column metadata ──────────────────────────────────────────────────────────

interface ColumnDef {
	name: string
	json: boolean
}

const stateColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'value', json: true },
	{ name: 'updated_at', json: false },
]

const neuronsColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'type', json: false },
]

const evolutionColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'decisions', json: true },
	{ name: 'source', json: false },
	{ name: 'created_at', json: false },
]

const dismissedBatchesColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'data', json: true },
	{ name: 'gaps', json: true },
	{ name: 'timestamp', json: false },
	{ name: 'retryCount', json: false },
	{ name: 'status', json: false },
]

// ── SQLiteBrainCollection ────────────────────────────────────────────────────

export class SQLiteBrainCollection<T extends { id: string }>
	implements BrainCollection<T>
{
	constructor(
		private db: Database.Database,
		private table: string,
		private columns: ColumnDef[],
	) {}

	async add(item: T): Promise<void> {
		const cols = this.columns.map((c) => c.name)
		const placeholders = cols.map(() => '?')
		const values = cols.map((col) => {
			const def = this.columns.find((c) => c.name === col)!
			const raw = (item as Record<string, unknown>)[col]
			return def.json ? JSON.stringify(raw) : (raw ?? null)
		})
		this.db
			.prepare(
				`INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
			)
			.run(...values)
	}

	async get(id: string): Promise<T | undefined> {
		const row = this.db
			.prepare(`SELECT * FROM ${this.table} WHERE id = ?`)
			.get(id) as Record<string, unknown> | undefined
		if (!row) return undefined
		return this.parseRow(row)
	}

	async list(filter?: Record<string, unknown>): Promise<T[]> {
		if (!filter) {
			const rows = this.db
				.prepare(`SELECT * FROM ${this.table}`)
				.all() as Record<string, unknown>[]
			return rows.map((r) => this.parseRow(r))
		}

		const entries = Object.entries(filter)
		const where = entries.map(([k]) => `${k} = ?`).join(' AND ')
		const values = entries.map(([, v]) => v)
		const rows = this.db
			.prepare(`SELECT * FROM ${this.table} WHERE ${where}`)
			.all(...values) as Record<string, unknown>[]
		return rows.map((r) => this.parseRow(r))
	}

	async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<void> {
		const existing = this.db
			.prepare(`SELECT * FROM ${this.table} WHERE id = ?`)
			.get(id) as Record<string, unknown> | undefined
		if (!existing) {
			throw new Error(`Record with id "${id}" not found`)
		}

		const parsed = this.parseRow(existing)
		const merged = { ...parsed, ...changes }

		const cols = this.columns.filter((c) => c.name !== 'id')
		const setClauses = cols.map((c) => `${c.name} = ?`)
		const values = cols.map((c) => {
			const raw = (merged as Record<string, unknown>)[c.name]
			return c.json ? JSON.stringify(raw) : (raw ?? null)
		})

		this.db
			.prepare(
				`UPDATE ${this.table} SET ${setClauses.join(', ')} WHERE id = ?`,
			)
			.run(...values, id)
	}

	async delete(id: string): Promise<void> {
		const result = this.db
			.prepare(`DELETE FROM ${this.table} WHERE id = ?`)
			.run(id)
		if (result.changes === 0) {
			throw new Error(`Record with id "${id}" not found`)
		}
	}

	async clear(): Promise<void> {
		this.db.prepare(`DELETE FROM ${this.table}`).run()
	}

	async count(filter?: Record<string, unknown>): Promise<number> {
		if (!filter) {
			const row = this.db
				.prepare(`SELECT COUNT(*) as cnt FROM ${this.table}`)
				.get() as { cnt: number }
			return row.cnt
		}
		const entries = Object.entries(filter)
		const where = entries.map(([k]) => `${k} = ?`).join(' AND ')
		const values = entries.map(([, v]) => v)
		const row = this.db
			.prepare(`SELECT COUNT(*) as cnt FROM ${this.table} WHERE ${where}`)
			.get(...values) as { cnt: number }
		return row.cnt
	}

	async addBatch(items: T[]): Promise<void> {
		const cols = this.columns.map((c) => c.name)
		const placeholders = cols.map(() => '?')
		const stmt = this.db.prepare(
			`INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
		)

		const insertMany = this.db.transaction((rows: T[]) => {
			for (const item of rows) {
				const values = cols.map((col) => {
					const def = this.columns.find((c) => c.name === col)!
					const raw = (item as Record<string, unknown>)[col]
					return def.json ? JSON.stringify(raw) : (raw ?? null)
				})
				stmt.run(...values)
			}
		})

		insertMany(items)
	}

	async dispose(): Promise<void> {
		/* no-op — store-level dispose handles db close */
	}

	private parseRow(row: Record<string, unknown>): T {
		const result: Record<string, unknown> = {}
		for (const col of this.columns) {
			const raw = row[col.name]
			if (col.json && typeof raw === 'string') {
				result[col.name] = JSON.parse(raw)
			} else {
				result[col.name] = raw ?? undefined
			}
		}
		return result as T
	}
}

// ── SQLiteBrainStore ─────────────────────────────────────────────────────────

export class SQLiteBrainStore implements BrainStore {
	private db: Database.Database
	state: SQLiteBrainCollection<BrainStateRecord>
	neurons: SQLiteBrainCollection<BrainNeuronRecord>
	internalNeurons: SQLiteBrainCollection<BrainNeuronRecord>
	evolution: SQLiteBrainCollection<BrainEvolutionRecord>
	dismissedBatches: SQLiteBrainCollection<DismissedBatchRecord>

	constructor(path: string = ':memory:') {
		this.db = new Database(path)
		this.db.pragma('journal_mode = WAL')

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS state (
				id TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS neurons (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS internal_neurons (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS evolution (
				id TEXT PRIMARY KEY,
				decisions TEXT NOT NULL,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS dismissed_batches (
				id TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				gaps TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				retryCount INTEGER NOT NULL DEFAULT 0,
				status TEXT NOT NULL DEFAULT 'pending'
			)
		`)

		// Indexes for common filter queries
		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_state_updated ON state(updated_at);
			CREATE INDEX IF NOT EXISTS idx_neurons_type ON neurons(type);
			CREATE INDEX IF NOT EXISTS idx_evolution_created ON evolution(created_at);
			CREATE INDEX IF NOT EXISTS idx_dismissed_batches_status ON dismissed_batches(status);
			CREATE INDEX IF NOT EXISTS idx_dismissed_batches_timestamp ON dismissed_batches(timestamp);
		`)

		this.state = new SQLiteBrainCollection<BrainStateRecord>(
			this.db,
			'state',
			stateColumns,
		)
		this.neurons = new SQLiteBrainCollection<BrainNeuronRecord>(
			this.db,
			'neurons',
			neuronsColumns,
		)
		this.internalNeurons = new SQLiteBrainCollection<BrainNeuronRecord>(
			this.db,
			'internal_neurons',
			neuronsColumns,
		)
		this.evolution = new SQLiteBrainCollection<BrainEvolutionRecord>(
			this.db,
			'evolution',
			evolutionColumns,
		)
		this.dismissedBatches = new SQLiteBrainCollection<DismissedBatchRecord>(
			this.db,
			'dismissed_batches',
			dismissedBatchesColumns,
		)
	}

	async dispose(): Promise<void> {
		this.db.close()
	}
}
