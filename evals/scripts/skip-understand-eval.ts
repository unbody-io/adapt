/**
 * Eval: skipUnderstand — observer-only neurons (#20)
 *
 * Verifies that a neuron created with `skipUnderstand: true` becomes a pure
 * observer: it runs the observe phase and stores observations, but NEVER
 * synthesizes understanding — not on threshold, not on forceSynthesize.
 *
 * Objectives (reviewer judges — no pass/fail in the script):
 *   1. Observer-only neuron stores observations from learn() — observationCount
 *      rises, getObservations() returns records.
 *   2. It never synthesizes — synthesisCount stays 0, getUnderstanding() stays
 *      empty, even after the buffer exceeds maxObservations.
 *   3. forceSynthesize does not override skipUnderstand — still no synthesis.
 *   4. Control: an identical neuron WITHOUT skipUnderstand, same data and
 *      thresholds, DOES synthesize — proving the data would otherwise trigger it.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/skip-understand-eval.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { MemoryNeuronStore, TextNeuron } from '../../src'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-3-flash-preview'

const INSTRUCTIONS =
	'Track customer support tickets — what the customer reported and which ' +
	'product area it concerns.'

const TICKETS = [
	'A customer reports the export-to-CSV button does nothing when clicked on the reports page.',
	'A customer says the mobile app logs them out every few minutes since the last update.',
	'A customer asks whether bulk-editing tags is possible — it is not a feature yet.',
	'A customer reports invoice PDFs show the wrong billing address after the account was renamed.',
]

async function runNeuron(label: string, skipUnderstand: boolean) {
	console.log(`\n──────── ${label} (skipUnderstand: ${skipUnderstand}) ────────`)

	const neuron = await TextNeuron.create({
		model: openrouter(MODEL),
		id: skipUnderstand ? 'observer-only' : 'normal',
		name: label,
		description: 'Tracks customer support tickets',
		instructions: INSTRUCTIONS,
		store: new MemoryNeuronStore(),
		governance: { strategy: 'continuous' },
		skipUnderstand,
		understand: { thresholds: { minImportance: 0.15, maxObservations: 3 } },
	})

	console.log(`  understand prompt after init: ${
		neuron.getUnderstandSystemPrompt() === null
			? 'null (not built)'
			: `${neuron.getUnderstandSystemPrompt()?.length} chars`
	}`)

	// Ingest — 4 tickets, maxObservations 3 so a normal neuron would synthesize.
	await neuron.learn(TICKETS)
	// Explicitly try to force synthesis.
	await neuron.learn([], { forceSynthesize: true })

	const observations = await neuron.getObservations()
	const understanding = await neuron.getUnderstanding()
	const metrics = neuron.getMetrics()
	const buffer = await neuron.getBufferState()

	console.log(`  observationCount: ${metrics.ingestion.observationCount}`)
	console.log(`  dismissalCount:   ${metrics.ingestion.dismissalCount}`)
	console.log(`  synthesisCount:   ${metrics.ingestion.synthesisCount}`)
	console.log(`  buffer count:     ${buffer.count}`)
	console.log(`  getObservations(): ${observations.length} records`)
	for (const o of observations.slice(0, 8)) {
		console.log(`    - [${o.metadata_status}] ${JSON.stringify(o.data).slice(0, 110)}`)
	}
	console.log(`  understanding (${understanding.length} chars):`)
	console.log(`    ${understanding ? understanding.slice(0, 400) : '(empty)'}`)
}

async function main() {
	console.log('Eval: skipUnderstand — observer-only neurons (#20)')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	await runNeuron('Observer-only neuron', true)
	await runNeuron('Control neuron', false)

	console.log('\nEval complete.')
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
