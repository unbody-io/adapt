/**
 * Eval: Learner Prompt Quality
 *
 * Tests observer/understand/query through Brain with known inputs.
 * Dumps raw results for every operation — no abstractions.
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/learner-prompts-eval.ts
 */

import { Brain } from '../../src/brain/class'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const ARCH_DATA = [
	{ label: 'relevant', text: 'Microservices architecture breaks apps into small, independently deployable services. Each owns its data and communicates via APIs.' },
	{ label: 'relevant', text: 'CQRS separates read/write models. Commands modify state, queries read it. With event sourcing provides full audit trails.' },
	{ label: 'relevant', text: 'The strangler fig pattern incrementally migrates monolith to microservices. Replace components one at a time.' },
	{ label: 'irrelevant', text: 'To make perfect risotto: toast arborio rice in butter, add warm stock one ladle at a time stirring constantly.' },
	{ label: 'irrelevant', text: 'Marathon training: 16-week plan. Build base mileage first, add 10% weekly. Long runs on weekends.' },
	{ label: 'irrelevant', text: 'The best way to learn guitar is to start with basic chord shapes and practice transitions between them daily.' },
	{ label: 'edge', text: 'Our team reorganized from a monolithic structure to cross-functional squads aligned to business domains.' },
	{ label: 'edge', text: 'The new CI/CD pipeline uses Docker containers that are independently versioned and deployed through ArgoCD.' },
]

const TEST_DATA = [
	{ label: 'relevant', text: 'Unit tests should be fast, isolated, single-behavior. Use test doubles (mocks, stubs, fakes). AAA pattern: Arrange, Act, Assert.' },
	{ label: 'relevant', text: 'Integration tests verify components work together. Test DB queries, API endpoints, service interactions. Use testcontainers.' },
	{ label: 'relevant', text: 'Property-based testing generates random inputs to find edge cases. fast-check creates hundreds of test cases.' },
	{ label: 'irrelevant', text: 'To make perfect risotto: toast arborio rice in butter, add warm stock one ladle at a time stirring constantly.' },
	{ label: 'irrelevant', text: 'Marathon training: 16-week plan. Build base mileage first, add 10% weekly. Long runs on weekends.' },
	{ label: 'irrelevant', text: 'The best way to learn guitar is to start with basic chord shapes and practice transitions between them daily.' },
	{ label: 'edge', text: 'We review all pull requests with at least two approvers and run automated checks before merging.' },
	{ label: 'edge', text: 'Load testing with k6 showed our API handles 10k requests/second before response times degrade past 200ms.' },
]

