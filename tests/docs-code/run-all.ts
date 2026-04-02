/**
 * Runner for all docs code tests
 *
 * Executes each test file sequentially and reports results.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx tests/docs-code/run-all.ts
 */

import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(__dirname)
	.filter(f => f.endsWith('.ts') && f !== 'run-all.ts')
	.sort()

const results: Array<{ file: string; passed: boolean; duration: number }> = []

for (const file of files) {
	const filePath = join(__dirname, file)
	const start = Date.now()
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`▶ ${file}`)
	console.log('═'.repeat(60))

	try {
		execSync(`npx tsx ${filePath}`, {
			stdio: 'inherit',
			env: process.env,
			timeout: 300_000,
		})
		results.push({ file, passed: true, duration: Date.now() - start })
	} catch {
		results.push({ file, passed: false, duration: Date.now() - start })
	}
}

console.log(`\n${'═'.repeat(60)}`)
console.log('DOCS CODE TEST RESULTS')
console.log('═'.repeat(60))

for (const r of results) {
	const status = r.passed ? '✓' : '✗'
	const time = `${(r.duration / 1000).toFixed(1)}s`
	console.log(`  ${status} ${r.file} (${time})`)
}

const failedCount = results.filter(r => !r.passed).length
console.log(`\n${results.length - failedCount}/${results.length} passed`)

if (failedCount > 0) process.exit(1)
