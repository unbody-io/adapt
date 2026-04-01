/**
 * Semantic Eval: TextNeuron end-to-end
 *
 * Tests the full lifecycle: create → init → ingest → query → update → query → ingest → query
 * All events are logged for manual semantic inspection.
 */

import { TextNeuron } from '../../src/neurons/text/class'
import { MemoryNeuronStore } from '../../src/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// Event log for full inspection
const events: Array<{ type: string; payload?: any; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

async function main() {
	// ━━━ 1. CREATE STANDALONE TEXT NEURON ━━━
	logger.logSection('1. Create standalone TextNeuron')

	const neuron = new TextNeuron({
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
		// Compact event log — show type + key info
		const p = event.payload as any
		switch (event.type) {
			case 'neuron:observed':
				console.log(`  [${elapsed()}s] ${event.type} — observations: ${p?.observations?.length ?? '?'}`)
				break
			case 'neuron:synthesized':
				console.log(`  [${elapsed()}s] ${event.type} — understanding length: ${p?.newUnderstanding?.length ?? '?'}`)
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
		understanding: (await neuron.getUnderstanding()) || '(empty)',
		buffer: neuron.getBufferState(),
	})

	// ━━━ 2. INIT ━━━
	logger.logSection('2. Initialize neuron')
	const initResult = await neuron.init()
	console.log(`  Observe prompt generated: ${initResult.observeSystemPrompt.length} chars`)
	console.log(`  Synthesize prompt generated: ${initResult.synthesizeSystemPrompt.length} chars`)

	// ━━━ 3. INGEST DATA (batch 1) ━━━
	logger.logSection('3. Ingest batch 1 — coffee brewing basics')

	await neuron.learn([
		'Pour-over coffee uses a slow, controlled pour of hot water (195-205°F) over ground coffee in a filter. The Hario V60 is a popular pour-over dripper with spiral ridges that promote even extraction. Grind size should be medium-fine, similar to table salt.',
		'French press brewing involves steeping coarsely ground coffee in hot water for 4 minutes, then pressing a metal mesh filter to separate grounds. It produces a full-bodied cup with more oils than paper-filtered methods. Use a 1:15 coffee-to-water ratio.',
		'Espresso is brewed by forcing hot water (200°F) through finely ground coffee at 9 bars of pressure for 25-30 seconds. A proper shot yields about 1oz of concentrated coffee with a layer of crema on top. The grind must be very fine and consistent.',
	])

	const afterBatch1 = {
		understanding: await neuron.getUnderstanding(),
		buffer: neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	logger.logState('After batch 1', {
		understandingLength: afterBatch1.understanding.length,
		bufferCount: afterBatch1.buffer.count,
		observeCount: afterBatch1.metrics.ingestion.observeCount,
		synthesisCount: afterBatch1.metrics.ingestion.synthesisCount,
	})

	if (afterBatch1.understanding) {
		console.log('\n  📝 Understanding so far:')
		console.log('  ' + afterBatch1.understanding.replace(/\n/g, '\n  '))
	}

	// ━━━ 4. QUERY (before updates) ━━━
	logger.logSection('4. Query — "How do I make pour-over coffee?"')

	const query1 = await neuron.query('How do I make pour-over coffee?')
	console.log(`\n  Relevant: ${query1.relevant}`)
	console.log(`  Relevance: ${query1.relevance}`)
	console.log(`  Confidence: ${query1.confidence}`)
	console.log(`  Insight:\n  ${query1.insight.replace(/\n/g, '\n  ')}`)
	if (query1.gaps) console.log(`  Gaps: ${query1.gaps}`)

	logger.logSection('4b. Query — "What is the ideal temperature for cold brew?"')

	const query2 = await neuron.query('What is the ideal temperature for cold brew?')
	console.log(`\n  Relevant: ${query2.relevant}`)
	console.log(`  Relevance: ${query2.relevance}`)
	console.log(`  Confidence: ${query2.confidence}`)
	console.log(`  Insight:\n  ${query2.insight.replace(/\n/g, '\n  ')}`)
	if (query2.gaps) console.log(`  Gaps: ${query2.gaps}`)

	// ━━━ 5. UPDATE — Multiple rounds ━━━

	// Update 1: Change instructions to narrow focus
	logger.logSection('5a. Update — narrow focus to espresso only')
	const update1 = await neuron.update({
		instructions:
			'You are an espresso specialist. Focus exclusively on espresso brewing: ' +
			'machine types, grind settings, extraction theory, milk texturing, and latte art. ' +
			'Ignore non-espresso brewing methods.',
		description: 'Specialized espresso knowledge tracker',
	})
	console.log(`  Changed fields: [${update1.changedFields.join(', ')}]`)

	// Update 2: Change thresholds
	logger.logSection('5b. Update — raise importance threshold')
	const update2 = await neuron.update({
		synthesize: {
			thresholds: {
				minImportance: 0.7, // Higher bar — only important observations pass
			},
		},
	})
	console.log(`  Changed fields: [${update2.changedFields.join(', ')}]`)
	console.log(`  New thresholds: minImportance=${neuron.getUnderstandThresholds().minImportance}`)

	// Update 3: Change governance strategy
	logger.logSection('5c. Update — switch to cumulative strategy')
	const update3 = await neuron.update({
		governance: { strategy: 'cumulative' },
	})
	console.log(`  Changed fields: [${update3.changedFields.join(', ')}]`)
	console.log(`  New strategy: ${neuron.getGovernance().strategy}`)

	// ━━━ 6. QUERY AGAIN (after narrowed instructions) ━━━
	logger.logSection('6. Query after update — "How do I make pour-over coffee?"')

	const query3 = await neuron.query('How do I make pour-over coffee?')
	console.log(`\n  Relevant: ${query3.relevant}`)
	console.log(`  Relevance: ${query3.relevance}`)
	console.log(`  Confidence: ${query3.confidence}`)
	console.log(`  Insight:\n  ${query3.insight.replace(/\n/g, '\n  ')}`)

	logger.logSection('6b. Query — "What pressure should espresso be brewed at?"')

	const query4 = await neuron.query('What pressure should espresso be brewed at?')
	console.log(`\n  Relevant: ${query4.relevant}`)
	console.log(`  Relevance: ${query4.relevance}`)
	console.log(`  Confidence: ${query4.confidence}`)
	console.log(`  Insight:\n  ${query4.insight.replace(/\n/g, '\n  ')}`)

	// ━━━ 7. INGEST MORE DATA (batch 2 — espresso-focused) ━━━
	logger.logSection('7. Ingest batch 2 — espresso details')

	await neuron.learn([
		'The ideal espresso extraction ratio is 1:2 (e.g., 18g in, 36g out) over 25-30 seconds. Under-extraction produces sour, thin shots while over-extraction yields bitter, hollow flavors. Channeling occurs when water finds weak spots in the puck.',
		'Milk for lattes should be steamed to 140-155°F with a microfoam texture (tiny, uniform bubbles). Start with the steam wand tip just below the surface to incorporate air, then submerge to create a whirlpool that breaks down large bubbles.',
		'Single-origin Ethiopian beans (Yirgacheffe) produce bright, fruity espresso with blueberry and citrus notes. Brazilian Santos beans give nutty, chocolate, low-acid shots. Many espresso blends combine both for complexity.',
		'A cold brew discussion: cold brew is steeped 12-24 hours in cold water at room temperature. This is unrelated to espresso.',
	])

	const afterBatch2 = {
		understanding: await neuron.getUnderstanding(),
		buffer: neuron.getBufferState(),
		metrics: neuron.getMetrics(),
	}

	logger.logState('After batch 2', {
		understandingLength: afterBatch2.understanding.length,
		bufferCount: afterBatch2.buffer.count,
		observeCount: afterBatch2.metrics.ingestion.observeCount,
		synthesisCount: afterBatch2.metrics.ingestion.synthesisCount,
		dismissalRate: (afterBatch2.metrics.ingestion.dismissalRate * 100).toFixed(1) + '%',
	})

	if (afterBatch2.understanding) {
		console.log('\n  📝 Understanding now:')
		console.log('  ' + afterBatch2.understanding.replace(/\n/g, '\n  '))
	}

	// ━━━ 8. FINAL QUERY ━━━
	logger.logSection('8. Final query — "Summarize everything you know about espresso"')

	const queryFinal = await neuron.query('Summarize everything you know about espresso')
	console.log(`\n  Relevant: ${queryFinal.relevant}`)
	console.log(`  Relevance: ${queryFinal.relevance}`)
	console.log(`  Confidence: ${queryFinal.confidence}`)
	console.log(`  Insight:\n  ${queryFinal.insight.replace(/\n/g, '\n  ')}`)

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
	console.log(`    Understanding length: ${(await neuron.getUnderstanding()).length} chars`)
	console.log(`    Buffer count: ${neuron.getBufferState().count}`)
	console.log(`    Metrics: ${JSON.stringify(neuron.getMetrics(), null, 2)}`)
	console.log(`    Health: ${JSON.stringify(neuron.getHealth(), null, 2)}`)

	logger.logSection('10. Semantic checks')

	// Check: understanding exists after ingestion
	const hasUnderstanding = (await neuron.getUnderstanding()).length > 0
	logger.logAssertion('Understanding was generated', hasUnderstanding)

	// Check: init events fired
	logger.logAssertion('Init events fired', events.some(e => e.type === 'neuron:init:started') && events.some(e => e.type === 'neuron:init:completed'))

	// Check: observe events fired
	logger.logAssertion('Observe events fired', events.some(e => e.type === 'neuron:observe:started'))

	// Check: synthesize events fired
	logger.logAssertion('Synthesis happened', events.some(e => e.type === 'neuron:synthesized'))

	// Check: query events fired
	logger.logAssertion('Query events fired', events.some(e => e.type === 'neuron:query:started') && events.some(e => e.type === 'neuron:query:completed'))

	// Check: config update events fired
	logger.logAssertion('Config update events fired', events.filter(e => e.type === 'neuron:config:updated').length >= 3, `Expected 3+, got ${events.filter(e => e.type === 'neuron:config:updated').length}`)

	// Check: prompts regenerated after instructions change
	logger.logAssertion('Prompts regenerated after instruction update', events.some(e => e.type === 'neuron:prompts:regenerated'))

	// Check: query 1 (pour-over) was relevant before update
	logger.logAssertion('Pour-over query relevant before update', query1.relevant === true, `relevant=${query1.relevant}`)

	// Check: espresso query was relevant
	logger.logAssertion('Espresso query relevant', query4.relevant === true, `relevant=${query4.relevant}`)

	// Check: final query relevant with good confidence
	logger.logAssertion('Final summary query relevant', queryFinal.relevant === true, `relevant=${queryFinal.relevant}`)

	// Check: metrics track queries
	logger.logAssertion('Query count tracked', neuron.getMetrics().query.count >= 5, `count=${neuron.getMetrics().query.count}`)

	logger.logSuccess(`Eval complete in ${elapsed()}s — ${events.length} total events`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
