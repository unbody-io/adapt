/**
 * SQLite store implementation — persistent adapter using better-sqlite3.
 *
 * SQLiteNeuronCollection<T> is generic across all 4 namespaces.
 * SQLiteNeuronStore assembles 4 collections into a Store, creating tables on construction.
 */

import Database from 'better-sqlite3'
import type {
	NeuronCollection,
	EvolutionRecord,
	ObservationRecord,
	StateRecord,
	NeuronStore,
	UnderstandingRecord,
} from '../types'
import { extractStrings } from '../memory/neuron'

// ── FTS helpers ──────────────────────────────────────────────────────────────

/** Extract all string content from a record for FTS indexing */
function ftsContent(item: Record<string, unknown>, jsonCols: string[]): string {
	const parts: string[] = []
	for (const col of jsonCols) {
		const raw = item[col]
		if (raw !== undefined && raw !== null) {
			parts.push(...extractStrings(raw))
		}
	}
	// Also include non-JSON string columns
	for (const [key, val] of Object.entries(item)) {
		if (!jsonCols.includes(key) && typeof val === 'string' && key !== 'id') {
			parts.push(val)
		}
	}
	return parts.join(' ')
}

// ── Column metadata ──────────────────────────────────────────────────────────

interface ColumnDef {
	name: string
	json: boolean
}

const observationColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'data', json: true },
	{ name: 'metadata_importance', json: false },
	{ name: 'metadata_tokens', json: false },
	{ name: 'metadata_status', json: false },
	{ name: 'metadata_created_at', json: false },
]

const understandingColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'data', json: true },
	{ name: 'metadata_confidence', json: false },
	{ name: 'metadata_created_at', json: false },
	{ name: 'metadata_updated_at', json: false },
]

const evolutionColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'summary', json: false },
	{ name: 'reasoning', json: false },
	{ name: 'significance', json: false },
	{ name: 'created_at', json: false },
]

const stateColumns: ColumnDef[] = [
	{ name: 'id', json: false },
	{ name: 'value', json: true },
	{ name: 'updated_at', json: false },
]

// ── SQLiteNeuronCollection ─────────────────────────────────────────────────────────

