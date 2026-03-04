/**
 * Eval: Personal Behavioral Intelligence — Learner Level
 *
 * Objectives:
 *   1. Avoidance detection — Does the learner identify indirect avoidance patterns?
 *      Ground truth: exercise/gym (cancelled 6x with excuses), dentist (rescheduled 4x),
 *      promotion conversation with manager (dodged at 4 separate 1:1s)
 *   2. Topic frequency — Can the learner give an approximate count for recurring topics?
 *      Ground truth: "career change" appears in 11 events, "AI/machine learning" in 7
 *   3. Browsing behavior analysis — Does the learner surface meaningful browsing patterns?
 *      Ground truth: late-night sessions (11pm-2am), weekend deep-dive rabbit holes,
 *      morning news/reddit routine, frequent tab hopping during work
 *   4. Proactive frustration detection — Does synthesis flag aggression/frustration moments?
 *      Ground truth events: evt_019, evt_034, evt_052, evt_071 (Alex snapping at colleague Dave)
 *
 * Dataset: evals/datasets/personal-behavior.json (85 events, 2 months)
 *
 * Run (full — ingest + query, persists to SQLite):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-behavior-learner.ts
 *
 * Run (query only — restores from SQLite, skips ingestion):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-behavior-learner.ts
 */

import { TextLearner } from '../../src/learners/text-learner/class'
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
const DB_PATH = join(dbDir, 'behavior-learner.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; type: string; content: string; source: string }> = dataset.events

	console.log('Eval: Personal Behavioral Intelligence — Learner Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${DB_PATH}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create learner ────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & init learner ━━━')

	const learner = new TextLearner({
		model,
		id: 'behavioral-analyst',
		name: 'Behavioral Analyst',
		description:
			"Observes and understands behavioral patterns, emotional states, avoidance tendencies, and recurring themes from a person's digital activity stream",
		instructions: [
			"You are a behavioral pattern analyst. You observe a person's digital activity — messages, browsing history, calendar events, journal entries, and app usage — to build a deep understanding of their behavioral patterns.",
			'',
			'Pay special attention to:',
			'- Avoidance patterns: things they repeatedly postpone, cancel, make excuses about, or find reasons to skip — even when they express wanting to do them',
			'- Recurring topics: subjects that come up across different contexts and conversations. Track approximate frequency counts for recurring topics (e.g., "career change — mentioned ~8 times across conversations and journal entries")',
			'- Emotional patterns: frustration, aggression, anxiety, excitement — and what triggers them',
			'- Browsing behaviors: when they browse, how they browse (deep dives vs quick checks), what categories, late-night patterns',
			'- The gap between stated intentions and actual actions',
			'',
			'IMPORTANT — Proactive alerting:',
			'When you notice frustration, aggression, or hostility in the data (e.g., someone snapping at a colleague, expressing anger, being harsh), flag this prominently in your understanding evolution notes. These are critical behavioral signals.',
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

	// Print query system prompt
	console.log('\n--- Query system prompt ---')
	console.log(`Observation schema: ${JSON.stringify(learner.getObservationSchema(), null, 2)}`)
	console.log(`Understanding schema: ${JSON.stringify(learner.getUnderstandingSchema(), null, 2)}`)

	// ── 4. Queries ───────────────────────────────────────────────────────────

	console.log('\n━━━ 4. Query: "What have I been avoiding the most?" ━━━')

	const q1 = await learner.query('What have I been avoiding the most?')
	console.log(`\nRelevant: ${q1.relevant}`)
	console.log(`Relevance: ${q1.relevance}`)
	console.log(`Confidence: ${q1.confidence}`)
	console.log(`\nInsight:\n${q1.insight}`)
	console.log(`\nGaps: ${q1.gaps}`)

	console.log('\n━━━ 5. Query: "How many times did I talk about career change?" ━━━')

	const q2 = await learner.query('How many times did I talk about career change?')
	console.log(`\nRelevant: ${q2.relevant}`)
	console.log(`Relevance: ${q2.relevance}`)
	console.log(`Confidence: ${q2.confidence}`)
	console.log(`\nInsight:\n${q2.insight}`)
	console.log(`\nGaps: ${q2.gaps}`)

	console.log('\n━━━ 6. Query: "Can you give me a deep analysis of how I browse the web?" ━━━')

	const q3 = await learner.query('Can you give me a deep analysis of how I browse the web?')
	console.log(`\nRelevant: ${q3.relevant}`)
	console.log(`Relevance: ${q3.relevance}`)
	console.log(`Confidence: ${q3.confidence}`)
	console.log(`\nInsight:\n${q3.insight}`)
	console.log(`\nGaps: ${q3.gaps}`)

	// ── 5. Done ──────────────────────────────────────────────────────────────

	console.log(`\n━━━ Done in ${elapsed()}s ━━━`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
