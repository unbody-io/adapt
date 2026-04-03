/**
 * Eval: ListNeuron end-to-end
 *
 * Objectives:
 *   1. Schema generation — Does the neuron generate a useful schema from the
 *      restaurant-tracking instructions? Check that fields like name, cuisine,
 *      location, price range appear in the generated schema.
 *   2. Item tracking — Are restaurants correctly extracted as structured items
 *      with data and metadata (confidence, touchCount, signals)?
 *   3. Query relevance — Are queries answered accurately? Pizza query should be
 *      relevant before narrowing to Asian-only, potentially irrelevant after.
 *   4. Update behavior — After narrowing to Asian cuisine, does the neuron filter
 *      non-Asian data (e.g., Carbone/Italian) during ingestion?
 *   5. Deduplication — With strict deduplication enabled, are duplicate mentions
 *      merged via updateItem rather than creating new entries?
 *   6. Event lifecycle — Are all expected events fired in correct order?
 *
 * Domain: tracking notable restaurants/cafes visited.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/list-neuron-semantic-eval.ts
 */

import { ListNeuron, MemoryNeuronStore } from '@unbody/adapt'
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
	console.log('Eval: ListNeuron end-to-end')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ━━━ 1. CREATE STANDALONE LIST NEURON ━━━
	console.log('\n━━━ 1. Create standalone ListNeuron ━━━')

	const neuron = new ListNeuron({
		model,
		id: 'restaurant-tracker',
		name: 'Restaurant Tracker',
		description: 'Tracks notable restaurants, cafes, and food spots with details about cuisine, location, and ratings',
		instructions:
			'You track restaurants, cafes, and food establishments. For each place, extract: ' +
			'name, cuisine type, location/neighborhood, notable dishes, price range, and any quality signals ' +
			'(ratings, reviews, awards). Focus on distinctive details that make each place unique.',
		store: new MemoryNeuronStore(),
		understand: {
			thresholds: {
				minImportance: 0.3,
				maxObservations: 3,
			},
		},
		governance: {
			deduplication: 'strict',
			maxItems: 50,
			pruning: 'least-confident',
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
				console.log(`  [${elapsed()}s] ${event.type} — items: ${Array.isArray(p?.newUnderstanding) ? (p.newUnderstanding as unknown[]).length : '?'}`)
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
		items: await neuron.getItemCount(),
		buffer: await neuron.getBufferState(),
	}, null, 2))

	// ━━━ 2. INIT ━━━
	console.log('\n━━━ 2. Initialize neuron ━━━')
	const initResult = await neuron.init()
	console.log(`  Observe prompt generated: ${initResult.observeSystemPrompt.length} chars`)
	console.log(`  Understand prompt initialized: ${initResult.understandSystemPrompt.length} chars`)

	// ━━━ 3. INGEST BATCH 1 — restaurant data ━━━
	console.log('\n━━━ 3. Ingest batch 1 — NYC restaurants ━━━')

	await neuron.learn([
		'Had dinner at Sushi Nakazawa in the West Village last night. Incredible omakase — 20 courses for $150. The uni was insane, and the anago (sea eel) was the best I\'ve ever had. Michelin starred. They don\'t take walk-ins, reservation only.',
		'Tried the new Neapolitan pizza spot, L\'Industrie Pizzeria in Williamsburg. Their burrata slice is legendary — fresh burrata on a perfectly charred crust. $5 per slice. Casual counter service, always a line out the door. Cash only.',
		'Xi\'an Famous Foods in Chinatown — hand-pulled biang biang noodles with spicy cumin lamb. $12 for a huge bowl. Fast casual, no frills, incredible flavor. Multiple locations across NYC but the Chinatown one is the original.',
	])

	const afterBatch1 = {
		items: await neuron.getUnderstanding(),
		itemCount: await neuron.getItemCount(),
		buffer: neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	console.log('After batch 1:', JSON.stringify({
		itemCount: afterBatch1.itemCount,
		bufferCount: afterBatch1.buffer.count,
		synthesisCount: afterBatch1.metrics.ingestion.synthesisCount,
	}, null, 2))

	if (afterBatch1.items.length > 0) {
		console.log('\nItems tracked:')
		for (const item of afterBatch1.items) {
			console.log(`  [${item.id}] ${JSON.stringify(item.data)}`)
			console.log(`    confidence: ${item.metadata.confidence}, signals: [${item.metadata.signals.join(', ')}]`)
		}
	}

	// ━━━ 4. QUERY ━━━
	console.log('\n━━━ 4. Query — "Where can I get good pizza?" ━━━')

	const query1 = await neuron.query('Where can I get good pizza?')
	console.log(`  Relevant: ${query1.relevant}`)
	console.log(`  Relevance: ${query1.relevance}`)
	console.log(`  Confidence: ${query1.confidence}`)
	console.log(`  Insight: ${query1.insight}`)
	if (query1.gaps) console.log(`  Gaps: ${query1.gaps}`)

	console.log('\n━━━ 4b. Query — "What sushi restaurants do you know about?" ━━━')

	const query2 = await neuron.query('What sushi restaurants do you know about?')
	console.log(`  Relevant: ${query2.relevant}`)
	console.log(`  Relevance: ${query2.relevance}`)
	console.log(`  Confidence: ${query2.confidence}`)
	console.log(`  Insight: ${query2.insight}`)

	console.log('\n━━━ 4c. Query — "Any good Thai food?" ━━━')

	const query3 = await neuron.query('Any good Thai food?')
	console.log(`  Relevant: ${query3.relevant}`)
	console.log(`  Relevance: ${query3.relevance}`)
	console.log(`  Confidence: ${query3.confidence}`)
	console.log(`  Insight: ${query3.insight}`)
	if (query3.gaps) console.log(`  Gaps: ${query3.gaps}`)

	// ━━━ 5. UPDATES ━━━

	console.log('\n━━━ 5a. Update — narrow focus to Asian cuisine ━━━')
	const update1 = await neuron.update({
		instructions:
			'You track Asian restaurants and food spots exclusively. For each place, extract: ' +
			'name, specific Asian cuisine type (Japanese, Chinese, Thai, Korean, etc.), location, ' +
			'signature dishes, price range, and quality signals. Ignore non-Asian restaurants.',
		description: 'Asian restaurant tracker',
	})
	console.log(`  Changed fields: [${update1.changedFields.join(', ')}]`)

	console.log('\n━━━ 5b. Update — lower maxItems and raise importance ━━━')
	const update2 = await neuron.update({
		understand: {
			thresholds: {
				minImportance: 0.6,
			},
		},
		governance: {
			maxItems: 20,
		},
	})
	console.log(`  Changed fields: [${update2.changedFields.join(', ')}]`)
	console.log(`  New thresholds: minImportance=${neuron.getUnderstandThresholds().minImportance}`)
	console.log(`  New governance: maxItems=${neuron.getGovernance().maxItems}`)

	console.log('\n━━━ 5c. Update — switch to oldest pruning ━━━')
	const update3 = await neuron.update({
		governance: {
			pruning: 'oldest',
		},
	})
	console.log(`  Changed fields: [${update3.changedFields.join(', ')}]`)
	console.log(`  New pruning: ${neuron.getGovernance().pruning}`)

	// ━━━ 6. QUERY AGAIN (after narrowing) ━━━
	console.log('\n━━━ 6. Query after update — "Where can I get good pizza?" ━━━')

	const query4 = await neuron.query('Where can I get good pizza?')
	console.log(`  Relevant: ${query4.relevant}`)
	console.log(`  Relevance: ${query4.relevance}`)
	console.log(`  Confidence: ${query4.confidence}`)
	console.log(`  Insight: ${query4.insight}`)

	console.log('\n━━━ 6b. Query — "What Japanese restaurants do you track?" ━━━')

	const query5 = await neuron.query('What Japanese restaurants do you track?')
	console.log(`  Relevant: ${query5.relevant}`)
	console.log(`  Relevance: ${query5.relevance}`)
	console.log(`  Confidence: ${query5.confidence}`)
	console.log(`  Insight: ${query5.insight}`)

	// ━━━ 7. INGEST BATCH 2 — more Asian restaurants + noise ━━━
	console.log('\n━━━ 7. Ingest batch 2 — more data (mixed) ━━━')

	await neuron.learn([
		'Just discovered Jongro BBQ in Koreatown — authentic Korean BBQ with excellent galbi and samgyeopsal. They grill it at your table. About $35/person. Open until 2am which is perfect for late night. The banchan spread is generous.',
		'Tried Fish Cheeks in NoHo — modern Thai seafood. The whole branzino with tamarind sauce was incredible. Upscale casual, about $50/person. Beautiful plating. James Beard nominated chef.',
		'New Italian spot opened on the Upper West Side — Carbone. Incredible spicy rigatoni vodka and veal parm. Very pricey, $80+ per person. Old school glamour. Hard to get reservations.',
		'Ramen at Ichiran in Midtown — solo booth ramen experience imported from Japan. Tonkotsu broth is rich and customizable (noodle firmness, broth richness, spice level). $20 for a bowl. Unique dining concept.',
	])

	const afterBatch2 = {
		items: await neuron.getUnderstanding(),
		itemCount: await neuron.getItemCount(),
		buffer: neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	console.log('After batch 2:', JSON.stringify({
		itemCount: afterBatch2.itemCount,
		bufferCount: afterBatch2.buffer.count,
		synthesisCount: afterBatch2.metrics.ingestion.synthesisCount,
		dismissalRate: (afterBatch2.metrics.ingestion.dismissalRate * 100).toFixed(1) + '%',
	}, null, 2))

	if (afterBatch2.items.length > 0) {
		console.log('\nAll items now:')
		for (const item of afterBatch2.items) {
			console.log(`  [${item.id}] ${JSON.stringify(item.data)}`)
			console.log(`    confidence: ${item.metadata.confidence}, signals: [${item.metadata.signals.join(', ')}]`)
		}
	}

	// ━━━ 8. FINAL QUERIES ━━━
	console.log('\n━━━ 8. Final query — "List all restaurants you\'re tracking" ━━━')

	const queryFinal = await neuron.query("List all restaurants you're tracking")
	console.log(`  Relevant: ${queryFinal.relevant}`)
	console.log(`  Relevance: ${queryFinal.relevance}`)
	console.log(`  Confidence: ${queryFinal.confidence}`)
	console.log(`  Insight: ${queryFinal.insight}`)

	console.log('\n━━━ 8b. Final query — "Recommend a place for a date night under $50/person" ━━━')

	const queryRec = await neuron.query('Recommend a place for a date night under $50/person')
	console.log(`  Relevant: ${queryRec.relevant}`)
	console.log(`  Relevance: ${queryRec.relevance}`)
	console.log(`  Confidence: ${queryRec.confidence}`)
	console.log(`  Insight: ${queryRec.insight}`)

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
	console.log(`  Item count: ${await neuron.getItemCount()}`)
	console.log(`  Buffer count: ${(await neuron.getBufferState()).count}`)
	console.log(`  Metrics:`, JSON.stringify(neuron.getMetrics(), null, 2))
	console.log(`  Health:`, JSON.stringify(neuron.getHealth(), null, 2))
	console.log(`  List governance:`, JSON.stringify(neuron.getGovernance(), null, 2))

	console.log(`\nEval complete in ${elapsed()}s — ${events.length} total events, ${await neuron.getItemCount()} items tracked`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
