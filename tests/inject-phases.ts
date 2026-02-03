/**
 * Inject test data phase by phase in small chunks
 * Usage: bun run tests/inject-phases.ts [phase-number]
 *
 * No args = all phases. Pass 1-5 to run a specific phase.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'http://localhost:3210'
const CHUNK_SIZE = 20 // items per request (matches default batchSize)
const DELAY_MS = 2000 // pause between chunks

const PHASE_FILES = [
	'phase-1-foundation.json',
	'phase-2-domain-stretch.json',
	'phase-3-coverage-gaps.json',
	'phase-4-noise.json',
	'phase-5-recovery.json',
]

async function injectChunk(items: string[]): Promise<void> {
	const res = await fetch(`${BASE_URL}/brain/inject`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: items }),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Inject failed (${res.status}): ${text}`)
	}

	const data = await res.json() as any
	const batch = data.batches?.[0]
	if (batch) {
		const statuses = batch.results.map((r: any) =>
			`${r.learnerId.slice(0, 15)}: ${r.result.status}`
		)
		console.log(`    ${statuses.join(' | ')}`)
	}
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function injectPhase(phaseNum: number) {
	const file = PHASE_FILES[phaseNum - 1]
	const path = join(import.meta.dir, 'data', file)
	const data = JSON.parse(readFileSync(path, 'utf-8'))
	const items: string[] = data.items

	console.log(`\n== Phase ${phaseNum}: ${data.name} (${items.length} items) ==`)
	console.log(`   ${data.purpose}`)

	// Split into chunks
	const chunks: string[][] = []
	for (let i = 0; i < items.length; i += CHUNK_SIZE) {
		chunks.push(items.slice(i, i + CHUNK_SIZE))
	}

	for (let i = 0; i < chunks.length; i++) {
		console.log(`  Chunk ${i + 1}/${chunks.length} (${chunks[i].length} items)`)
		await injectChunk(chunks[i])
		if (i < chunks.length - 1) {
			await sleep(DELAY_MS)
		}
	}

	console.log(`  Phase ${phaseNum} complete.`)
}

async function getStatus() {
	const res = await fetch(`${BASE_URL}/brain/status`)
	const data = await res.json() as any
	console.log(`\n-- Status: ${data.learners.length} learners --`)
	for (const l of data.learners) {
		const gov = l.governance
		const obs = l.buffer?.count ?? 0
		console.log(`  ${l.id}: activation=${gov.activation.toFixed(2)} status=${gov.status} buffer=${obs}`)
	}
}

// Main
const targetPhase = process.argv[2] ? parseInt(process.argv[2]) : null

if (targetPhase) {
	if (targetPhase < 1 || targetPhase > 5) {
		console.error('Phase must be 1-5')
		process.exit(1)
	}
	await injectPhase(targetPhase)
} else {
	for (let p = 1; p <= 5; p++) {
		await injectPhase(p)
		await getStatus()
		console.log('\n  Waiting 5s before next phase...')
		await sleep(5000)
	}
}

await getStatus()
console.log('\nDone.')
