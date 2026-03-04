/**
 * Eval: Knowledge Curation — Learner Level
 *
 * Objectives:
 *   1. Contradiction detection — Does the learner notice conflicting claims across sources?
 *      Ground truth: Kleppmann says CRDTs scale to thousands (evt_028) vs Figma says they don't (evt_045);
 *      offline-first essential (evt_012) vs "most apps don't need it" (evt_058)
 *   2. Topic frequency — Can the learner track what the researcher saves most about?
 *      Ground truth: CRDTs in 18 events, offline-first in 9, sync protocols in 6
 *   3. Knowledge depth — Can the learner distinguish deep vs shallow knowledge areas?
 *      Ground truth: deep on CRDTs/Automerge, moderate on Yjs/sync, shallow on P2P/WebRTC
 *   4. Temporal progression — Does the learner notice the shift in research focus over time?
 *      Ground truth: general → CRDTs → practical concerns → implementation choices
 *
 * Dataset: evals/datasets/knowledge-curation.json (72 events, 6 weeks)
 *
 * Run (full — ingest + query, persists to SQLite):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-knowledge-learner.ts
 *
 * Run (query only — restores from SQLite, skips ingestion):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-knowledge-learner.ts
 */

import { TextLearner } from '../../src/learners/text-learner/class'
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
const DB_PATH = join(dbDir, 'knowledge-learner.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; type: string; content: string; source: string }> = dataset.events

	console.log('Eval: Knowledge Curation — Learner Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${DB_PATH}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create learner ────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & init learner ━━━')

	const learner = new TextLearner({
		model,
		id: 'knowledge-curator',
		name: 'Knowledge Curator',
		description:
			'Tracks and synthesizes a researcher\'s saved knowledge — bookmarks, highlights, clippings, and personal notes — to build an understanding of what they know, what contradicts, and where their gaps are',
		instructions: [
			'You are a knowledge curator. You observe what a researcher saves — bookmarks, paper highlights, tweet saves, blog clippings, and personal notes — to understand the landscape of their knowledge.',
			'',
			'Pay special attention to:',
			'- Topic coverage: what subjects appear across their saves. Track approximate save counts per topic (e.g., "CRDTs — ~15 saves across papers, bookmarks, and tweets")',
			'- Direct contradictions: when two saved sources make conflicting claims about the same thing, note the specific conflict, the sources, and any context that explains the disagreement',
			'- Knowledge evolution: track how research focus shifts week by week — what they explored first, when they went deep, when they pivoted',
			'- Depth vs breadth: distinguish topics with deep engagement (highlights, notes, multiple sources) from shallow saves (single bookmark, no follow-up)',
			'- The gap between what they\'ve bookmarked (intent to learn) and what they\'ve highlighted or noted (actual engagement)',
		].join('\n'),
		store: new SQLiteStore(DB_PATH),
		governance: { strategy: 'continuous' },
		understand: {
			thresholds: {
				minImportance: 0.2,
				maxObservations: 8,
			},
		},
	})

	await learner.init()
	console.log(`  [${elapsed()}s] Initialized`)

	// Print system prompts after init
	console.log('\n--- Observer system prompt ---')
	console.log(learner.getObserveSystemPrompt())
	console.log('\n--- Understand system prompt ---')
	console.log(learner.getUnderstandSystemPrompt())

	if (!QUERY_ONLY) {
		// Wire up event logging
		learner.on((event) => {
			switch (event.type) {
				case 'learner:observed': {
					const p = event.payload as { importance?: number }
					console.log(`  [${elapsed()}s] observed — importance: ${p?.importance}`)
					break
				}
				case 'learner:observe:dismissed':
					console.log(`  [${elapsed()}s] dismissed`)
					break
				case 'learner:synthesized': {
					const p = event.payload as { significance?: string; evolution?: string; newUnderstanding?: unknown }
					console.log(`  [${elapsed()}s] synthesized — significance: ${p?.significance}`)
					console.log(`  Evolution: ${p?.evolution}`)
					console.log(`  Full understanding after this synthesis:`)
					console.log(typeof p?.newUnderstanding === 'string' ? p.newUnderstanding : JSON.stringify(p?.newUnderstanding))
					break
				}
				case 'learner:synthesize:dismissed':
					console.log(`  [${elapsed()}s] synthesis dismissed`)
					break
			}
		})

		// ── 2. Ingest data ───────────────────────────────────────────────────

		console.log('\n━━━ 2. Ingest data stream ━━━')

		const BATCH_SIZE = 6
		const batches: typeof events[] = []
		for (let i = 0; i < events.length; i += BATCH_SIZE) {
			batches.push(events.slice(i, i + BATCH_SIZE))
		}

		console.log(`  Total events: ${events.length}, Batch size: ${BATCH_SIZE}, Batches: ${batches.length}`)

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i]
			const batchData = batch.map(
				(evt) => `[${evt.timestamp}] [${evt.type}] [source: ${evt.source}]\n${evt.content}`,
			)

			console.log(`\n  --- Batch ${i + 1}/${batches.length} (${batch[0].id}–${batch[batch.length - 1].id}) ---`)
			await learner.learn(batchData)

			// Print full understanding after every batch
			const currentUnderstanding = await learner.getUnderstanding()
			console.log(`  Understanding after batch ${i + 1} (${currentUnderstanding.length} chars):`)
			console.log(currentUnderstanding || '  (empty)')
		}
	} else {
		console.log('\n━━━ 2. Skipped ingestion (QUERY_ONLY mode) ━━━')
	}

	// ── 3. Final state ───────────────────────────────────────────────────────

	console.log('\n━━━ 3. Final state ━━━')

	const understanding = await learner.getUnderstanding()
	const metrics = learner.getMetrics()

	console.log(`\nMetrics:`)
	console.log(`  Observations: ${metrics.ingestion.observationCount}`)
	console.log(`  Syntheses: ${metrics.ingestion.synthesisCount}`)
	console.log(`  Dismissal rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(1)}%`)

	console.log(`\nFull understanding (${understanding.length} chars):`)
	console.log(understanding)

	// ── 4. Queries ───────────────────────────────────────────────────────────

	console.log('\n━━━ 4. Query: "What do I know about CRDTs?" ━━━')

	const q1 = await learner.query('What do I know about CRDTs?')
	console.log(`\nRelevant: ${q1.relevant}`)
	console.log(`Relevance: ${q1.relevance}`)
	console.log(`Confidence: ${q1.confidence}`)
	console.log(`\nInsight:\n${q1.insight}`)
	console.log(`\nGaps: ${q1.gaps}`)

	console.log('\n━━━ 5. Query: "Are there any conflicting views in what I\'ve saved?" ━━━')

	const q2 = await learner.query("Are there any conflicting views in what I've saved?")
	console.log(`\nRelevant: ${q2.relevant}`)
	console.log(`Relevance: ${q2.relevance}`)
	console.log(`Confidence: ${q2.confidence}`)
	console.log(`\nInsight:\n${q2.insight}`)
	console.log(`\nGaps: ${q2.gaps}`)

	console.log('\n━━━ 6. Query: "What topics have I bookmarked the most?" ━━━')

	const q3 = await learner.query('What topics have I bookmarked the most?')
	console.log(`\nRelevant: ${q3.relevant}`)
	console.log(`Relevance: ${q3.relevance}`)
	console.log(`Confidence: ${q3.confidence}`)
	console.log(`\nInsight:\n${q3.insight}`)
	console.log(`\nGaps: ${q3.gaps}`)

	console.log('\n━━━ 7. Query: "What are my knowledge gaps?" ━━━')

	const q4 = await learner.query('What are my knowledge gaps?')
	console.log(`\nRelevant: ${q4.relevant}`)
	console.log(`Relevance: ${q4.relevance}`)
	console.log(`Confidence: ${q4.confidence}`)
	console.log(`\nInsight:\n${q4.insight}`)
	console.log(`\nGaps: ${q4.gaps}`)

	// ── 5. Done ──────────────────────────────────────────────────────────────

	console.log(`\n━━━ Done in ${elapsed()}s ━━━`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