const QUESTIONS = [
	{ label: 'in-domain', text: 'What are the trade-offs of microservices vs monoliths?' },
	{ label: 'in-domain', text: 'What is the AAA testing pattern?' },
	{ label: 'in-domain', text: 'How does the strangler fig migration pattern work?' },
	{ label: 'out-of-domain', text: 'How do I make sourdough bread?' },
	{ label: 'out-of-domain', text: 'What is the best marathon training plan?' },
	{ label: 'out-of-domain', text: 'How do I tune a guitar?' },
	{ label: 'edge', text: 'How should teams be organized when adopting microservices?' },
	{ label: 'edge', text: 'What is the relationship between CI/CD pipelines and testing strategy?' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(obj: unknown): string {
	return JSON.stringify(obj, null, 2)
}

function errorDetail(err: unknown): string {
	if (!(err instanceof Error)) return String(err)
	const lines = [`${err.name}: ${err.message}`]
	if ('cause' in err && err.cause) lines.push(`  cause: ${json(err.cause)}`)
	if ('data' in err) lines.push(`  data: ${json((err as Record<string, unknown>).data)}`)
	if ('responseBody' in err) lines.push(`  responseBody: ${String((err as Record<string, unknown>).responseBody).slice(0, 500)}`)
	return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const lines: string[] = []
	const log = (s: string) => { console.log(s); lines.push(s) }

	log(`=== Learner Prompt Quality Eval ===`)
	log(`Model: ${MODEL}`)
	log(`Date: ${new Date().toISOString()}\n`)

	const brain = new Brain({
		prompt: 'You analyze software engineering practices — architecture patterns, testing strategies, deployment pipelines.',
		model,
		store: new MemoryBrainStore(),
		autoSetup: false,
		learners: [
			{
				id: 'arch',
				name: 'Architecture Expert',
				description: 'Tracks software architecture patterns',
				type: 'text',
				instructions: 'Track knowledge about software architecture: microservices, monoliths, event-driven, CQRS, DDD, migration patterns. Focus on patterns, trade-offs, and when to use each.',
			},
			{
				id: 'testing',
				name: 'Testing Expert',
				description: 'Tracks software testing practices',
				type: 'text',
				instructions: 'Track knowledge about software testing: unit tests, integration tests, e2e tests, TDD, property-based testing. Focus on strategies, tools, and best practices.',
			},
		],
		learning: {
			store: () => new MemoryStore(),
			understand: { thresholds: { maxObservations: 3, minImportance: 0.2 } },
		},
		evolution: { enabled: false },
	})

	await brain.initialize()

	// ─── PHASE 1: Inject Data (observe + understand) ────────────────────

	logger.logSection('PHASE 1: Inject Data')

	const datasets = [
		{ learnerId: 'arch', data: ARCH_DATA },
		{ learnerId: 'testing', data: TEST_DATA },
	]

	for (const set of datasets) {
		log(`\n--- ${set.learnerId} learner ---\n`)

		for (let i = 0; i < set.data.length; i++) {
			const item = set.data[i]
			log(`  [${item.label} ${i}] input: "${item.text.slice(0, 80)}..."`)

			try {
				const r = await brain.inject([item.text])

				// Dump raw result for this learner
				for (const batch of r.batches) {
					for (const lr of batch.results) {
						if (lr.learnerId !== set.learnerId) continue
						log(`    ${lr.learnerId}: ${json(lr.result)}`)
					}
				}
			} catch (err) {
				log(`    ERROR: ${errorDetail(err)}`)
			}
			log('')
		}
	}

	// ─── PHASE 2: Learner State Dump ────────────────────────────────────

	logger.logSection('PHASE 2: Learner State')

	for (const l of brain.getLearners()) {
		const u = await l.getUnderstanding()
		const text = typeof u === 'string' ? u : JSON.stringify(u)
		const metrics = l.getMetrics()

		log(`\n--- ${l.id} (${l.name}) ---`)
		log(`  metrics: ${json(metrics)}`)
		log(`  understanding (${text?.length ?? 0} chars):`)
		if (text && text.length > 2) {
			log(text)
		} else {
			log('  (empty)')
		}
		log('')
	}

	// ─── PHASE 3: Direct Learner Query ──────────────────────────────────

	logger.logSection('PHASE 3: Direct Learner Query (per learner)')

	const learners = brain.getLearners()
	for (const q of QUESTIONS) {
		log(`\n--- [${q.label}] "${q.text}" ---\n`)

		for (const learner of learners) {
			try {
				const r = await learner.query(q.text)
				log(`  ${learner.id}: ${json(r)}`)
			} catch (err) {
				log(`  ${learner.id} ERROR: ${errorDetail(err)}`)
			}
		}
		log('')
	}

	// ─── PHASE 4: Brain Ask (synthesis) ──────────────────────────────────

	logger.logSection('PHASE 4: Brain Ask')

	for (const q of QUESTIONS) {
		log(`\n--- [${q.label}] "${q.text}" ---\n`)

		try {
			const r = await brain.ask(q.text)
			log(`  insight: ${r.insight}`)
			log(`  gaps: ${json(r.gaps)}`)
			log(`  sources:`)
			for (const s of r.sources) {
				log(`    ${s.learnerId}: relevance=${s.relevance}, confidence=${s.confidence}`)
				log(`      insight: ${s.insight}`)
			}
		} catch (err) {
			log(`  ERROR: ${errorDetail(err)}`)
		}
		log('')
	}

	// ─── Save Report ─────────────────────────────────────────────────────

	await brain.dispose()

	const reportsDir = join(__dirname, '..', 'reports')
	mkdirSync(reportsDir, { recursive: true })
	const modelSlug = MODEL.replace(/\//g, '-')
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
	const filepath = join(reportsDir, `learner-prompts-${modelSlug}-${timestamp}.txt`)
	writeFileSync(filepath, lines.join('\n'), 'utf-8')

	logger.logSuccess(`Report saved: ${filepath}`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
