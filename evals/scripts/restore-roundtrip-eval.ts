/**
 * Eval: Brain & Neuron restore round-trip (issue #8 / brain-construction-persistence-redesign)
 *
 * Fast, focused real-LLM check that the new construction/persistence API works:
 *   1. Brain.create({...}) on a fresh SQLite path persists everything.
 *   2. Brain.create on a populated path THROWS.
 *   3. Brain.restore("path.db") rehydrates models as gateway strings, restores
 *      neurons via getNeuronStore sibling files, and answers the same question
 *      with knowledge that references the injected data.
 *   4. TextNeuron.create({...}) standalone → dispose → TextNeuron.restore("path.db")
 *      survives the round-trip and queries against the restored understanding.
 *
 * This complements:
 *   - tests/brain-restore-config.test.ts (mocked, contract-only)
 *   - tests/neuron-restore-config.test.ts (mocked, contract-only)
 *   - evals/scripts/usecase-behavior-brain.ts (full real-LLM, but heavy ~85 events)
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/restore-roundtrip-eval.ts
 */

import { Brain, TextNeuron } from '../../src'
import { SQLiteBrainStore, SQLiteNeuronStore } from '../../src/sqlite'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) {
	console.error('OPENROUTER_API_KEY required.')
	process.exit(1)
}
const openrouter = createOpenRouter({ apiKey })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

const tmp = mkdtempSync(join(tmpdir(), 'adapt-restore-roundtrip-'))
const brainPath = join(tmp, 'brain.db')
const neuronPath = join(tmp, 'standalone-neuron.db')

const startTime = Date.now()
const elapsed = () => ((Date.now() - startTime) / 1000).toFixed(1)

let passed = 0
let failed = 0
function check(cond: boolean, label: string) {
	if (cond) {
		passed++
		console.log(`  ✓ ${label}`)
	} else {
		failed++
		console.log(`  ✗ ${label}`)
	}
}

