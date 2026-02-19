/**
 * Eval: ListLearner Agentic Understand
 *
 * Semantic eval — runs scenarios and logs everything. No assertions.
 * A human or LLM reviewer judges the output.
 *
 * Scenarios:
 * 1. Basic lifecycle: init → learn → items in store → learn again → items grow/update → query
 * 2. Dedup via tools: feed duplicates, check if agent searches before adding
 * 3. Governance post-pass: exceed maxItems, check pruning
 * 4. Dismissed: irrelevant observations produce no changes
 *
 * Domain: Restaurant tracker (natural dedup cases — same restaurant, updated info)
 */

import { ListLearner } from '../../src/learners/list-learner/class'
import { MemoryStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

function section(title: string) {
	console.log(`\n${'═'.repeat(70)}`)
	console.log(`  ${title}`)
	console.log(`${'═'.repeat(70)}\n`)
}

function log(label: string, data: unknown) {
	console.log(`  [${label}]`, JSON.stringify(data, null, 2))
}

async function dumpStore(store: MemoryStore, label: string) {
	const items = await store.understanding.list()
	const obs = await store.observations.list()
	const evo = await store.evolution.list()
	const pendingObs = obs.filter((o) => o.metadata_status === 'pending')
	const processedObs = obs.filter((o) => o.metadata_status === 'processed')

	console.log(`\n  --- Store Dump: ${label} ---`)
	console.log(`  understanding: ${items.length} items`)
	for (const r of items) {
		const item = r.data as { id: string; data: unknown; metadata: unknown }
		console.log(`    [${r.id}] data=${JSON.stringify(item.data)}`)
		console.log(`      confidence=${r.metadata_confidence}`)
	}
	console.log(`  observations: ${obs.length} total (${pendingObs.length} pending, ${processedObs.length} processed)`)
	console.log(`  evolution: ${evo.length} records`)
	for (const e of evo) {
		console.log(`    [${e.significance}] ${e.summary}`)
	}
}

async function main() {
	console.log(`\nListLearner Agentic Understand Eval`)
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}\n`)

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 1: Basic Lifecycle
	// ══════════════════════════════════════════════════════════════════════════

	section('Scenario 1: Basic Lifecycle')

	const store = new MemoryStore()
	const learner = new ListLearner({
		id: 'restaurant-tracker',
		name: 'Restaurant Tracker',
		model,
		instructions:
			'Track restaurants including their name, cuisine type, location, and any notable details like ratings or hours.',
		store,
		governance: { deduplication: 'strict', maxItems: 20, pruning: 'least-confident' },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 2,
			},
		},
	})

	const events: Array<{ type: string; ts: number }> = []
	const t0 = Date.now()
	learner.on((event) => {
		events.push({ type: event.type, ts: Date.now() - t0 })
	})

	await learner.init()

	log('Schemas', {
		observationSchema: learner.getObservationSchema(),
		understandingSchema: learner.getUnderstandingSchema(),
	})

	// ── Batch 1: Two restaurants ────────────────────────────────────────────

	console.log('\n  >> Batch 1: Two distinct restaurants')

	const result1 = await learner.learn([
		'Sushi Nakazawa is a high-end Japanese omakase restaurant in the West Village, NYC. They have a 4.8 rating and are open Tuesday through Saturday.',
		"Joe's Pizza on Carmine Street in Greenwich Village is a classic NYC pizza spot, known for their thin-crust slices. Rating 4.5, open daily.",
	])

	log('Batch 1 learn() result', { status: result1.status })
	await dumpStore(store, 'after batch 1')

	log('Cached understanding', {
		count: learner.getUnderstanding().length,
		items: learner.getUnderstanding().map((i) => ({ id: i.id, data: i.data })),
	})

	// ── Batch 2: Update existing + new restaurant ──────────────────────────

	console.log('\n  >> Batch 2: Update Sushi Nakazawa hours + add Le Bernardin')

	const itemCountBefore = learner.getUnderstanding().length

	const result2 = await learner.learn([
		'Sushi Nakazawa has expanded their hours — now open Monday through Saturday. Their rating is still 4.8.',
		'Le Bernardin is a Michelin 3-star French seafood restaurant in Midtown Manhattan. Rating 4.9, reservations required.',
	])

	log('Batch 2 learn() result', { status: result2.status })
	await dumpStore(store, 'after batch 2')

	log('Item count change', { before: itemCountBefore, after: learner.getUnderstanding().length })

	// ── Query ──────────────────────────────────────────────────────────────

	console.log('\n  >> Query: "What Japanese restaurants do you know about?"')

	const queryResult = await learner.query('What Japanese restaurants do you know about?')
	log('Query result', {
		relevant: queryResult.relevant,
		relevance: queryResult.relevance,
		confidence: queryResult.confidence,
		insight: queryResult.insight,
		gaps: queryResult.gaps,
	})

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 2: Dedup via Tools
	// ══════════════════════════════════════════════════════════════════════════

	section('Scenario 2: Dedup — feed duplicate observations')

	const itemCountBeforeDedup = learner.getUnderstanding().length

	console.log(`  >> Feeding same restaurants again (Sushi Nakazawa + Joe's Pizza)`)
	console.log(`  >> Items before: ${itemCountBeforeDedup}`)

	const result3 = await learner.learn([
		'Sushi Nakazawa in West Village NYC — amazing omakase, 4.8 stars.',
		"Joe's Pizza, Carmine Street, Greenwich Village. Classic NYC thin-crust pizza. 4.5 rating.",
	])

	log('Dedup learn() result', { status: result3.status })
	await dumpStore(store, 'after dedup test')

	log('Dedup item count', {
		before: itemCountBeforeDedup,
		after: learner.getUnderstanding().length,
		doubled: learner.getUnderstanding().length >= itemCountBeforeDedup * 2,
	})

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 3: Governance Post-Pass (maxItems)
	// ══════════════════════════════════════════════════════════════════════════

	section('Scenario 3: Governance — maxItems=3')

	const smallStore = new MemoryStore()
	const smallLearner = new ListLearner({
		id: 'small-tracker',
		name: 'Small Tracker',
		model,
		instructions: 'Track restaurants with their name and cuisine type.',
		store: smallStore,
		governance: { deduplication: 'none', maxItems: 3, pruning: 'least-confident' },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 2,
			},
		},
	})

	await smallLearner.init()

	console.log('  >> Batch 1: 2 restaurants')
	const govResult1 = await smallLearner.learn([
		'Restaurant Alpha — Italian, downtown. Restaurant Beta — Mexican, uptown.',
	])
	log('Governance batch 1', { status: govResult1.status })
	await dumpStore(smallStore, 'governance after batch 1')

	console.log('\n  >> Batch 2: 3 more restaurants (should exceed maxItems=3)')
	const govResult2 = await smallLearner.learn([
		'Restaurant Gamma — Thai, midtown. Restaurant Delta — Indian, east side. Restaurant Epsilon — French, west side.',
	])
	log('Governance batch 2', { status: govResult2.status })
	await dumpStore(smallStore, 'governance after batch 2')

	log('Governance final', {
		itemCount: smallLearner.getUnderstanding().length,
		maxItems: 3,
		withinLimit: smallLearner.getUnderstanding().length <= 3,
	})

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 4: Dismissed — Irrelevant Observations
	// ══════════════════════════════════════════════════════════════════════════

	section('Scenario 4: Dismissed — irrelevant observations')

	const dismissStore = new MemoryStore()
	const dismissLearner = new ListLearner({
		id: 'dismiss-test',
		name: 'Dismiss Test',
		model,
		instructions: 'Track restaurants and their details.',
		store: dismissStore,
		governance: { maxItems: 20 },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 1,
			},
		},
	})

	await dismissLearner.init()

	console.log('  >> Feeding weather data to a restaurant tracker')

	const dismissResult = await dismissLearner.learn([
		'The weather today is sunny with a high of 72°F. Perfect day for a walk in the park.',
	])

	log('Dismiss result', { status: dismissResult.status })
	await dumpStore(dismissStore, 'after dismiss test')

	// ══════════════════════════════════════════════════════════════════════════
	// SUMMARY
	// ══════════════════════════════════════════════════════════════════════════

	section('Event Timeline (Scenario 1 learner)')

	for (const e of events) {
		console.log(`  ${String(e.ts).padStart(6)}ms  ${e.type}`)
	}

	section('Done')
	console.log(`  Completed at ${new Date().toISOString()}`)
}

main().catch((error) => {
	console.error('\n[FATAL]', error)
	process.exit(1)
})
