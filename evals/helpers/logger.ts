/**
 * Eval script logging utilities
 * Provides colored console output for observability
 */

export const logger = {
	/**
	 * Log a section header (bright cyan)
	 */
	logSection(title: string): void {
		console.log(`\n\x1b[96m━━━ ${title} ━━━\x1b[0m`)
	},

	/**
	 * Log state information (white label, formatted JSON)
	 */
	logState(label: string, data: any): void {
		console.log(`\x1b[37m${label}:\x1b[0m`)
		console.log(JSON.stringify(data, null, 2))
	},

	/**
	 * Log an event (green name, yellow payload)
	 */
	logEvent(event: { type: string; payload?: any }): void {
		console.log(
			`\x1b[32m[EVENT]\x1b[0m ${event.type}`,
			event.payload ? `\x1b[33m${JSON.stringify(event.payload, null, 2)}\x1b[0m` : '',
		)
	},

	/**
	 * Log an assertion result (green ✓ or red ✗)
	 */
	logAssertion(label: string, condition: boolean, message?: string): void {
		const symbol = condition ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
		const status = condition ? 'PASS' : 'FAIL'
		const msg = message ? ` - ${message}` : ''
		console.log(`${symbol} [${status}] ${label}${msg}`)
	},

	/**
	 * Log a metric change
	 */
	logMetric(name: string, before: number, after: number): void {
		const change = after - before
		const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→'
		const color = change > 0 ? '\x1b[32m' : change < 0 ? '\x1b[31m' : '\x1b[33m'
		console.log(
			`\x1b[36m[METRIC]\x1b[0m ${name}: ${before} ${color}${arrow}\x1b[0m ${after} (${change >= 0 ? '+' : ''}${change})`,
		)
	},

	/**
	 * Log an error (red)
	 */
	logError(message: string, error?: Error): void {
		console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`)
		if (error) {
			console.error(error)
		}
	},

	/**
	 * Log a success message (green)
	 */
	logSuccess(message: string): void {
		console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`)
	},

	/**
	 * Log a warning (yellow)
	 */
	logWarning(message: string): void {
		console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`)
	},
}
