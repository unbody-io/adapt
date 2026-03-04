/**
 * Eval: Personal Behavioral Intelligence — Brain Level
 *
 * Tests the Brain orchestrator (not a single learner) on the same behavioral
 * dataset used in usecase-behavior-learner.ts. The brain receives a high-level
 * prompt and must decompose it into appropriate learners, route data, and
 * synthesize cross-learner insights.
 *
 * Objectives:
 *   1. Decomposition quality — Does the brain create well-scoped, non-redundant
 *      learners from the prompt? Expected: behavioral patterns, emotional states,
 *      browsing habits, avoidance detection — or similar reasonable decomposition.
 *   2. Cross-learner synthesis — Does brain.ask() produce richer answers than any
 *      single learner could? Queries that span multiple concern areas should
 *      integrate insights from relevant learners.
 *   3. Learner coverage — After ingestion, do multiple learners have understanding?
 *      No learner should be starved (0 observations) if the data is diverse enough.
 *   4. Internal learner awareness — Does the brain's global understanding capture
 *      cross-cutting themes (e.g., career anxiety shows in both conversations and
 *      browsing)?
 *
 * Ground truth (from dataset metadata):
 *   - Avoidance: exercise/gym (cancelled 6x), dentist (rescheduled 4x),
 *     promotion conversation (dodged at 4 separate 1:1s)
 *   - Topic counts: "career change" ~11 events, "AI/machine learning" ~7
 *   - Browsing: late-night (11pm-2am), weekend rabbit holes, morning routine,
 *     tab hopping during work
 *   - Frustration events: evt_019, evt_034, evt_052, evt_071
 *
 * Dataset: evals/datasets/personal-behavior.json (85 events, 2 months)
 *
 * Run (full — init + ingest + query):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-behavior-brain.ts
 *
 * Run (query only — restores from SQLite, skips ingestion):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-behavior-brain.ts
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
const dataset = JSON.parse(readFileSync(join(datasetsDir, 'personal-behavior.json'), 'utf-8'))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)
const QUERY_ONLY = process.env.QUERY_ONLY === '1'

const dbDir = join(__dirname, '..', '.data')
mkdirSync(dbDir, { recursive: true })
const BRAIN_DB = join(dbDir, 'behavior-brain.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
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
	console.log(`\nSynthesized insight:\n${result.insight}`)
	console.log(`\nSources:`)
	for (const s of result.sources) {
		console.log(`  ${s.learnerId}: relevance=${s.relevance} confidence=${s.confidence}`)
		console.log(`    ${s.insight.slice(0, 200)}...`)
	}
	console.log(`\nGaps: ${result.gaps.length ? result.gaps.join('; ') : '(none)'}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; type: string; content: string; source: string }> = dataset.events

	console.log('Eval: Personal Behavioral Intelligence — Brain Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (init + ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${BRAIN_DB}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create brain ─────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & initialize brain ━━━')

	const brain = new Brain({
		prompt: [
			"Learn about a person's behavioral patterns from their digital activity stream.",
			'',
			'This includes messages, browsing history, calendar events, journal entries,',
			'and app usage data. Build a comprehensive understanding of:',
			'- Avoidance patterns: things they postpone, cancel, or make excuses about',
			'- Recurring topics and their frequency across different contexts',
			'- Emotional patterns: frustration, aggression, anxiety, excitement — and triggers',
			'- Browsing behaviors: timing patterns, depth vs breadth, categories',
			'- The gap between stated intentions and actual actions',
			'',
			'Flag frustration or hostility moments prominently when detected.',
		].join('\n'),
		model,
		store: new SQLiteBrainStore(BRAIN_DB),
		learning: {
			store: (learnerId: string) => new SQLiteStore(join(dbDir, `behavior-brain-${learnerId}.db`)),
			governance: { strategy: 'continuous' },
			understand: {
				thresholds: {
					minImportance: 0.2,
					maxObservations: 8,
				},
			},
		},
		evolution: {
			enabled: true,
			autoEvaluate: false,
		},
		ingest: { batchSize: 6 },
	})

	// Wire up brain-level event logging
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
				console.log(`  [${elapsed()}s] Signal: [${p.source}] ${p.description}`)
				break
			}
			case 'evaluator:evaluation:completed': {
				const p = event.payload as { decisions: Array<{ action: string; reasoning: string; targets: string[] }> }
				console.log(`  [${elapsed()}s] Evolution evaluation — ${p.decisions.length} decisions:`)
				for (const d of p.decisions) {
					console.log(`    ${d.action} [${d.targets.join(', ')}]: ${d.reasoning}`)
				}
				break
			}
			case 'evolution:action:executed': {
				const p = event.payload as { action: string; targets: string[]; result: { newLearnerIds?: string[]; deletedLearnerIds?: string[] } }
				console.log(`  [${elapsed()}s] Evolution executed: ${p.action} [${p.targets.join(', ')}]`)
				if (p.result.newLearnerIds?.length) console.log(`    Created: ${p.result.newLearnerIds.join(', ')}`)
				if (p.result.deletedLearnerIds?.length) console.log(`    Deleted: ${p.result.deletedLearnerIds.join(', ')}`)
				break
			}
		}
	})

	await brain.initialize()
	console.log(`  [${elapsed()}s] Brain initialized`)

	// ── 2. Log decomposition details ────────────────────────────────────────

	console.log('\n━━━ 2. Decomposition details ━━━')

	const learners = brain.getLearners()
	console.log(`\nLearner count: ${learners.length}`)

	for (const l of learners) {
		const meta = l.getMetadata()
		console.log(`\n  Learner: ${l.id}`)
		console.log(`  Instructions: ${meta.instructions}`)
		console.log(`  Origin: ${meta.origin}`)
	}

	if (brain.evolutionContext) {
		console.log(`\nEvolution context:\n${brain.evolutionContext}`)
	}

	if (QUERY_ONLY) {
		console.log('\n━━━ Skipped ingestion (QUERY_ONLY mode) ━━━')
	} else {
		// ── 3. Ingest data ──────────────────────────────────────────────────

		console.log('\n━━━ 3. Ingest data stream ━━━')

		const formatted = events.map(
			(evt) => `[${evt.timestamp}] [${evt.type}] [source: ${evt.source}]\n${evt.content}`,
		)

		console.log(`  Total events: ${events.length}`)

		const result = await brain.inject(formatted)
		console.log(`  [${elapsed()}s] Inject completed — ${result.batches.length} batches`)

		// ── 4. Per-learner state after ingestion ────────────────────────────

		console.log('\n━━━ 4. Per-learner state after ingestion ━━━')

		for (const l of brain.getLearners()) {
			const metrics = l.getMetrics()
			const understanding = await l.getUnderstanding()
			const health = l.getHealth()

			console.log(`\n  ── ${l.id} ──`)
			console.log(`  Health: ${JSON.stringify(health)}`)
			console.log(`  Observations: ${metrics.ingestion.observationCount}`)
			console.log(`  Syntheses: ${metrics.ingestion.synthesisCount}`)
			console.log(`  Dismissal rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(1)}%`)
			console.log(`  Understanding (${(understanding as string)?.length ?? 0} chars):`)
			console.log(understanding || '  (empty)')
		}
	}

	// ── 5. Internal learner state ───────────────────────────────────────────

	console.log('\n━━━ 5. Internal learners ━━━')

	for (const [id, l] of brain.internalLearners) {
		const understanding = await l.getUnderstanding()
		const hasKnowledge = await l.hasKnowledge()
		console.log(`\n  ── ${id} ──`)
		console.log(`  Has knowledge: ${hasKnowledge}`)
		console.log(`  Understanding (${(understanding as string)?.length ?? 0} chars):`)
		console.log(understanding || '  (empty)')
	}

	// ── 6. Cross-learner queries ────────────────────────────────────────────

	console.log('\n━━━ 6. Query: "What have I been avoiding the most?" ━━━')
	printAskResult(await askSafe(brain, 'What have I been avoiding the most?'))

	console.log('\n━━━ 7. Query: "How many times did I talk about career change?" ━━━')
	printAskResult(await askSafe(brain, 'How many times did I talk about career change?'))

	console.log('\n━━━ 8. Query: "Give me a deep analysis of my browsing behavior" ━━━')
	printAskResult(await askSafe(brain, 'Give me a deep analysis of my browsing behavior'))

	console.log('\n━━━ 9. Query: "Am I showing signs of burnout?" ━━━')
	console.log('  (Cross-cutting query — should combine emotional + behavioral + browsing signals)')
	printAskResult(await askSafe(brain, 'Am I showing signs of burnout?'))

	// ── 10. Done ────────────────────────────────────────────────────────────

	console.log(`\n━━━ Done in ${elapsed()}s ━━━`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
