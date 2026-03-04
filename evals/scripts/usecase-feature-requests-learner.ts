/**
 * Eval: Feature Request Tracking — List Learner Level
 *
 * Objectives:
 *   1. Dedup accuracy — Does the learner merge "SSO", "SAML", "single sign-on", "enterprise SSO"
 *      into a single item? Ground truth: 4 wordings → 1 feature.
 *   2. Item count — After ingesting 32 events with overlapping requests, how many distinct
 *      features does the learner track? Ground truth: ~12 distinct features.
 *   3. Confidence/signal tracking — Does "dark mode" (6 sources) have higher confidence than
 *      "bulk import" (1 source)? Are enterprise signals tagged?
 *   4. Deprioritization — Does the learner reflect that "crypto payments" was explicitly
 *      deprioritized (evt_018 PM note)?
 *   5. Query: aggregation — "What's the most requested feature?" should surface dark mode.
 *   6. Query: filtering — "What do enterprise customers want?" should surface SSO, webhooks,
 *      custom fields, audit log, guest access.
 *   7. Query: search + dedup — "Show me everything about SSO" should return one consolidated item.
 *   8. Query: signal tracking — "Are there any deprioritized requests?" should surface crypto payments.
 *
 * Dataset: evals/datasets/feature-requests.json (32 events)
 *
 * Run (full):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-feature-requests-learner.ts
 *
 * Run (query only):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-feature-requests-learner.ts
 */

import { ListLearner } from '../../src/learners/list-learner/class'
import { SQLiteStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const datasetsDir = join(__dirname, '..', 'datasets')
const dataset = JSON.parse(readFileSync(join(datasetsDir, 'feature-requests.json'), 'utf-8'))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)
const QUERY_ONLY = process.env.QUERY_ONLY === '1'

const dbDir = join(__dirname, '..', '.data')
mkdirSync(dbDir, { recursive: true })
const DB_PATH = join(dbDir, 'feature-requests-learner.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; type: string; content: string; source: string }> = dataset.events

	console.log('Eval: Feature Request Tracking — List Learner Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${DB_PATH}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create learner ────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & init learner ━━━')

	const learner = new ListLearner({
		model,
		id: 'feature-tracker',
		name: 'Feature Request Tracker',
		description:
			'Tracks feature requests from multiple channels, merges duplicates, and maintains a prioritized backlog of what customers are asking for',
		instructions: [
			'You track feature requests for a SaaS product. Each item in your collection is a distinct feature request.',
			'',
			'For each feature request, track:',
			'- The feature name and a brief description of what customers want',
			'- Which customers or segments are asking (enterprise vs SMB vs startup)',
			'- How many distinct sources have requested it',
			'- Whether it\'s been deprioritized or rejected by the PM',
			'',
			'Merge duplicates aggressively — "SSO", "SAML integration", "single sign-on", and "enterprise SSO" are all the same feature request. When merging, combine the customer sources and increment the request count.',
			'',
			'Increase confidence when multiple independent sources request the same feature. A feature requested by 5 sources should have higher confidence than one requested by 1 source.',
		].join('\n'),
		store: new SQLiteStore(DB_PATH),
		governance: {
			deduplication: 'strict',
			maxItems: 50,
			pruning: 'least-confident',
		},
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

	// Print generated schemas
	console.log('\n--- Observation schema ---')
	console.log(JSON.stringify(learner.getObservationSchema(), null, 2))
	console.log('\n--- Understanding (item) schema ---')
	console.log(JSON.stringify(learner.getUnderstandingSchema(), null, 2))

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
					const p = event.payload as { significance?: string; evolution?: string }
					console.log(`  [${elapsed()}s] synthesized — significance: ${p?.significance}`)
					console.log(`  Evolution: ${p?.evolution}`)
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

			// Print current item count and list after every batch
			const items = await learner.getUnderstanding()
			console.log(`  Items after batch ${i + 1}: ${items.length}`)
			for (const item of items) {
				console.log(`    [${item.id}] conf=${item.metadata.confidence.toFixed(2)} signals=[${item.metadata.signals.join(', ')}] data=${JSON.stringify(item.data)}`)
			}
		}
	} else {
		console.log('\n━━━ 2. Skipped ingestion (QUERY_ONLY mode) ━━━')
	}

	// ── 3. Final state ───────────────────────────────────────────────────────

	console.log('\n━━━ 3. Final state ━━━')

	const items = await learner.getUnderstanding()
	const metrics = learner.getMetrics()

	console.log(`\nMetrics:`)
	console.log(`  Observations: ${metrics.ingestion.observationCount}`)
	console.log(`  Syntheses: ${metrics.ingestion.synthesisCount}`)
	console.log(`  Dismissal rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(1)}%`)

	console.log(`\nTotal items: ${items.length}`)
	console.log('\nAll items (sorted by confidence):')
	const sorted = [...items].sort((a, b) => b.metadata.confidence - a.metadata.confidence)
	for (const item of sorted) {
		console.log(`  [${item.id}] confidence=${item.metadata.confidence.toFixed(2)}`)
		console.log(`    data: ${JSON.stringify(item.data)}`)
		console.log(`    signals: [${item.metadata.signals.join(', ')}]`)
		console.log(`    firstSeen: ${item.metadata.firstSeen}`)
		console.log(`    lastUpdated: ${item.metadata.lastUpdated}`)
	}

	// ── 4. Queries ───────────────────────────────────────────────────────────

	console.log('\n━━━ 4. Query: "What\'s the most requested feature?" ━━━')

	const q1 = await learner.query("What's the most requested feature?")
	console.log(`\nRelevant: ${q1.relevant}`)
	console.log(`Relevance: ${q1.relevance}`)
	console.log(`Confidence: ${q1.confidence}`)
	console.log(`\nInsight:\n${q1.insight}`)
	console.log(`\nGaps: ${q1.gaps}`)

	console.log('\n━━━ 5. Query: "What do enterprise customers want?" ━━━')

	const q2 = await learner.query('What do enterprise customers want?')
	console.log(`\nRelevant: ${q2.relevant}`)
	console.log(`Relevance: ${q2.relevance}`)
	console.log(`Confidence: ${q2.confidence}`)
	console.log(`\nInsight:\n${q2.insight}`)
	console.log(`\nGaps: ${q2.gaps}`)

	console.log('\n━━━ 6. Query: "Tell me everything about SSO" ━━━')

	const q3 = await learner.query('Tell me everything about SSO')
	console.log(`\nRelevant: ${q3.relevant}`)
	console.log(`Relevance: ${q3.relevance}`)
	console.log(`Confidence: ${q3.confidence}`)
	console.log(`\nInsight:\n${q3.insight}`)
	console.log(`\nGaps: ${q3.gaps}`)

	console.log('\n━━━ 7. Query: "Are there any requests we\'ve deprioritized?" ━━━')

	const q4 = await learner.query("Are there any requests we've deprioritized?")
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
