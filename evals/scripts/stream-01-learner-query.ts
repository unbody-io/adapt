/**
 * Eval: Learner queryStream
 *
 * Objectives:
 *   1. TextLearner.queryStream returns a StreamTextResult with working textStream
 *   2. ListLearner.queryStream returns a StreamTextResult with working fullStream
 *   3. All ai-sdk event types (text, tool-call, tool-result, etc.) are captured from fullStream
 *   4. Stream completes and final text/toolCalls promises resolve
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/stream-01-learner-query.ts
 */

import { TextLearner } from '../../src/learners/text-learner/class'
import { ListLearner } from '../../src/learners/list-learner/class'
import { MemoryStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

/** Log a fullStream part generically — handles any ai-sdk event shape */
function logStreamPart(part: { type: string; [k: string]: unknown }) {
	switch (part.type) {
		case 'text-delta':
			process.stdout.write(String(part.text ?? part.textDelta ?? ''))
			break
		case 'tool-call':
			console.log(`\n  [tool-call] ${part.toolName} — input: ${JSON.stringify(part.input ?? part.args).slice(0, 200)}`)
			break
		case 'tool-result':
			console.log(`  [tool-result] ${part.toolName} — output: ${JSON.stringify(part.output ?? part.result).slice(0, 200)}`)
			break
		case 'tool-call-streaming-start':
		case 'tool-call-delta':
			// skip noisy deltas
			break
		default:
			console.log(`\n  [${part.type}] ${JSON.stringify(part).slice(0, 200)}`)
			break
	}
}

async function main() {
	console.log('Eval: Learner queryStream')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 1: TextLearner queryStream (direct mode — plain text)
	// ══════════════════════════════════════════════════════════════════════════

	console.log('\n═══ Scenario 1: TextLearner queryStream (direct) ═══\n')

	const textStore = new MemoryStore()
	const textLearner = new TextLearner({
		model,
		id: 'coffee-expert',
		name: 'Coffee Knowledge',
		instructions: 'You track knowledge about coffee brewing methods and bean origins.',
		store: textStore,
		governance: { strategy: 'continuous' },
		understand: { thresholds: { minImportance: 0.1, maxObservations: 2 } },
	})

	await textLearner.init()

	// Pre-populate understanding
	await textLearner.setUnderstanding(
		'Coffee Brewing Methods:\n' +
		'- Pour-over: Clean, bright flavors. Use 1:16 ratio, 200°F water, 3-4 min brew time.\n' +
		'- French press: Full-bodied, rich. Use 1:12 ratio, coarse grind, 4 min steep.\n' +
		'- Espresso: Concentrated, 25-30 second extraction, 9 bars pressure.\n' +
		'- Cold brew: Smooth, low acid. 1:8 ratio, 12-24 hours steep in fridge.',
	)

	const question1 = 'What is the best way to make pour-over coffee?'
	console.log(`Question: ${question1}`)

	const stream1 = await textLearner.queryStream(question1, { mode: 'direct' })

	// Collect textStream chunks
	const textChunks: string[] = []
	console.log('\n--- textStream chunks ---')
	for await (const chunk of stream1.textStream) {
		textChunks.push(chunk)
		process.stdout.write(chunk)
	}
	console.log('\n--- end textStream ---')

	console.log(`\nTotal text chunks: ${textChunks.length}`)
	console.log(`Final text length: ${textChunks.join('').length}`)

	// Await promises
	const text1 = await stream1.text
	const usage1 = await stream1.usage
	const finishReason1 = await stream1.finishReason

	console.log(`\nResolved text length: ${text1.length}`)
	console.log(`Usage: ${JSON.stringify(usage1)}`)
	console.log(`Finish reason: ${finishReason1}`)

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 2: TextLearner queryStream (tool-based mode — fullStream events)
	// ══════════════════════════════════════════════════════════════════════════

	console.log('\n═══ Scenario 2: TextLearner queryStream (tool-based) ═══\n')

	const question2 = 'Compare French press and espresso brewing.'
	console.log(`Question: ${question2}`)

	const stream2 = await textLearner.queryStream(question2)

	// Collect ALL fullStream events and categorize by type
	const eventTypes = new Map<string, number>()
	console.log('\n--- fullStream events ---')
	for await (const part of stream2.fullStream) {
		const p = part as { type: string; [k: string]: unknown }
		const count = eventTypes.get(p.type) ?? 0
		eventTypes.set(p.type, count + 1)
		logStreamPart(p)
	}
	console.log('\n--- end fullStream ---')

	console.log('\nEvent type counts:')
	for (const [type, count] of [...eventTypes.entries()].sort()) {
		console.log(`  ${type}: ${count}`)
	}

	const toolCalls2 = await stream2.toolCalls
	console.log(`\nResolved toolCalls: ${toolCalls2.length}`)
	for (const tc of toolCalls2) {
		const t = tc as { toolName: string; input?: unknown }
		console.log(`  ${t.toolName}: ${JSON.stringify(t.input).slice(0, 200)}`)
	}

	const usage2 = await stream2.usage
	console.log(`Usage: ${JSON.stringify(usage2)}`)

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 3: ListLearner queryStream (tool-based — has understanding tools)
	// ══════════════════════════════════════════════════════════════════════════

	console.log('\n═══ Scenario 3: ListLearner queryStream (tool-based) ═══\n')

	const listStore = new MemoryStore()
	const listLearner = new ListLearner({
		model,
		id: 'tool-tracker',
		name: 'Dev Tools Tracker',
		instructions: 'Track developer tools, frameworks, and libraries including their purpose and key features.',
		store: listStore,
		governance: { deduplication: 'strict', maxItems: 20, pruning: 'least-confident' },
		understand: { thresholds: { minImportance: 0.1, maxObservations: 2 } },
	})

	await listLearner.init()

	// Inject some data so the learner has knowledge
	await listLearner.learn([
		'React is a JavaScript library for building user interfaces. It uses a virtual DOM and component-based architecture. Created by Facebook.',
		'Vue.js is a progressive JavaScript framework for building UIs. It features reactive data binding and a template syntax. Created by Evan You.',
	])

	const question3 = 'What JavaScript frameworks do you know about?'
	console.log(`Question: ${question3}`)

	const stream3 = await listLearner.queryStream(question3)

	const eventTypes3 = new Map<string, number>()
	console.log('\n--- fullStream events ---')
	for await (const part of stream3.fullStream) {
		const p = part as { type: string; [k: string]: unknown }
		const count = eventTypes3.get(p.type) ?? 0
		eventTypes3.set(p.type, count + 1)
		logStreamPart(p)
	}
	console.log('\n--- end fullStream ---')

	console.log('\nEvent type counts:')
	for (const [type, count] of [...eventTypes3.entries()].sort()) {
		console.log(`  ${type}: ${count}`)
	}

	const text3 = await stream3.text
	const usage3 = await stream3.usage
	console.log(`\nFinal text: ${text3.slice(0, 300)}`)
	console.log(`Usage: ${JSON.stringify(usage3)}`)

	console.log('\n═══ Done ═══')
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
