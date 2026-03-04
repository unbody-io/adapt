/**
 * Eval: Codebase Onboarding — Learner Level
 *
 * Objectives:
 *   1. Architecture understanding — Can the learner describe the system's data flow?
 *      Ground truth: Dashboard → useAnalytics → analyticsApi → GraphQL → Redis cache → ClickHouse
 *      Event flow: Client SDK → Kafka → event-processor → ClickHouse
 *   2. Convention extraction — Does the learner identify coding patterns?
 *      Ground truth: feature folders, barrel exports, named exports only, Zod validation,
 *      React Query for fetching, conventional commits, squash merge
 *   3. Tech debt awareness — Does the learner surface known problems?
 *      Ground truth: TECH-DEBT-17 (raw SQL), TECH-DEBT-23 (no DLQ — fixed in PR #510),
 *      TECH-DEBT-31 (no E2E tests), TECH-DEBT-42 (cache invalidation — partially fixed)
 *   4. Dependency reasoning — Can the learner infer what breaks if something changes?
 *      Ground truth: changing event schema affects Kafka topic → event-processor validation →
 *      ClickHouse tables → GraphQL types → frontend types (via codegen)
 *
 * Dataset: evals/datasets/codebase-onboarding.json (65 events, 2 weeks)
 *
 * Run (full):
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/usecase-codebase-learner.ts
 *
 * Run (query only):
 *   export $(cat .env.local | xargs) && QUERY_ONLY=1 npx tsx evals/scripts/usecase-codebase-learner.ts
 */

import { TextLearner } from '../../src/learners/text-learner/class'
import { SQLiteStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const datasetsDir = join(__dirname, '..', 'datasets')
const dataset = JSON.parse(readFileSync(join(datasetsDir, 'codebase-onboarding.json'), 'utf-8'))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)
const QUERY_ONLY = process.env.QUERY_ONLY === '1'

const dbDir = join(__dirname, '..', '.data')
mkdirSync(dbDir, { recursive: true })
const DB_PATH = join(dbDir, 'codebase-learner.db')

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const events: Array<{ id: string; timestamp: string; type: string; content: string; source: string }> = dataset.events

	console.log('Eval: Codebase Onboarding — Learner Level')
	console.log(`Model: ${MODEL}`)
	console.log(`Mode: ${QUERY_ONLY ? 'QUERY ONLY (restored from SQLite)' : 'FULL (ingest + query)'}`)
	console.log(`Dataset: ${dataset.metadata.name} (${events.length} events)`)
	console.log(`Store: ${DB_PATH}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ── 1. Create learner ────────────────────────────────────────────────────

	console.log('\n━━━ 1. Create & init learner ━━━')

	const learner = new TextLearner({
		model,
		id: 'codebase-analyst',
		name: 'Codebase Analyst',
		description:
			'Builds an understanding of a codebase from architecture docs, file headers, PR descriptions, code review comments, and developer onboarding notes',
		instructions: [
			'You are a codebase analyst. You observe what a developer reads and notes as they onboard to a new codebase — architecture docs, file headers, PR descriptions, code review comments, and their personal notes.',
			'',
			'Build understanding of:',
			'- Architecture: the system\'s components, how data flows between them, what technologies are used and why',
			'- Conventions: coding patterns the team follows — file structure, naming, validation, testing, deployment. Note what\'s enforced vs what\'s just common practice',
			'- Tech debt and risks: acknowledged problems (TECH-DEBT tickets), recurring pain points in code reviews, missing infrastructure (no tests, no monitoring, etc.)',
			'- Dependencies: which components depend on which — if X changes, what downstream systems are affected?',
			'- Gotchas: non-obvious constraints or behaviors that a new developer would need to know (e.g., eventual consistency, append-only storage, manual processes)',
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

	console.log('\n━━━ 4. Query: "How does the analytics pipeline work?" ━━━')

	const q1 = await learner.query('How does the analytics pipeline work?')
	console.log(`\nRelevant: ${q1.relevant}`)
	console.log(`Relevance: ${q1.relevance}`)
	console.log(`Confidence: ${q1.confidence}`)
	console.log(`\nInsight:\n${q1.insight}`)
	console.log(`\nGaps: ${q1.gaps}`)

	console.log('\n━━━ 5. Query: "What conventions should I follow when writing code here?" ━━━')

	const q2 = await learner.query('What conventions should I follow when writing code here?')
	console.log(`\nRelevant: ${q2.relevant}`)
	console.log(`Relevance: ${q2.relevance}`)
	console.log(`Confidence: ${q2.confidence}`)
	console.log(`\nInsight:\n${q2.insight}`)
	console.log(`\nGaps: ${q2.gaps}`)

	console.log('\n━━━ 6. Query: "What\'s the tech debt situation?" ━━━')

	const q3 = await learner.query("What's the tech debt situation?")
	console.log(`\nRelevant: ${q3.relevant}`)
	console.log(`Relevance: ${q3.relevance}`)
	console.log(`Confidence: ${q3.confidence}`)
	console.log(`\nInsight:\n${q3.insight}`)
	console.log(`\nGaps: ${q3.gaps}`)

	console.log('\n━━━ 7. Query: "If I change the event schema, what breaks?" ━━━')

	const q4 = await learner.query('If I change the event schema, what breaks?')
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