export class SQLiteNeuronCollection<T extends { id: string }>
	implements NeuronCollection<T>
{
	private ftsTable: string | null = null
	private jsonCols: string[]

	constructor(
		private db: Database.Database,
		private table: string,
		private columns: ColumnDef[],
		opts?: { fts?: boolean },
	) {
		this.jsonCols = columns.filter((c) => c.json).map((c) => c.name)

		if (opts?.fts) {
			this.ftsTable = `${table}_fts`
			db.exec(
				`CREATE VIRTUAL TABLE IF NOT EXISTS ${this.ftsTable} USING fts5(id, content, tokenize='porter unicode61')`,
			)
		}
	}

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

		if (this.ftsTable) {
			const content = ftsContent(item as Record<string, unknown>, this.jsonCols)
			this.db
				.prepare(`INSERT INTO ${this.ftsTable} (id, content) VALUES (?, ?)`)
				.run((item as Record<string, unknown>).id, content)
		}
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

		if (this.ftsTable) {
			const content = ftsContent(merged as Record<string, unknown>, this.jsonCols)
			this.db
				.prepare(`UPDATE ${this.ftsTable} SET content = ? WHERE id = ?`)
				.run(content, id)
		}
	}

	async delete(id: string): Promise<void> {
		const result = this.db
			.prepare(`DELETE FROM ${this.table} WHERE id = ?`)
			.run(id)
		if (result.changes === 0) {
			throw new Error(`Record with id "${id}" not found`)
		}
		if (this.ftsTable) {
			this.db
				.prepare(`DELETE FROM ${this.ftsTable} WHERE id = ?`)
				.run(id)
		}
	}

	async clear(): Promise<void> {
		this.db.prepare(`DELETE FROM ${this.table}`).run()
		if (this.ftsTable) {
			this.db.prepare(`DELETE FROM ${this.ftsTable}`).run()
		}
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

	async search(query: string): Promise<T[]> {
		if (this.ftsTable) {
			// FTS5 tokenizes into words — "Enterprise SSO" matches records containing both words
			// Escape special FTS5 characters and quote each term
			const terms = query
				.split(/\s+/)
				.filter(Boolean)
				.map((t) => `"${t.replace(/"/g, '""')}"`)
			if (terms.length === 0) return []
			const ftsQuery = terms.join(' AND ')
			const rows = this.db
				.prepare(
					`SELECT t.* FROM ${this.table} t INNER JOIN ${this.ftsTable} f ON t.id = f.id WHERE f.${this.ftsTable} MATCH ?`,
				)
				.all(ftsQuery) as Record<string, unknown>[]
			return rows.map((r) => this.parseRow(r))
		}

		// Fallback: in-memory substring search
		const all = await this.list()
		const q = query.toLowerCase()
		return all.filter((item) =>
			extractStrings(item).some((s) => s.toLowerCase().includes(q)),
		)
	}

	async addBatch(items: T[]): Promise<void> {
		const cols = this.columns.map((c) => c.name)
		const placeholders = cols.map(() => '?')
		const stmt = this.db.prepare(
			`INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
		)
		const ftsStmt = this.ftsTable
			? this.db.prepare(
					`INSERT INTO ${this.ftsTable} (id, content) VALUES (?, ?)`,
				)
			: null

		const insertMany = this.db.transaction((rows: T[]) => {
			for (const item of rows) {
				const values = cols.map((col) => {
					const def = this.columns.find((c) => c.name === col)!
					const raw = (item as Record<string, unknown>)[col]
					return def.json ? JSON.stringify(raw) : (raw ?? null)
				})
				stmt.run(...values)
				if (ftsStmt) {
					const content = ftsContent(
						item as Record<string, unknown>,
						this.jsonCols,
					)
					ftsStmt.run((item as Record<string, unknown>).id, content)
				}
			}
		})

		insertMany(items)
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

// ── SQLiteNeuronStore ──────────────────────────────────────────────────────────────

export class SQLiteNeuronStore implements NeuronStore {
	private db: Database.Database
	observations: SQLiteNeuronCollection<ObservationRecord>
	understanding: SQLiteNeuronCollection<UnderstandingRecord>
	evolution: SQLiteNeuronCollection<EvolutionRecord>
	state: SQLiteNeuronCollection<StateRecord>

	constructor(path: string = ':memory:') {
		this.db = new Database(path)
		this.db.pragma('journal_mode = WAL')

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS observations (
				id TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				metadata_importance REAL NOT NULL,
				metadata_tokens INTEGER NOT NULL,
				metadata_status TEXT NOT NULL,
				metadata_created_at TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS understanding (
				id TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				metadata_confidence REAL NOT NULL,
				metadata_created_at TEXT NOT NULL,
				metadata_updated_at TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS evolution (
				id TEXT PRIMARY KEY,
				summary TEXT NOT NULL,
				reasoning TEXT,
				significance TEXT NOT NULL,
				created_at TEXT NOT NULL
			)
		`)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS state (
				id TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`)

		// Indexes for common filter queries
		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(metadata_status);
			CREATE INDEX IF NOT EXISTS idx_understanding_updated ON understanding(metadata_updated_at);
			CREATE INDEX IF NOT EXISTS idx_evolution_created ON evolution(created_at);
			CREATE INDEX IF NOT EXISTS idx_state_updated ON state(updated_at);
		`)

		this.observations = new SQLiteNeuronCollection<ObservationRecord>(
			this.db,
			'observations',
			observationColumns,
		)
		this.understanding = new SQLiteNeuronCollection<UnderstandingRecord>(
			this.db,
			'understanding',
			understandingColumns,
			{ fts: true },
		)
		this.evolution = new SQLiteNeuronCollection<EvolutionRecord>(
			this.db,
			'evolution',
			evolutionColumns,
		)
		this.state = new SQLiteNeuronCollection<StateRecord>(
			this.db,
			'state',
			stateColumns,
		)
	}

	async dispose(): Promise<void> {
		this.db.close()
	}
}
