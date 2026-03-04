/**
 * Eval: Brain Evolution & Adaptation — Digital Twin
 *
 * Tests the Brain's ability to evolve its learner topology over time.
 * Uses the digital-twin-daily dataset (60 events across 10 domains) which is
 * designed to stress-test evolution: the brain starts with auto-decomposition
 * from a deliberately narrow prompt, then receives data spanning many life
 * domains that should trigger evolution signals.
 *
 * Objectives:
 *   1. Initial decomposition — Does the brain create a reasonable starting set
 *      of learners from the prompt? The prompt focuses on "developer daily life"
 *      but data spans: software-development, health-therapy, cooking-food,
 *      fitness, relationships, hobbies-reading, finance, travel, home-living, music.
 *   2. Signal accumulation — As data arrives across 10 domains, do learners emit
 *      signals about gaps, overload, or topic drift? Log all signals to verify
 *      the brain notices mismatches between its learner topology and incoming data.
 *   3. Triggered evolution quality — When we manually trigger evolution mid-stream,
 *      does the evaluator make sensible decisions? Expected: create new learners
 *      for uncovered domains, possibly split overloaded learners.
 *   4. Post-evolution improvement — After evolution, do queries about previously
 *      uncovered domains get better answers? Compare ask() results before and
 *      after evolution for domains that were initially missed.
 *   5. Learner topology at end — Final learner set should cover the 10 domains
 *      more completely than the initial decomposition.
 *
 * Dataset: evals/datasets/digital-twin-daily.json (60 events, 10 domains)
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-evolution-brain.ts
 */

