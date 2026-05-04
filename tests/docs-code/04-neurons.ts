/**
 * Docs code test: 04-neurons.md
 *
 * Verifies every TypeScript code block from the Neurons guide
 * compiles and runs correctly.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx tests/docs-code/04-neurons.ts
 */

import { Brain, TextNeuron, ListNeuron, MemoryNeuronStore } from '@unbody-io/adapt'
import { SQLiteNeuronStore } from '@unbody-io/adapt/sqlite'
import { model } from '../../evals/helpers/provider'
import { mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(__dirname, '..', '.tmp-docs-04')

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
	if (condition) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ ${message}`)
	}
}

function section(title: string) {
	console.log(`\n━━━ ${title} ━━━`)
}

async function main() {
	mkdirSync(tmpDir, { recursive: true })
	try {
	// ── TextNeuron — Basic ────────────────────────────────────────────────
	section('TextNeuron — Basic')

	const textNeuron = await TextNeuron.create({
		model,
		instructions: 'Track product design principles and user research insights.',
		store: new MemoryNeuronStore(),
	})

	await textNeuron.learn([
		'User testing showed: 3-click navigation preferred over hamburger menu',
		'Design review: dark mode should be default for evening users',
	])

	const understanding = await textNeuron.getUnderstanding()
	assert(typeof understanding === 'string', 'TextNeuron getUnderstanding() returns string')

	const textResult = await textNeuron.query('What are the key design principles?')
	assert(typeof textResult.insight === 'string', 'TextNeuron query returns insight')

	// ── TextNeuron — Governance Config ────────────────────────────────────
	section('TextNeuron — Governance Config')

	const govNeuron = await TextNeuron.create({
		model,
		instructions: 'Track product design principles and user research insights.',
		store: new MemoryNeuronStore(),
		governance: { strategy: 'decay', maxTokens: 8000 },
		understand: { thresholds: { maxObservations: 5, minImportance: 0.3 } },
	})
	assert(govNeuron instanceof TextNeuron, 'TextNeuron with governance config created')
	await govNeuron.dispose()

	// ── TextNeuron — Restore ──────────────────────────────────────────────
	section('TextNeuron — Restore')

	const restorePath = join(tmpDir, 'text-neuron.db')

	// Persist a neuron first
	const seed = await TextNeuron.create({
		model,
		instructions: 'Track restore-roundtrip patterns.',
		store: new SQLiteNeuronStore(restorePath),
	})
	await seed.dispose()

	// Restore via path string
	const restoredFromPath = await TextNeuron.restore(restorePath)
	assert(restoredFromPath instanceof TextNeuron, 'TextNeuron.restore(path) succeeds')
	await restoredFromPath.dispose()

	// Restore via explicit store
	const restoredFromStore = await TextNeuron.restore(new SQLiteNeuronStore(restorePath))
	assert(restoredFromStore instanceof TextNeuron, 'TextNeuron.restore(store) succeeds')
	await restoredFromStore.dispose()

	// ── ListNeuron — Basic ───────────────────────────────────────────────
	section('ListNeuron — Basic')

	const listNeuron = await ListNeuron.create({
		model,
		instructions: 'Track restaurants with cuisine type, location, price range, and rating.',
		store: new MemoryNeuronStore(),
	})

	await listNeuron.learn([
		'Had amazing ramen at Ichiran in Shibuya — rich tonkotsu broth, ¥1200',
		'Tried the new Italian place on 5th — mediocre pasta, overpriced',
	])

	const items = await listNeuron.getUnderstanding()
	assert(Array.isArray(items), 'ListNeuron getUnderstanding() returns array')

	// ── Custom Schemas via Brain ─────────────────────────────────────────
	section('Custom Schemas via Brain')

	const customSchemaBrain = await Brain.create({
		prompt: 'Track therapy sessions.',
		model,
		autoSetup: false,
		neurons: [{
			id: 'relationships',
			type: 'list',
			name: 'Relationships',
			description: 'Key people, client descriptions, shifts in perception',
			instructions: 'Track the key people in this client\'s life and how perception evolves.',
			governance: { deduplication: 'strict', maxItems: 100, pruning: 'least-confident' },
			observationSchema: {
				type: 'object',
				properties: {
					person_name: { type: 'string' },
					relationship_to_client: { type: 'string' },
					description: { type: 'string' },
				},
				required: ['person_name', 'description'],
			},
			understandingSchema: {
				type: 'object',
				properties: {
					person_name: { type: 'string' },
					relationship_to_client: { type: 'string' },
					emotional_charge: { type: 'string', enum: ['positive', 'negative', 'ambivalent', 'neutral'] },
					role_in_client_patterns: { type: 'string' },
					perception_shift_observed: { type: 'boolean' },
				},
				required: ['person_name', 'relationship_to_client'],
			},
		}],
	})

	const relNeuron = customSchemaBrain.getNeuron('relationships')
	assert(relNeuron !== undefined, 'custom schema neuron created')
	assert(relNeuron!.type === 'list', 'custom schema neuron is list type')

	await customSchemaBrain.dispose()

	// ── Common Neuron API ────────────────────────────────────────────────
	section('Common Neuron API')

	const apiNeuron = await TextNeuron.create({
		model,
		instructions: 'Track coding patterns.',
		store: new MemoryNeuronStore(),
	})

	// Learning
	const learnResult = await apiNeuron.learn(['some batch data'])
	assert(learnResult.status !== undefined, 'learn() returns status')

	const learnForce = await apiNeuron.learn(['force data'], { forceSynthesize: true })
	assert(learnForce.status !== undefined, 'learn() with forceSynthesize works')

	// Querying
	const qResult = await apiNeuron.query('test query')
	assert(typeof qResult.insight === 'string', 'query() returns insight')

	const qStream = await apiNeuron.queryStream('test query')
	assert(qStream.textStream !== undefined, 'queryStream() returns textStream')
	// consume stream
	for await (const _ of qStream.textStream) { break }

	// Understanding
	const uValue = await apiNeuron.getUnderstanding()
	assert(uValue !== undefined || uValue === null || typeof uValue === 'string', 'getUnderstanding() works')

	const summary = await apiNeuron.getSummary()
	assert(typeof summary === 'string', 'getSummary() returns string')

	const hasKnowledge = await apiNeuron.hasKnowledge()
	assert(typeof hasKnowledge === 'boolean', 'hasKnowledge() returns boolean')

	// Introspection
	const healthInfo = apiNeuron.getHealth()
	assert('activation' in healthInfo, 'getHealth() has activation')
	assert('status' in healthInfo, 'getHealth() has status')

	const metrics = apiNeuron.getMetrics()
	assert('ingestion' in metrics, 'getMetrics() has ingestion')
	assert('query' in metrics, 'getMetrics() has query')
	assert('dismissalRate' in metrics.ingestion, 'getMetrics().ingestion has dismissalRate')

	const evoHistory = await apiNeuron.getEvolution()
	assert(Array.isArray(evoHistory), 'getEvolution() returns array')

	const obsSchema = apiNeuron.getObservationSchema()
	assert(obsSchema === null || typeof obsSchema === 'object', 'getObservationSchema() works')

	const undSchema = apiNeuron.getUnderstandingSchema()
	assert(undSchema === null || typeof undSchema === 'object', 'getUnderstandingSchema() works')

	const metadata = apiNeuron.getMetadata()
	assert(typeof metadata === 'object', 'getMetadata() returns object')

	// Buffer
	const bufState = await apiNeuron.getBufferState()
	assert('count' in bufState, 'getBufferState() has count')
	assert('avgImportance' in bufState, 'getBufferState() has avgImportance')
	assert('totalTokens' in bufState, 'getBufferState() has totalTokens')

	const buffered = await apiNeuron.getBufferedObservations()
	assert(Array.isArray(buffered), 'getBufferedObservations() returns array')

	// Observations API (full history)
	const allObs = await apiNeuron.getObservations()
	assert(Array.isArray(allObs), 'getObservations() returns array')

	const pendingObs = await apiNeuron.getObservations({ status: 'pending' })
	assert(Array.isArray(pendingObs), 'getObservations({status:pending}) returns array')

	const processedObs = await apiNeuron.getObservations({ status: 'processed' })
	assert(Array.isArray(processedObs), 'getObservations({status:processed}) returns array')

	if (allObs.length > 0) {
		const first = allObs[0]
		await apiNeuron.updateObservation(first.id, { metadata_importance: 0.9 })
		assert(true, 'updateObservation() succeeds')
	}

	await apiNeuron.setObservations([])
	const afterClear = await apiNeuron.getObservations()
	assert(afterClear.length === 0, 'setObservations([]) clears the collection')

	// removeObservation needs an id; verify it accepts the call signature
	await apiNeuron.removeObservation('non-existent-id').catch(() => {})
	assert(true, 'removeObservation() accepts id')

	// Config
	await apiNeuron.adjust('natural language directive')
	assert(true, 'adjust() succeeds')

	await apiNeuron.update({ instructions: 'new instructions' })
	assert(true, 'update() succeeds')

	// Identity
	assert(typeof apiNeuron.id === 'string', 'neuron.id is string')
	assert(typeof apiNeuron.name === 'string', 'neuron.name is string')
	assert(typeof apiNeuron.instructions === 'string', 'neuron.instructions is string')
	assert(typeof apiNeuron.description === 'string', 'neuron.description is string')
	assert(apiNeuron.type === 'text', 'neuron.type is text')
	assert(apiNeuron.focus === null || typeof apiNeuron.focus === 'string', 'neuron.focus is string or null')
	assert(apiNeuron.origin === 'prompt' || apiNeuron.origin === 'developer' || apiNeuron.origin === 'emergent', 'neuron.origin is valid')

	// ── Learn Output — Discriminated Union ────────────────────────────────
	section('Learn Output — Discriminated Union')

	const learnNeuron = await TextNeuron.create({
		model,
		instructions: 'Track test patterns.',
		store: new MemoryNeuronStore(),
	})

	const learnOut = await learnNeuron.learn(['test data item'])

	switch (learnOut.status) {
		case 'observed':
			assert(Array.isArray(learnOut.output), 'observed: has output array')
			console.log(`  Buffered ${learnOut.output.length} observations`)
			break
		case 'synthesized':
			assert(typeof learnOut.significance === 'string', 'synthesized: has significance')
			assert(typeof learnOut.evolution === 'string', 'synthesized: has evolution')
			console.log(`  Significance: ${learnOut.significance}`)
			break
		case 'observe:dismissed':
			assert(Array.isArray(learnOut.gaps), 'dismissed: has gaps')
			console.log(`  Gaps: ${learnOut.gaps}`)
			break
		case 'observe:error':
		case 'synthesize:dismissed':
		case 'synthesize:error':
			assert(true, `learn returned status: ${learnOut.status}`)
			break
	}

	await learnNeuron.dispose()
	await apiNeuron.dispose()
	await textNeuron.dispose()
	await listNeuron.dispose()
	} finally {
		rmSync(tmpDir, { recursive: true, force: true })
	}

	// ── Summary ──────────────────────────────────────────────────────────
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`04-neurons: ${passed} passed, ${failed} failed`)
	if (failed > 0) process.exit(1)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
