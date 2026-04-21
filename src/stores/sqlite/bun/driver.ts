import { Database } from 'bun:sqlite'
import type {
	SQLiteDatabase,
	SQLiteRunResult,
	SQLiteStatement,
} from '../core/types'

function createStatement<Row>(
	statement: ReturnType<Database['prepare']>,
): SQLiteStatement<Row> {
	return {
		run(...params: unknown[]): SQLiteRunResult {
			const result = statement.run(...params) as {
				changes?: number
			}
			return { changes: result.changes ?? 0 }
		},
		get(...params: unknown[]): Row | undefined {
			const row = statement.get(...params) as Row | null
			return row ?? undefined
		},
		all(...params: unknown[]): Row[] {
			return statement.all(...params) as Row[]
		},
	}
}

export function openBunSQLiteDatabase(
	path: string = ':memory:',
): SQLiteDatabase {
	const db = new Database(path)

	return {
		exec(sql: string): void {
			db.exec(sql)
		},
		prepare<Row = Record<string, unknown>>(sql: string): SQLiteStatement<Row> {
			return createStatement<Row>(db.prepare(sql))
		},
		transaction<TArgs extends unknown[]>(
			fn: (...args: TArgs) => void,
		): (...args: TArgs) => void {
			return db.transaction(fn)
		},
		close(): void {
			db.close()
		},
	}
}
