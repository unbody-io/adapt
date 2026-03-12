/**
 * Eval: Brain askStream
 *
 * Objectives:
 *   1. brain.askStream (direct mode) returns a StreamTextResult that streams synthesis text
 *   2. brain.askStream (deep mode) returns a StreamTextResult with tool-call events for specialist queries
 *   3. All ai-sdk event types are captured from fullStream in both modes
 *   4. Stream completes and final text/usage promises resolve
 *
 * Domain: Simple team productivity tracker — two explicit text learners
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/stream-02-brain-ask.ts
 */

import { Brain } from '../../src/brain/class'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

/** Log a fullStream part generically */
function logStreamPart(part: { type: string; [k: string]: unknown }) {
	switch (part.type) {
		case 'text-delta':
			process.stdout.write(String(part.text ?? part.textDelta ?? ''))
			break
		case 'tool-call':
			console.log(`\n  [tool-call] ${part.toolName} — input: ${JSON.stringify(part.input ?? part.args).slice(0, 300)}`)
			break
		case 'tool-result':
			console.log(`  [tool-result] ${part.toolName} — output: ${JSON.stringify(part.output ?? part.result).slice(0, 300)}`)
			break
		case 'tool-call-streaming-start':
		case 'tool-call-delta':
			break
		default:
			console.log(`\n  [${part.type}] ${JSON.stringify(part).slice(0, 200)}`)
			break
	}
}

async function main() {
	console.log('Eval: Brain askStream')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── Setup brain with explicit learners (no LLM decomposition) ─────────

	const brain = new Brain({
		prompt: 'Track team productivity and project status',
		model,
		autoSetup: false,
		learners: [
			{
				id: 'meetings',
				name: 'Meeting Notes',
				type: 'text' as const,
				description: 'Tracks meeting outcomes, decisions, and action items',
				instructions: 'Track meeting outcomes, decisions made, and action items assigned to team members.',
				governance: { strategy: 'continuous' as const },
			},
			{
				id: 'blockers',
				name: 'Blockers & Issues',
				type: 'text' as const,
				description: 'Tracks team blockers and issues',
				instructions: 'Track blockers, issues, and impediments affecting team productivity.',
				governance: { strategy: 'continuous' as const },
			},
		],
		internalLearners: {
			globalUnderstanding: false,
			globalQueryUnderstanding: false,
			injectionGaps: false,
			queryGaps: false,
		},
	})

	// Collect brain events
	const brainEvents: Array<{ type: string; ts: number }> = []
	const t0 = Date.now()
	brain.on((event) => {
		brainEvents.push({ type: event.type, ts: Date.now() - t0 })
	})

	await brain.initialize()
	console.log(`\nLearners: ${brain.getLearners().map((l) => l.id).join(', ')}`)

	// ── Inject data into learners ────────────────────────────────────────

	console.log('\n--- Injecting data ---')

	await brain.inject([
		'Monday standup: Alice is working on the auth module, Bob is fixing the search indexer. Decision: deploy auth by Thursday.',
		'Sprint retro: Team agreed to reduce meeting time by 30%. Action item: Bob to set up async standup bot.',
		'The CI pipeline has been failing intermittently for 2 days due to flaky integration tests. Alice is investigating.',
		'Blocker: The staging database is out of disk space. Ops team notified but no ETA on fix.',
	])

	console.log('Data injected.')

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 1: askStream — direct mode (plain text synthesis)
	// ══════════════════════════════════════════════════════════════════════════

	console.log('\n═══ Scenario 1: brain.askStream (direct mode) ═══\n')

	const question1 = 'What are the current blockers and who is working on what?'
	console.log(`Question: ${question1}`)

	const stream1 = await brain.askStream(question1, { mode: 'direct' })

	const textChunks: string[] = []
	console.log('\n--- textStream ---')
	for await (const chunk of stream1.textStream) {
		textChunks.push(chunk)
		process.stdout.write(chunk)
	}
	console.log('\n--- end textStream ---')

	console.log(`\nTotal text chunks: ${textChunks.length}`)

	const text1 = await stream1.text
	const usage1 = await stream1.usage
	const finishReason1 = await stream1.finishReason

	console.log(`Final text length: ${text1.length}`)
	console.log(`Usage: ${JSON.stringify(usage1)}`)
	console.log(`Finish reason: ${finishReason1}`)

	// ══════════════════════════════════════════════════════════════════════════
	// SCENARIO 2: askStream — deep mode (agentic, tool events visible)
	// ══════════════════════════════════════════════════════════════════════════

	console.log('\n═══ Scenario 2: brain.askStream (deep mode) ═══\n')

	const question2 = 'Give me a summary of what the team decided and what issues remain.'
	console.log(`Question: ${question2}`)

	const stream2 = await brain.askStream(question2, { mode: 'deep' })

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

	const text2 = await stream2.text
	const usage2 = await stream2.usage
	const toolCalls2 = await stream2.toolCalls
	console.log(`\nFinal text: ${text2.slice(0, 300)}`)
	console.log(`Usage: ${JSON.stringify(usage2)}`)
	console.log(`Tool calls: ${toolCalls2.length}`)
	for (const tc of toolCalls2) {
		const t = tc as { toolName: string; input?: unknown }
		console.log(`  ${t.toolName}: ${JSON.stringify(t.input).slice(0, 200)}`)
	}

	// ── Brain events summary ─────────────────────────────────────────────

	console.log('\n--- Brain events ---')
	for (const e of brainEvents) {
		console.log(`  [${e.ts}ms] ${e.type}`)
	}

	console.log('\n═══ Done ═══')
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
