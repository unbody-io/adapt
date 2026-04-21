declare module 'bun:sqlite' {
	export interface Statement<Row = Record<string, unknown>> {
		run(...params: unknown[]): { changes?: number; lastInsertRowid?: number }
		get(...params: unknown[]): Row | null
		all(...params: unknown[]): Row[]
	}

	export class Database {
		constructor(filename?: string)
		exec(sql: string): this
		prepare<Row = Record<string, unknown>>(sql: string): Statement<Row>
		transaction<TArgs extends unknown[]>(
			fn: (...args: TArgs) => void,
		): (...args: TArgs) => void
		close(): void
	}
}