import { Brain } from '../../src/brain'
import { SQLiteBrainStore } from '../../src/brain/stores'
import { SQLiteStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const datasetsDir = join(__dirname, '..', 'datasets')
const dataset = JSON.parse(readFileSync(join(datasetsDir, 'digital-twin-daily.json'), 'utf-8'))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

const dbDir = join(__dirname, '..', '.data')
mkdirSync(dbDir, { recursive: true })
const BRAIN_DB = join(dbDir, 'evolution-brain.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

function printLearnerTopology(brain: Brain, label: string) {
	const learners = brain.getLearners()
	console.log(`\n  ${label} — ${learners.length} learners:`)
	for (const l of learners) {
		const meta = l.getMetadata()
		console.log(`    - ${l.id}: ${meta.instructions.slice(0, 120)}...`)
		console.log(`      origin=${meta.origin} health=${JSON.stringify(meta.health)}`)
	}
}

async function printLearnerStates(brain: Brain) {
	for (const l of brain.getLearners()) {
		const metrics = l.getMetrics()
		const understanding = await l.getUnderstanding()

		console.log(`\n  ── ${l.id} ──`)
		console.log(`  Observations: ${metrics.ingestion.observationCount}`)
		console.log(`  Syntheses: ${metrics.ingestion.synthesisCount}`)
		console.log(`  Dismissal rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(1)}%`)
		console.log(`  Understanding (${(understanding as string)?.length ?? 0} chars):`)
		console.log(understanding || '  (empty)')
	}
}

async function askSafe(brain: Brain, query: string): Promise<import('../../src/brain/types').BrainAskResult | null> {
	try {
		return await brain.ask(query)
	} catch (err) {
		console.log(`  ⚠ brain.ask() failed: ${err instanceof Error ? err.message : String(err)}`)
		return null
	}
}

function printAskResult(result: import('../../src/brain/types').BrainAskResult | null) {
	if (!result) return
	console.log(`  Insight: ${result.insight}`)
	console.log(`  Sources: ${result.sources.map((s) => `${s.learnerId}(rel=${s.relevance},conf=${s.confidence})`).join(', ')}`)
	console.log(`  Gaps: ${result.gaps.length ? result.gaps.join('; ') : '(none)'}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; domain: string; content: string }> = dataset.events

	console.log('Eval: Brain Evolution & Adaptation — Digital Twin')
	console.log(`Model: ${MODEL}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events, ${dataset.metadata.domains.length} domains)`)
	console.log(`Domains: ${dataset.metadata.domains.join(', ')}`)
	console.log(`Store: ${BRAIN_DB}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create brain with a prompt that's deliberately incomplete ────────

	console.log('\n━━━ 1. Create & initialize brain ━━━')
	console.log('  (Prompt focuses on "developer daily life" — intentionally broad)')

	const brain = new Brain({
		prompt: [
			"Build a digital twin of a software developer's daily life.",
			'',
			'Learn from their journal entries, notes, and activity logs to understand',
			'who they are across all dimensions — not just their work, but their full life.',
			'This includes work patterns, personal interests, health, relationships,',
			'hobbies, and anything else that emerges from the data.',
		].join('\n'),
		model,
		store: new SQLiteBrainStore(BRAIN_DB),
		learning: {
			store: (learnerId: string) => new SQLiteStore(join(dbDir, `evolution-brain-${learnerId}.db`)),
			governance: { strategy: 'continuous' },
			understand: {
				thresholds: {
					minImportance: 0.2,
					maxObservations: 6,
				},
			},
		},
		evolution: {
			enabled: true,
			autoEvaluate: false,
			evaluatorSignalThreshold: 8,
		},
		ingest: { batchSize: 4 },
	})

	// Collect all signals for analysis
	const signals: Array<{ time: string; source: string; description: string }> = []
	const evolutionDecisions: Array<{ action: string; targets: string[]; reasoning: string }> = []

	brain.on((event) => {
		switch (event.type) {
			case 'brain:init:config:generated': {
				const p = event.payload as { configs: Array<{ id: string; name: string; description: string; type: string }> }
				console.log(`  [${elapsed()}s] Decomposition generated ${p.configs.length} learners:`)
				for (const c of p.configs) {
					console.log(`    - ${c.id} (${c.type}): ${c.name}`)
					console.log(`      ${c.description}`)
				}
				break
			}
			case 'brain:init:completed': {
				const p = event.payload as { learnerIds: string[] }
				console.log(`  [${elapsed()}s] Init completed — ${p.learnerIds.length} learners`)
				break
			}
			case 'brain:inject:batch:completed': {
				const p = event.payload as { batchIndex: number; results: Array<{ learnerId: string; result: { status: string } }> }
				const statuses = p.results.map((r) => `${r.learnerId}:${r.result.status}`).join(', ')
				console.log(`  [${elapsed()}s] Batch ${p.batchIndex} — ${statuses}`)
				break
			}
			case 'brain:signal:received': {
				const p = event.payload as { source: string; description: string }
				signals.push({ time: elapsed(), source: p.source, description: p.description })
				console.log(`  [${elapsed()}s] Signal: [${p.source}] ${p.description}`)
				break
			}
			case 'evaluator:evaluation:completed': {
				const p = event.payload as { decisions: Array<{ action: string; reasoning: string; guidance: string; targets: string[] }> }
				console.log(`  [${elapsed()}s] Evolution evaluation — ${p.decisions.length} decisions:`)
				for (const d of p.decisions) {
					evolutionDecisions.push(d)
					console.log(`    ${d.action} [${d.targets.join(', ')}]: ${d.reasoning}`)
					console.log(`      guidance: ${d.guidance}`)
				}
				break
			}
			case 'evolution:action:executed': {
				const p = event.payload as { action: string; targets: string[]; result: { newLearnerIds?: string[]; deletedLearnerIds?: string[]; updatedLearnerIds?: string[] } }
				console.log(`  [${elapsed()}s] Evolution executed: ${p.action} [${p.targets.join(', ')}]`)
				if (p.result.newLearnerIds?.length) console.log(`    Created: ${p.result.newLearnerIds.join(', ')}`)
				if (p.result.deletedLearnerIds?.length) console.log(`    Deleted: ${p.result.deletedLearnerIds.join(', ')}`)
				if (p.result.updatedLearnerIds?.length) console.log(`    Updated: ${p.result.updatedLearnerIds.join(', ')}`)
				break
			}
			case 'evolution:action:failed': {
				const p = event.payload as { action: string; targets: string[]; error: string }
				console.log(`  [${elapsed()}s] Evolution FAILED: ${p.action} [${p.targets.join(', ')}] — ${p.error}`)
				break
			}
		}
	})

	await brain.initialize()
	console.log(`  [${elapsed()}s] Brain initialized`)

	// ── 2. Initial decomposition ────────────────────────────────────────────

	console.log('\n━━━ 2. Initial decomposition ━━━')
	printLearnerTopology(brain, 'Initial topology')

	if (brain.evolutionContext) {
		console.log(`\nEvolution context:\n${brain.evolutionContext}`)
	}

	// ── 3. Pre-evolution baseline queries ───────────────────────────────────

	// We'll query domains that might NOT be covered by initial decomposition
	console.log('\n━━━ 3. Pre-evolution baseline queries (before any data) ━━━')
	console.log('  (These establish a baseline — most should have no knowledge yet)')

	const baselineQueries = [
		'What do I cook and how are my cooking skills progressing?',
		'How is my fitness routine going?',
		'What are my financial habits?',
		"What's my relationship with music?",
	]

	// Skip baseline queries since no data ingested yet — they'd all be empty

	// ── 4. Ingest first half of data ────────────────────────────────────────

	console.log('\n━━━ 4. Ingest first half of data (events 1-30) ━━━')

	const firstHalf = events.slice(0, 30)
	const formatted1 = firstHalf.map(
		(evt) => `[${evt.timestamp}] [domain: ${evt.domain}]\n${evt.content}`,
	)

	console.log(`  Events: ${firstHalf.length}`)
	console.log(`  Domains in this half: ${[...new Set(firstHalf.map((e) => e.domain))].join(', ')}`)

	const result1 = await brain.inject(formatted1)
	console.log(`  [${elapsed()}s] First half injected — ${result1.batches.length} batches`)

	// ── 5. Mid-stream state ─────────────────────────────────────────────────

	console.log('\n━━━ 5. Mid-stream learner state ━━━')
	await printLearnerStates(brain)

	console.log(`\n  Signals accumulated so far: ${signals.length}`)
	for (const s of signals) {
		console.log(`    [${s.time}s] [${s.source}] ${s.description}`)
	}

	// ── 6. Mid-stream queries (before evolution) ────────────────────────────

	console.log('\n━━━ 6. Mid-stream queries (BEFORE evolution) ━━━')

	for (const q of baselineQueries) {
		console.log(`\n  ── Query: "${q}" ──`)
		printAskResult(await askSafe(brain, q))
	}

	// ── 7. Trigger evolution ────────────────────────────────────────────────

	console.log('\n━━━ 7. Trigger evolution ━━━')
	console.log(`  Signals before trigger: ${signals.length}`)

	await brain.triggerEvolution({
		source: 'eval',
		description: 'Mid-stream evolution check — data spans 10 life domains, assess if current learner topology provides adequate coverage',
	})

	// Wait for async evaluation to complete
	await new Promise((resolve) => setTimeout(resolve, 3000))

	console.log(`\n  Evolution decisions made: ${evolutionDecisions.length}`)
	printLearnerTopology(brain, 'Post-evolution topology')

	// ── 8. Ingest second half ───────────────────────────────────────────────

	console.log('\n━━━ 8. Ingest second half of data (events 31-60) ━━━')

	const secondHalf = events.slice(30)
	const formatted2 = secondHalf.map(
		(evt) => `[${evt.timestamp}] [domain: ${evt.domain}]\n${evt.content}`,
	)

	console.log(`  Events: ${secondHalf.length}`)
	console.log(`  Domains in this half: ${[...new Set(secondHalf.map((e) => e.domain))].join(', ')}`)

	const result2 = await brain.inject(formatted2)
	console.log(`  [${elapsed()}s] Second half injected — ${result2.batches.length} batches`)

	// ── 9. Final learner state ──────────────────────────────────────────────

	console.log('\n━━━ 9. Final learner state ━━━')
	await printLearnerStates(brain)

	// ── 10. Internal learners ───────────────────────────────────────────────

	console.log('\n━━━ 10. Internal learners ━━━')

	for (const [id, l] of brain.internalLearners) {
		const understanding = await l.getUnderstanding()
		const hasKnowledge = await l.hasKnowledge()
		console.log(`\n  ── ${id} ──`)
		console.log(`  Has knowledge: ${hasKnowledge}`)
		console.log(`  Understanding (${(understanding as string)?.length ?? 0} chars):`)
		console.log(understanding || '  (empty)')
	}

	// ── 11. Post-evolution queries ──────────────────────────────────────────

	console.log('\n━━━ 11. Post-evolution queries (AFTER evolution + full data) ━━━')

	for (const q of baselineQueries) {
		console.log(`\n  ── Query: "${q}" ──`)
		printAskResult(await askSafe(brain, q))
	}

	// ── 12. Cross-domain synthesis query ────────────────────────────────────

	console.log('\n━━━ 12. Cross-domain synthesis queries ━━━')

	console.log('\n  ── Query: "Give me a holistic picture of who I am" ──')
	printAskResult(await askSafe(brain, 'Give me a holistic picture of who I am'))

	console.log('\n  ── Query: "How do my work stress patterns affect my other activities?" ──')
	printAskResult(await askSafe(brain, 'How do my work stress patterns affect my other activities?'))

	// ── 13. Signal & evolution summary ──────────────────────────────────────

	console.log('\n━━━ 13. Evolution summary ━━━')
	console.log(`\nTotal signals: ${signals.length}`)
	console.log(`Total evolution decisions: ${evolutionDecisions.length}`)

	const signalSources = signals.reduce((acc, s) => {
		acc[s.source] = (acc[s.source] || 0) + 1
		return acc
	}, {} as Record<string, number>)
	console.log(`\nSignals by source:`)
	for (const [src, count] of Object.entries(signalSources)) {
		console.log(`  ${src}: ${count}`)
	}

	printLearnerTopology(brain, 'Final topology')

	// ── Done ────────────────────────────────────────────────────────────────

	console.log(`\n━━━ Done in ${elapsed()}s ━━━`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
