/**
 * Eval: Evaluator evaluateEvolutionStream
 *
 * Objectives:
 *   1. evaluateEvolutionStream returns a stream + decisions promise
 *   2. fullStream yields tool-call/tool-result events for evaluator tools
 *   3. decisions promise resolves with evolution decisions after stream completes
 *
 * Domain: Simple team tracker — 2 explicit text learners, inject data,
 *         push signals, then stream the evaluation
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/stream-03-evaluator.ts
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
	console.log('Eval: Evaluator evaluateEvolutionStream')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── Setup brain with explicit learners + evolution enabled ──────────

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
		evolution: {
			enabled: true,
			autoEvaluate: false,
			model,
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

	// ── Inject data so learners have understanding ──────────────────────

	console.log('\n--- Injecting data ---')

	await brain.inject([
		'Monday standup: Alice is working on the auth module, Bob is fixing the search indexer. Decision: deploy auth by Thursday.',
		'Sprint retro: Team agreed to reduce meeting time by 30%. Action item: Bob to set up async standup bot.',
		'The CI pipeline has been failing intermittently for 2 days due to flaky integration tests. Alice is investigating.',
		'Blocker: The staging database is out of disk space. Ops team notified but no ETA on fix.',
	])

	console.log('Data injected.')

	// ── Push extra signals to ensure buffer is non-empty ────────────────

	console.log('\n--- Pushing signals ---')

	brain.signal({
		source: 'eval',
		description: 'The team is expanding — two new engineers joining next sprint. We may need a specialist to track onboarding tasks and ramp-up progress.',
	})

	brain.signal({
		source: 'eval',
		description: 'Multiple CI/infrastructure issues are being tracked alongside code blockers. Consider whether infrastructure deserves its own specialist.',
	})

	console.log('Signals pushed.')

	// ══════════════════════════════════════════════════════════════════════
	// STREAM: evaluateEvolutionStream (dryRun — don't execute decisions)
	// ══════════════════════════════════════════════════════════════════════

	console.log('\n═══ evaluateEvolutionStream (dryRun) ═══\n')

	const { stream, decisions: decisionsPromise } = await brain.evaluateEvolutionStream({ dryRun: true })

	if (!stream) {
		console.log('No stream (no signals buffered)')
	} else {
		const eventTypes = new Map<string, number>()
		console.log('--- fullStream events ---')
		for await (const part of stream.fullStream) {
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
	}

	// ── Await decisions ─────────────────────────────────────────────────

	console.log('\n--- Awaiting decisions ---')
	const { decisions, results } = await decisionsPromise

	console.log(`\nDecisions: ${decisions.length}`)
	for (const d of decisions) {
		console.log(`  [${d.action}] targets: ${d.targets.join(', ') || '(none)'} — ${d.reasoning}`)
		if (d.guidance) console.log(`    guidance: ${d.guidance.slice(0, 200)}`)
	}

	console.log(`\nResults (dryRun): created=${results.created.length} updated=${results.updated.length} deleted=${results.deleted.length} merged=${results.merged.length} split=${results.split.length}`)

	// ── Brain events summary ────────────────────────────────────────────

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
