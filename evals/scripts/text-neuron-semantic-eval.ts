/**
 * Eval: TextNeuron end-to-end
 *
 * Objectives:
 *   1. Understanding quality — Does the neuron build coherent, accurate understanding
 *      from coffee brewing data? Check that key facts (temperatures, ratios, techniques)
 *      are preserved in the understanding text.
 *   2. Query relevance — Are queries answered with appropriate relevance and confidence?
 *      Pour-over query should be relevant before instruction change, potentially irrelevant after.
 *   3. Update behavior — After narrowing instructions to espresso-only, does the neuron's
 *      query behavior reflect the new scope? Does it dismiss non-espresso data?
 *   4. Governance change — Does switching from continuous to cumulative strategy take effect?
 *   5. Event lifecycle — Are all expected events fired in correct order?
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/text-neuron-semantic-eval.ts
 */

import { TextNeuron, MemoryNeuronStore } from '../../src'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

const events: Array<{ type: string; payload?: unknown; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

async function main() {
	console.log('Eval: TextNeuron end-to-end')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ━━━ 1. CREATE STANDALONE TEXT NEURON ━━━
	console.log('\n━━━ 1. Create standalone TextNeuron ━━━')

	const neuron = await TextNeuron.create({
		model,
		id: 'coffee-expert',
		name: 'Coffee Knowledge',
		description: 'Tracks knowledge about coffee brewing, origins, and techniques',
		instructions:
			'You are a coffee knowledge tracker. Watch for information about coffee ' +
			'brewing methods, bean origins, roasting profiles, flavor notes, and ' +
			'preparation techniques. Focus on practical, actionable knowledge.',
		store: new MemoryNeuronStore(),
		governance: { strategy: 'continuous' },
		understand: {
			thresholds: {
				minImportance: 0.3,
				maxObservations: 3,
			},
		},
	})

	// Subscribe to ALL events
	neuron.on((event) => {
		const entry = { type: event.type, payload: event.payload, time: Date.now() - startTime }
		events.push(entry)
		const p = event.payload as Record<string, unknown>
		switch (event.type) {
			case 'neuron:observed':
				console.log(`  [${elapsed()}s] ${event.type} — observations: ${(p?.observations as unknown[])?.length ?? '?'}`)
				break
			case 'neuron:synthesized':
				console.log(`  [${elapsed()}s] ${event.type} — understanding length: ${(p?.newUnderstanding as string)?.length ?? '?'}`)
				break
			case 'neuron:query:completed':
				console.log(`  [${elapsed()}s] ${event.type} — relevant: ${p?.relevant}, confidence: ${p?.confidence}`)
				break
			case 'neuron:config:updated':
				console.log(`  [${elapsed()}s] ${event.type} — changed: [${(p?.changedFields as string[])?.join(', ')}]`)
				break
			case 'neuron:prompts:regenerated':
				console.log(`  [${elapsed()}s] ${event.type}`)
				break
			default:
				console.log(`  [${elapsed()}s] ${event.type}`)
		}
	})

	console.log('Neuron created:', JSON.stringify({
		id: neuron.id,
		name: neuron.name,
		understanding: (await neuron.getUnderstanding()) || '(empty)',
		buffer: await neuron.getBufferState(),
	}, null, 2))

	// ━━━ 2. INIT ━━━
	console.log('\n━━━ 2. Initialized via TextNeuron.create ━━━')
	console.log(`  Observe prompt generated: ${neuron.getObserveSystemPrompt()?.length ?? 0} chars`)
	console.log(`  Understand prompt generated: ${neuron.getUnderstandSystemPrompt()?.length ?? 0} chars`)

	// ━━━ 3. INGEST DATA (batch 1) ━━━
	console.log('\n━━━ 3. Ingest batch 1 — coffee brewing basics ━━━')

	await neuron.learn([
		'Pour-over coffee uses a slow, controlled pour of hot water (195-205°F) over ground coffee in a filter. The Hario V60 is a popular pour-over dripper with spiral ridges that promote even extraction. Grind size should be medium-fine, similar to table salt.',
		'French press brewing involves steeping coarsely ground coffee in hot water for 4 minutes, then pressing a metal mesh filter to separate grounds. It produces a full-bodied cup with more oils than paper-filtered methods. Use a 1:15 coffee-to-water ratio.',
		'Espresso is brewed by forcing hot water (200°F) through finely ground coffee at 9 bars of pressure for 25-30 seconds. A proper shot yields about 1oz of concentrated coffee with a layer of crema on top. The grind must be very fine and consistent.',
	])

	const afterBatch1 = {
		understanding: await neuron.getUnderstanding(),
		buffer: await neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	console.log('After batch 1:', JSON.stringify({
		understandingLength: afterBatch1.understanding.length,
		bufferCount: afterBatch1.buffer.count,
		observationCount: afterBatch1.metrics.ingestion.observationCount,
		synthesisCount: afterBatch1.metrics.ingestion.synthesisCount,
	}, null, 2))

	if (afterBatch1.understanding) {
		console.log('\nUnderstanding so far:')
		console.log(afterBatch1.understanding)
	}

	// ━━━ 4. QUERY (before updates) ━━━
	console.log('\n━━━ 4. Query — "How do I make pour-over coffee?" ━━━')

	const query1 = await neuron.query('How do I make pour-over coffee?')
	console.log(`  Relevant: ${query1.relevant}`)
	console.log(`  Relevance: ${query1.relevance}`)
	console.log(`  Confidence: ${query1.confidence}`)
	console.log(`  Insight: ${query1.insight}`)
	if (query1.gaps) console.log(`  Gaps: ${query1.gaps}`)

	console.log('\n━━━ 4b. Query — "What is the ideal temperature for cold brew?" ━━━')

	const query2 = await neuron.query('What is the ideal temperature for cold brew?')
	console.log(`  Relevant: ${query2.relevant}`)
	console.log(`  Relevance: ${query2.relevance}`)
	console.log(`  Confidence: ${query2.confidence}`)
	console.log(`  Insight: ${query2.insight}`)
	if (query2.gaps) console.log(`  Gaps: ${query2.gaps}`)

	// ━━━ 5. UPDATE — Multiple rounds ━━━

	console.log('\n━━━ 5a. Update — narrow focus to espresso only ━━━')
	const update1 = await neuron.update({
		instructions:
			'You are an espresso specialist. Focus exclusively on espresso brewing: ' +
			'machine types, grind settings, extraction theory, milk texturing, and latte art. ' +
			'Ignore non-espresso brewing methods.',
		description: 'Specialized espresso knowledge tracker',
	})
	console.log(`  Changed fields: [${update1.changedFields.join(', ')}]`)

	console.log('\n━━━ 5b. Update — raise importance threshold ━━━')
	const update2 = await neuron.update({
		understand: {
			thresholds: {
				minImportance: 0.7,
			},
		},
	})
	console.log(`  Changed fields: [${update2.changedFields.join(', ')}]`)
	console.log(`  New thresholds: minImportance=${neuron.getUnderstandThresholds().minImportance}`)

	console.log('\n━━━ 5c. Update — switch to cumulative strategy ━━━')
	const update3 = await neuron.update({
		governance: { strategy: 'cumulative' },
	})
	console.log(`  Changed fields: [${update3.changedFields.join(', ')}]`)
	console.log(`  New strategy: ${neuron.getGovernance().strategy}`)

	// ━━━ 6. QUERY AGAIN (after narrowed instructions) ━━━
	console.log('\n━━━ 6. Query after update — "How do I make pour-over coffee?" ━━━')

	const query3 = await neuron.query('How do I make pour-over coffee?')
	console.log(`  Relevant: ${query3.relevant}`)
	console.log(`  Relevance: ${query3.relevance}`)
	console.log(`  Confidence: ${query3.confidence}`)
	console.log(`  Insight: ${query3.insight}`)

	console.log('\n━━━ 6b. Query — "What pressure should espresso be brewed at?" ━━━')

	const query4 = await neuron.query('What pressure should espresso be brewed at?')
	console.log(`  Relevant: ${query4.relevant}`)
	console.log(`  Relevance: ${query4.relevance}`)
	console.log(`  Confidence: ${query4.confidence}`)
	console.log(`  Insight: ${query4.insight}`)

	// ━━━ 7. INGEST MORE DATA (batch 2 — espresso-focused) ━━━
	console.log('\n━━━ 7. Ingest batch 2 — espresso details ━━━')

	await neuron.learn([
		'The ideal espresso extraction ratio is 1:2 (e.g., 18g in, 36g out) over 25-30 seconds. Under-extraction produces sour, thin shots while over-extraction yields bitter, hollow flavors. Channeling occurs when water finds weak spots in the puck.',
		'Milk for lattes should be steamed to 140-155°F with a microfoam texture (tiny, uniform bubbles). Start with the steam wand tip just below the surface to incorporate air, then submerge to create a whirlpool that breaks down large bubbles.',
		'Single-origin Ethiopian beans (Yirgacheffe) produce bright, fruity espresso with blueberry and citrus notes. Brazilian Santos beans give nutty, chocolate, low-acid shots. Many espresso blends combine both for complexity.',
		'A cold brew discussion: cold brew is steeped 12-24 hours in cold water at room temperature. This is unrelated to espresso.',
	])

	const afterBatch2 = {
		understanding: await neuron.getUnderstanding(),
		buffer: await neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	console.log('After batch 2:', JSON.stringify({
		understandingLength: afterBatch2.understanding.length,
		bufferCount: afterBatch2.buffer.count,
		observationCount: afterBatch2.metrics.ingestion.observationCount,
		synthesisCount: afterBatch2.metrics.ingestion.synthesisCount,
		dismissalRate: (afterBatch2.metrics.ingestion.dismissalRate * 100).toFixed(1) + '%',
	}, null, 2))

	if (afterBatch2.understanding) {
		console.log('\nUnderstanding now:')
		console.log(afterBatch2.understanding)
	}

	// ━━━ 8. FINAL QUERY ━━━
	console.log('\n━━━ 8. Final query — "Summarize everything you know about espresso" ━━━')

	const queryFinal = await neuron.query('Summarize everything you know about espresso')
	console.log(`  Relevant: ${queryFinal.relevant}`)
	console.log(`  Relevance: ${queryFinal.relevance}`)
	console.log(`  Confidence: ${queryFinal.confidence}`)
	console.log(`  Insight: ${queryFinal.insight}`)

	// ━━━ 9. EVENT LOG SUMMARY ━━━
	console.log('\n━━━ 9. Event log summary ━━━')

	const eventCounts: Record<string, number> = {}
	for (const e of events) {
		eventCounts[e.type] = (eventCounts[e.type] || 0) + 1
	}

	console.log('\nEvent counts:')
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`  ${type}: ${count}`)
	}

	console.log('\nFinal state:')
	console.log(`  Understanding length: ${(await neuron.getUnderstanding()).length} chars`)
	console.log(`  Buffer count: ${(await neuron.getBufferState()).count}`)
	console.log(`  Metrics:`, JSON.stringify(neuron.getMetrics(), null, 2))
	console.log(`  Health:`, JSON.stringify(neuron.getHealth(), null, 2))

	console.log(`\nEval complete in ${elapsed()}s — ${events.length} total events`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
