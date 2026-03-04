/**
 * Eval: Knowledge Curation — Brain Level
 *
 * Tests the Brain orchestrator on the knowledge-curation dataset.
 * The brain receives a research-assistant prompt and must decompose into
 * appropriate learners, route heterogeneous knowledge sources (bookmarks,
 * highlights, tweets, notes), and synthesize cross-learner insights.
 *
 * Objectives:
 *   1. Decomposition quality — Does the brain create learners that map to the
 *      different facets of knowledge curation? Expected: topic tracking,
 *      contradiction/tension detection, depth assessment, temporal progression —
 *      or similar reasonable decomposition.
 *   2. Cross-learner synthesis — Does brain.ask() combine insights across
 *      learners for questions like "What do I know about CRDTs?" (spans topic
 *      frequency + depth + contradictions)?
 *   3. Contradiction surfacing — When asked about conflicting views, does the
 *      brain synthesize across learners to surface specific contradictions?
 *      Ground truth: Kleppmann vs Figma on CRDTs, offline-first essential vs
 *      over-engineered.
 *   4. Learner utilization — After ingestion, do multiple learners have
 *      understanding? Data is homogeneous (all research), so learners should
 *      differentiate by analytical lens, not data type.
 *
 * Ground truth (from dataset metadata):
 *   - Contradictions: CRDT scale (Kleppmann evt_028 vs Figma evt_045),
 *     offline-first necessity (evt_012 vs evt_058)
 *   - Topic counts: CRDTs ~18, offline-first ~9, sync protocols ~6
 *   - Depth: deep on CRDTs/Automerge, moderate on Yjs/sync, shallow on P2P/WebRTC
 *   - Temporal: general → CRDTs → practical concerns → implementation choices
 *
 * Dataset: evals/datasets/knowledge-curation.json (72 events, 6 weeks)
 *
 * Run (full):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-knowledge-brain.ts
 *
 * Run (query only):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-knowledge-brain.ts
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
const dataset = JSON.parse(readFileSync(join(datasetsDir, 'knowledge-curation.json'), 'utf-8'))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)
const QUERY_ONLY = process.env.QUERY_ONLY === '1'

const dbDir = join(__dirname, '..', '.data')
mkdirSync(dbDir, { recursive: true })
const BRAIN_DB = join(dbDir, 'knowledge-brain.db')

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

	console.log('Eval: Knowledge Curation — Brain Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (init + ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${BRAIN_DB}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create brain ─────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & initialize brain ━━━')

	const brain = new Brain({
		prompt: [
			"Act as a research knowledge assistant. Track and synthesize everything a",
			"researcher saves — bookmarks, paper highlights, tweet saves, blog clippings,",
			"and personal notes — to build a comprehensive map of their knowledge landscape.",
			'',
			'Build understanding of:',
			'- Topic coverage and frequency: what subjects appear, how often, across what source types',
			'- Contradictions and tensions: when saved sources make conflicting claims about the same topic',
			'- Knowledge depth vs breadth: which topics have deep engagement (multiple sources, highlights, notes) vs shallow saves',
			'- Research evolution: how focus shifts over time — what they explored first, when they went deep, pivots',
			'- The gap between bookmarked (intent) and highlighted/noted (engaged)',
		].join('\n'),
		model,
		store: new SQLiteBrainStore(BRAIN_DB),
		learning: {
			store: (learnerId: string) => new SQLiteStore(join(dbDir, `knowledge-brain-${learnerId}.db`)),
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

	console.log('\n━━━ 6. Query: "What do I know about CRDTs?" ━━━')
	console.log('  (Should combine topic frequency + depth + contradiction signals)')
	printAskResult(await askSafe(brain, 'What do I know about CRDTs?'))

	console.log('\n━━━ 7. Query: "Are there any conflicting views in what I\'ve saved?" ━━━')
	console.log('  (Ground truth: Kleppmann vs Figma on CRDTs, offline-first debate)')
	printAskResult(await askSafe(brain, "Are there any conflicting views in what I've saved?"))

	console.log('\n━━━ 8. Query: "How has my research focus evolved over time?" ━━━')
	console.log('  (Ground truth: general → CRDTs → practical concerns → implementation)')
	printAskResult(await askSafe(brain, 'How has my research focus evolved over time?'))

	console.log('\n━━━ 9. Query: "Where are my knowledge gaps?" ━━━')
	console.log('  (Should identify shallow areas: P2P, WebRTC, and bookmark-only saves)')
	printAskResult(await askSafe(brain, 'Where are my knowledge gaps?'))

	console.log('\n━━━ 10. Query: "If I had to explain local-first to a colleague, what could I cover confidently vs what would I need to look up?" ━━━')
	console.log('  (Cross-cutting: requires depth assessment + topic coverage + gap awareness)')
	printAskResult(await askSafe(brain, 'If I had to explain local-first to a colleague, what could I cover confidently vs what would I need to look up?'))

	// ── 11. Done ────────────────────────────────────────────────────────────

	console.log(`\n━━━ Done in ${elapsed()}s ━━━`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
