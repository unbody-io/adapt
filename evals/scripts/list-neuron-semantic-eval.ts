/**
 * Semantic Eval: ListNeuron end-to-end
 *
 * Tests the full lifecycle: create → init → ingest → query → update → query → ingest → query
 * Domain: tracking notable restaurants/cafes visited — a natural "list of items" use case.
 */

import { ListNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

const events: Array<{ type: string; payload?: any; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

async function main() {
	// ━━━ 1. CREATE STANDALONE LIST NEURON ━━━
	logger.logSection('1. Create standalone ListNeuron')

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
		const p = event.payload as any
		switch (event.type) {
			case 'neuron:observed':
				console.log(`  [${elapsed()}s] ${event.type} — observations: ${p?.observations?.length ?? '?'}`)
				break
			case 'neuron:synthesized':
				console.log(`  [${elapsed()}s] ${event.type} — items: ${Array.isArray(p?.newUnderstanding) ? p.newUnderstanding.length : '?'}`)
				break
			case 'neuron:query:completed':
				console.log(`  [${elapsed()}s] ${event.type} — relevant: ${p?.relevant}, confidence: ${p?.confidence}`)
				break
			case 'neuron:config:updated':
				console.log(`  [${elapsed()}s] ${event.type} — changed: [${p?.changedFields?.join(', ')}]`)
				break
			case 'neuron:prompts:regenerated':
				console.log(`  [${elapsed()}s] ${event.type}`)
				break
			default:
				console.log(`  [${elapsed()}s] ${event.type}`)
		}
	})

	logger.logState('Neuron created', {
		id: neuron.id,
		name: neuron.name,
		items: await neuron.getItemCount(),
		buffer: neuron.getBufferState(),
	})

	// ━━━ 2. INIT ━━━
	logger.logSection('2. Initialize neuron')
	const initResult = await neuron.init()
	console.log(`  Observe prompt generated: ${initResult.observeSystemPrompt.length} chars`)
	console.log(`  Synthesize prompt initialized: ${initResult.synthesizeSystemPrompt.length} chars`)

	// ━━━ 3. INGEST BATCH 1 — restaurant data ━━━
	logger.logSection('3. Ingest batch 1 — NYC restaurants')

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

	logger.logState('After batch 1', {
		itemCount: afterBatch1.itemCount,
		bufferCount: afterBatch1.buffer.count,
		synthesisCount: afterBatch1.metrics.ingestion.synthesisCount,
	})

	if (afterBatch1.items.length > 0) {
		console.log('\n  📋 Items tracked:')
		for (const item of afterBatch1.items) {
			console.log(`    [${item.id}] ${JSON.stringify(item.data)}`)
			console.log(`      confidence: ${item.metadata.confidence}, signals: [${item.metadata.signals.join(', ')}]`)
		}
	}

	// ━━━ 4. QUERY ━━━
	logger.logSection('4. Query — "Where can I get good pizza?"')

	const query1 = await neuron.query('Where can I get good pizza?')
	console.log(`\n  Relevant: ${query1.relevant}`)
	console.log(`  Relevance: ${query1.relevance}`)
	console.log(`  Confidence: ${query1.confidence}`)
	console.log(`  Insight:\n  ${query1.insight.replace(/\n/g, '\n  ')}`)
	if (query1.gaps) console.log(`  Gaps: ${query1.gaps}`)

	logger.logSection('4b. Query — "What sushi restaurants do you know about?"')

	const query2 = await neuron.query('What sushi restaurants do you know about?')
	console.log(`\n  Relevant: ${query2.relevant}`)
	console.log(`  Relevance: ${query2.relevance}`)
	console.log(`  Confidence: ${query2.confidence}`)
	console.log(`  Insight:\n  ${query2.insight.replace(/\n/g, '\n  ')}`)

	logger.logSection('4c. Query — "Any good Thai food?"')

	const query3 = await neuron.query('Any good Thai food?')
	console.log(`\n  Relevant: ${query3.relevant}`)
	console.log(`  Relevance: ${query3.relevance}`)
	console.log(`  Confidence: ${query3.confidence}`)
	console.log(`  Insight:\n  ${query3.insight.replace(/\n/g, '\n  ')}`)
	if (query3.gaps) console.log(`  Gaps: ${query3.gaps}`)

	// ━━━ 5. UPDATES ━━━

	// Update 1: Narrow to Asian cuisine only
	logger.logSection('5a. Update — narrow focus to Asian cuisine')
	const update1 = await neuron.update({
		instructions:
			'You track Asian restaurants and food spots exclusively. For each place, extract: ' +
			'name, specific Asian cuisine type (Japanese, Chinese, Thai, Korean, etc.), location, ' +
			'signature dishes, price range, and quality signals. Ignore non-Asian restaurants.',
		description: 'Asian restaurant tracker',
	})
	console.log(`  Changed fields: [${update1.changedFields.join(', ')}]`)

	// Update 2: Tighten governance
	logger.logSection('5b. Update — lower maxItems and raise importance')
	const update2 = await neuron.update({
		synthesize: {
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

	// Update 3: Change pruning strategy
	logger.logSection('5c. Update — switch to oldest pruning')
	const update3 = await neuron.update({
		governance: {
			pruning: 'oldest',
		},
	})
	console.log(`  Changed fields: [${update3.changedFields.join(', ')}]`)
	console.log(`  New pruning: ${neuron.getGovernance().pruning}`)

	// ━━━ 6. QUERY AGAIN (after narrowing) ━━━
	logger.logSection('6. Query after update — "Where can I get good pizza?"')

	const query4 = await neuron.query('Where can I get good pizza?')
	console.log(`\n  Relevant: ${query4.relevant}`)
	console.log(`  Relevance: ${query4.relevance}`)
	console.log(`  Confidence: ${query4.confidence}`)
	console.log(`  Insight:\n  ${query4.insight.replace(/\n/g, '\n  ')}`)

	logger.logSection('6b. Query — "What Japanese restaurants do you track?"')

	const query5 = await neuron.query('What Japanese restaurants do you track?')
	console.log(`\n  Relevant: ${query5.relevant}`)
	console.log(`  Relevance: ${query5.relevance}`)
	console.log(`  Confidence: ${query5.confidence}`)
	console.log(`  Insight:\n  ${query5.insight.replace(/\n/g, '\n  ')}`)

	// ━━━ 7. INGEST BATCH 2 — more Asian restaurants + noise ━━━
	logger.logSection('7. Ingest batch 2 — more data (mixed)')

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

	logger.logState('After batch 2', {
		itemCount: afterBatch2.itemCount,
		bufferCount: afterBatch2.buffer.count,
		synthesisCount: afterBatch2.metrics.ingestion.synthesisCount,
		dismissalRate: (afterBatch2.metrics.ingestion.dismissalRate * 100).toFixed(1) + '%',
	})

	if (afterBatch2.items.length > 0) {
		console.log('\n  📋 All items now:')
		for (const item of afterBatch2.items) {
			console.log(`    [${item.id}] ${JSON.stringify(item.data)}`)
			console.log(`      confidence: ${item.metadata.confidence}, signals: [${item.metadata.signals.join(', ')}]`)
		}
	}

	// ━━━ 8. FINAL QUERIES ━━━
	logger.logSection('8. Final query — "List all restaurants you\'re tracking"')

	const queryFinal = await neuron.query("List all restaurants you're tracking")
	console.log(`\n  Relevant: ${queryFinal.relevant}`)
	console.log(`  Relevance: ${queryFinal.relevance}`)
	console.log(`  Confidence: ${queryFinal.confidence}`)
	console.log(`  Insight:\n  ${queryFinal.insight.replace(/\n/g, '\n  ')}`)

	logger.logSection('8b. Final query — "Recommend a place for a date night under $50/person"')

	const queryRec = await neuron.query('Recommend a place for a date night under $50/person')
	console.log(`\n  Relevant: ${queryRec.relevant}`)
	console.log(`  Relevance: ${queryRec.relevance}`)
	console.log(`  Confidence: ${queryRec.confidence}`)
	console.log(`  Insight:\n  ${queryRec.insight.replace(/\n/g, '\n  ')}`)

	// ━━━ 9. EVENT LOG SUMMARY ━━━
	logger.logSection('9. Event log summary')

	const eventCounts: Record<string, number> = {}
	for (const e of events) {
		eventCounts[e.type] = (eventCounts[e.type] || 0) + 1
	}

	console.log('\n  Event counts:')
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`    ${type}: ${count}`)
	}

	console.log('\n  Final state:')
	console.log(`    Item count: ${await neuron.getItemCount()}`)
	console.log(`    Buffer count: ${neuron.getBufferState().count}`)
	console.log(`    Metrics: ${JSON.stringify(neuron.getMetrics(), null, 2)}`)
	console.log(`    Health: ${JSON.stringify(neuron.getHealth(), null, 2)}`)
	console.log(`    List governance: ${JSON.stringify(neuron.getGovernance(), null, 2)}`)

	// ━━━ 10. SEMANTIC CHECKS ━━━
	logger.logSection('10. Semantic checks')

	// Items were created
	const hasItems = (await neuron.getItemCount()) > 0
	logger.logAssertion('Items were created', hasItems, `count=${await neuron.getItemCount()}`)

	// Init events
	logger.logAssertion('Init events fired', events.some(e => e.type === 'neuron:init:started') && events.some(e => e.type === 'neuron:init:completed'))

	// Observe events
	logger.logAssertion('Observe events fired', events.some(e => e.type === 'neuron:observe:started'))

	// Synthesis happened
	logger.logAssertion('Synthesis happened', events.some(e => e.type === 'neuron:synthesized'))

	// Query events
	logger.logAssertion('Query events fired', events.some(e => e.type === 'neuron:query:started') && events.some(e => e.type === 'neuron:query:completed'))

	// Config updates
	const configUpdates = events.filter(e => e.type === 'neuron:config:updated').length
	logger.logAssertion('Config update events fired (3+)', configUpdates >= 3, `got ${configUpdates}`)

	// Prompts regenerated after instructions change
	logger.logAssertion('Prompts regenerated', events.some(e => e.type === 'neuron:prompts:regenerated'))

	// Pizza query was relevant before update (we have L'Industrie)
	logger.logAssertion('Pizza query relevant before update', query1.relevant === true, `relevant=${query1.relevant}`)

	// Sushi query relevant
	logger.logAssertion('Sushi query relevant', query2.relevant === true, `relevant=${query2.relevant}`)

	// Final listing query relevant
	logger.logAssertion('Final listing query relevant', queryFinal.relevant === true, `relevant=${queryFinal.relevant}`)

	// Query count tracked
	logger.logAssertion('Query count tracked (7+)', neuron.getMetrics().query.count >= 7, `count=${neuron.getMetrics().query.count}`)

	// Items are structured (have data and metadata)
	const items = await neuron.getUnderstanding()
	if (items.length > 0) {
		const firstItem = items[0]
		logger.logAssertion('Items have id', !!firstItem.id, `id=${firstItem.id}`)
		logger.logAssertion('Items have data object', typeof firstItem.data === 'object', `type=${typeof firstItem.data}`)
		logger.logAssertion('Items have metadata', !!firstItem.metadata, `has metadata`)
		logger.logAssertion('Items have confidence', typeof firstItem.metadata.confidence === 'number', `confidence=${firstItem.metadata.confidence}`)
	}

	logger.logSuccess(`Eval complete in ${elapsed()}s — ${events.length} total events, ${await neuron.getItemCount()} items tracked`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