async function main() {
	console.log('Eval: Brain & Neuron restore round-trip')
	console.log(`Model: ${MODEL}`)
	console.log(`Tmp: ${tmp}`)

	try {
		// ── 1. Brain.create on fresh path ─────────────────────────────────────
		console.log('\n━━━ 1. Brain.create — fresh ━━━')
		const brain = await Brain.create({
			prompt:
				'Track engineering decisions and the rationale behind technical choices.',
			model,
			autoSetup: false,
			store: new SQLiteBrainStore(brainPath),
			neurons: [
				{
					id: 'engineering-decisions',
					type: 'text',
					name: 'Engineering Decisions',
					description: 'Tracks technical decisions and tradeoffs.',
					instructions:
						'Track engineering decisions, runtime tradeoffs, and rationale for technical changes.',
					// skipObservation makes the test deterministic: data goes straight to
					// the understanding pipeline, so we don't depend on the observe LLM
					// returning well-formed JSON for a single short input.
					skipObservation: true,
					observationSchema: { type: 'string' },
					understandingSchema: { type: 'string' },
				},
			],
			internalNeurons: {
				globalUnderstanding: false,
				globalQueryUnderstanding: false,
				injectionGaps: false,
				queryGaps: false,
			},
			evolution: { enabled: false },
			learning: { understand: { thresholds: { maxObservations: 1 } } },
		})
		console.log(`  [${elapsed()}s] created`)

		await brain.inject([
			'We chose runtime-specific SQLite adapters (better-sqlite3 for Node, bun:sqlite for Bun) so the core stays runtime-agnostic.',
		])
		console.log(`  [${elapsed()}s] injected`)

		const decisionRefs = /better[-\s]?sqlite3|bun:sqlite|runtime[-\s]?specific|runtime[-\s]?agnostic/i
		const firstAnswer = await brain.ask('What engineering decision was made about SQLite?')
		console.log(`  [${elapsed()}s] first ask: ${firstAnswer.insight.slice(0, 120)}...`)
		check(
			decisionRefs.test(firstAnswer.insight),
			'first ask references the actual injected decision (not generic SQLite trivia)',
		)

		await brain.dispose()
		console.log(`  [${elapsed()}s] disposed`)

		// Verify sibling neuron file exists (proves getNeuronStore wrote there).
		const expectedNeuronFile = join(tmp, 'brain.engineering-decisions.db')
		check(
			existsSync(expectedNeuronFile),
			`getNeuronStore created sibling file: ${expectedNeuronFile}`,
		)

		// ── 2. Brain.create on populated store throws ─────────────────────────
		console.log('\n━━━ 2. Brain.create on populated store throws ━━━')
		let createOnPopulatedThrew = false
		try {
			await Brain.create({
				prompt: 'whatever',
				model,
				autoSetup: false,
				store: new SQLiteBrainStore(brainPath),
				neurons: [],
			})
		} catch (err) {
			createOnPopulatedThrew = /already exists/i.test(
				err instanceof Error ? err.message : String(err),
			)
		}
		check(createOnPopulatedThrew, 'Brain.create on populated store throws "already exists"')

		// ── 3. Brain.restore via path-string sugar ────────────────────────────
		console.log('\n━━━ 3. Brain.restore("path") — path-string sugar ━━━')
		const restored = await Brain.restore(brainPath)
		console.log(`  [${elapsed()}s] restored`)

		check(
			restored.getNeurons().length === 1,
			`restored brain has 1 neuron (got ${restored.getNeurons().length})`,
		)
		check(
			restored.getNeuron('engineering-decisions') !== undefined,
			'restored neuron id matches',
		)

		// Models rehydrated as gateway strings — swap back to the live provider so
		// the second ask uses a direct provider (avoids unauthenticated-gateway
		// errors when AI_GATEWAY_API_KEY isn't set in CI).
		await restored.update({
			model,
			query: { model },
			learning: { query: { model } },
		})

		const secondAnswer = await restored.ask('What engineering decision was made about SQLite?')
		console.log(`  [${elapsed()}s] second ask: ${secondAnswer.insight.slice(0, 120)}...`)
		check(
			decisionRefs.test(secondAnswer.insight),
			'restored brain references the actual persisted decision (not generic trivia)',
		)

		await restored.dispose()

		// ── 4. Brain.restore on empty store throws ────────────────────────────
		console.log('\n━━━ 4. Brain.restore on empty store throws ━━━')
		const emptyDir = mkdtempSync(join(tmpdir(), 'adapt-empty-'))
		const emptyPath = join(emptyDir, 'empty.db')
		let restoreOnEmptyThrew = false
		try {
			await Brain.restore(emptyPath)
		} catch (err) {
			restoreOnEmptyThrew = /no brain found/i.test(
				err instanceof Error ? err.message : String(err),
			)
		}
		rmSync(emptyDir, { recursive: true, force: true })
		check(restoreOnEmptyThrew, 'Brain.restore on empty store throws "no brain found"')

		// ── 5. Standalone neuron restore round-trip ───────────────────────────
		console.log('\n━━━ 5. TextNeuron.create → restore ━━━')
		const neuron = await TextNeuron.create({
			id: 'sqlite-decisions',
			name: 'SQLite Decisions',
			instructions: 'Track engineering decisions about SQLite usage.',
			model,
			store: new SQLiteNeuronStore(neuronPath),
			understand: { thresholds: { maxObservations: 1 } },
		})
		console.log(`  [${elapsed()}s] standalone neuron created`)

		await neuron.learn([
			'We picked better-sqlite3 over node:sqlite because it is faster and synchronous.',
		])
		const neuronFirstAnswer = await neuron.query('Which SQLite library did we pick and why?')
		console.log(`  [${elapsed()}s] neuron first query: ${neuronFirstAnswer.insight.slice(0, 120)}...`)
		check(
			/better[-\s]?sqlite3/i.test(neuronFirstAnswer.insight),
			'standalone neuron answers from injected data',
		)

		await neuron.dispose()

		const restoredNeuron = await TextNeuron.restore(neuronPath, { id: 'sqlite-decisions' })
		console.log(`  [${elapsed()}s] standalone neuron restored`)
		await restoredNeuron.update({ model, query: { model } })

		const neuronSecondAnswer = await restoredNeuron.query('Which SQLite library did we pick and why?')
		console.log(`  [${elapsed()}s] neuron second query: ${neuronSecondAnswer.insight.slice(0, 120)}...`)
		check(
			/better[-\s]?sqlite3/i.test(neuronSecondAnswer.insight),
			'restored standalone neuron answers same question against persisted understanding',
		)

		await restoredNeuron.dispose()

		// ── Summary ───────────────────────────────────────────────────────────
		console.log(`\n${'═'.repeat(60)}`)
		console.log(`restore-roundtrip: ${passed} passed, ${failed} failed (${elapsed()}s total)`)
		if (failed > 0) process.exit(1)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(1)
})
