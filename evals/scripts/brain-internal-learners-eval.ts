/**
 * Comprehensive Eval: Internal Learners — Full Pipeline
 *
 * Diagnostic tool — raw logs for LLM inspection (mechanical + semantic).
 * NOT a test suite. Uses non-throwing checks so the eval always runs to completion.
 *
 * Phases:
 *   1. Init — 4 internal learners created, isolated from external
 *   2. Inject Relevant Data — external synthesis → feeds global injection understanding
 *   3. Inject Irrelevant Data — all dismiss → dismissed batch buffer → injection gap learner
 *   4. Query Storm — 6 answerable + 4 unanswerable → feed query learners
 *   5. Signal Check — verify internal learner synthesis → system signals to evaluator
 *   6. Consult — query internal learners directly (specific + all)
 *   7. Evolution & Re-injection — manual evaluateEvolution → new learners → reinject dismissed
 *   8. Final State + KPI Summary — full understanding dumps, event counts, metrics
 *
 * Env:
 *   MODEL — model for ALL LLM calls (default: google/gemini-2.0-flash-001)
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/brain-internal-learners-eval.ts
 */

import { Brain } from '../../src/brain/class'
import { INTERNAL_LEARNER_IDS } from '../../src/brain/internal-learners'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ─────────────────────────────────────────────────────────────────────────────
// Event collection
// ─────────────────────────────────────────────────────────────────────────────

const events: Array<{ type: string; payload?: unknown; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 3) + '...'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function dumpLearner(brain: Brain, id: string, label: string, full = false) {
	const learner = brain.getInternalLearner(id) ?? brain.getLearner(id)
	if (!learner) {
		console.log(`  ${label}: NOT FOUND`)
		return
	}
	const understanding = await learner.getUnderstanding()
	const text = typeof understanding === 'string' ? understanding : JSON.stringify(understanding)
	const buffer = await learner.getBufferState()
	const metrics = learner.getMetrics()

	console.log(`  ${label} (${learner.type}):`)
	console.log(`    Understanding: ${text?.length ?? 0} chars`)
	console.log(`    Buffer: ${buffer.count} pending observations`)
	console.log(`    Observations: ${metrics.ingestion.observationCount}, Synthesis: ${metrics.ingestion.synthesisCount}, Dismissals: ${metrics.ingestion.dismissalCount} (${(metrics.ingestion.dismissalRate * 100).toFixed(0)}%)`)
	console.log(`    Queries: ${metrics.query.count}`)
	if (full && text && text.length > 2) {
		console.log(`    --- Full Understanding ---`)
		console.log(text)
		console.log(`    --- End Understanding ---`)
	} else if (text && text.length > 2) {
		console.log(`    Preview: ${truncate(text.replace(/\n/g, ' '), 400)}`)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const RELEVANT_BATCH_1 = [
	'Microservices architecture breaks apps into small, independently deployable services. Each owns its data and communicates via APIs. Benefits: independent scaling, tech diversity, fault isolation. Drawbacks: distributed complexity, network latency, data consistency.',
	'CQRS separates read/write models. Commands modify state, queries read it. With event sourcing provides full audit trails. Best for complex domains with different read/write scaling needs.',
	'Event-driven architecture uses events for inter-service communication. Producers emit, consumers react. Loose coupling, async processing. Challenges: eventual consistency, ordering, debugging.',
]

const RELEVANT_BATCH_2 = [
	'Unit tests should be fast, isolated, single-behavior. Use test doubles (mocks, stubs, fakes). High coverage of business logic not infrastructure. AAA pattern: Arrange, Act, Assert.',
	'Integration tests verify components work together. Test DB queries, API endpoints, service interactions. Slower than unit tests but catch real issues. Use testcontainers for DB tests.',
	'E2E tests validate entire user flows through the real system. Cypress, Playwright for browser automation. Slow and flaky but catch integration issues nothing else can.',
]

const RELEVANT_BATCH_3 = [
	'The strangler fig pattern incrementally migrates monolith to microservices. Route traffic through a facade, replace components one at a time. Low risk, reversible, production-proven.',
	'API gateway pattern centralizes cross-cutting concerns: auth, rate limiting, routing, logging. Kong, AWS API Gateway, Nginx. Single entry point simplifies client integration.',
	'Service mesh (Istio, Linkerd) handles service-to-service communication: mTLS, load balancing, circuit breaking, observability. Removes networking logic from application code.',
]

const IRRELEVANT_COOKING = [
	'To make perfect risotto: toast arborio rice in butter 2 min, add warm stock one ladle at a time stirring constantly. Rice releases starch creating creamy texture. Finish with parmesan and cold butter.',
	'Sourdough bread: mature starter (100% hydration), 500g flour, 350g water, 100g starter, 10g salt. Autolyse 30 min, stretch and fold every 30 min for 2 hrs. Bulk ferment 4-6 hrs.',
	'Thai green curry paste: blend green chilies, lemongrass, galangal, shallots, garlic, cilantro roots, cumin, coriander, shrimp paste. Fry in coconut cream until oil separates.',
]

const IRRELEVANT_FITNESS = [
	'Marathon training: 16-week plan. Build base mileage first, add 10% weekly. Long runs on weekends, tempo runs midweek, easy recovery days. Taper 2 weeks before race. Target 40-50 miles/week peak.',
	'Yoga for developers: desk yoga sequence — cat-cow spine, seated twist, wrist circles, neck rolls. 10 min every 2 hours. Prevents RSI, reduces tension headaches, improves focus.',
	'HIIT protocol: 30s all-out effort, 90s recovery, 8 rounds. Burns more fat than steady-state cardio. Best 3x/week with rest days. Pair with strength training for body composition.',
]

const ANSWERABLE_QUESTIONS = [
	'What are the trade-offs of microservices vs monoliths?',
	'When should I use event-driven architecture?',
	'What is the best unit testing strategy for complex business logic?',
	'How does CQRS relate to event sourcing?',
	'What testing tools work best for integration tests?',
	'Explain the strangler fig migration pattern.',
]

const UNANSWERABLE_QUESTIONS = [
	'How do I make the perfect sourdough starter?',
	'What is the best recipe for Thai green curry?',
	'What is the ideal marathon training plan for beginners?',
	'How should I structure a HIIT workout?',
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`\n=== Comprehensive Eval: Internal Learners ===`)
	console.log(`Model: ${MODEL}`)
	console.log(`Date: ${new Date().toISOString()}\n`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 1: Init
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 1: Init')

	const brain = new Brain({
		prompt: 'You analyze software engineering practices — architecture patterns, testing strategies, deployment pipelines, and DevOps workflows.',
		model,
		store: new MemoryBrainStore(),
		autoSetup: false,
		learners: [
			{
				id: 'arch-learner',
				name: 'Architecture Expert',
				description: 'Tracks software architecture patterns and trade-offs',
				type: 'text',
				instructions: 'Track knowledge about software architecture: microservices, monoliths, event-driven, CQRS, DDD. Focus on patterns, trade-offs, and when to use each.',
			},
			{
				id: 'testing-learner',
				name: 'Testing Expert',
				description: 'Tracks software testing practices and strategies',
				type: 'text',
				instructions: 'Track knowledge about software testing: unit tests, integration tests, e2e tests, TDD, property-based testing. Focus on strategies, tools, and best practices.',
			},
		],
		learning: {
			store: () => new MemoryStore(),
			understand: {
				thresholds: {
					maxObservations: 3,
					minImportance: 0.2,
				},
			},
		},
		internalLearners: {
			globalUnderstanding: true,
			globalQueryUnderstanding: true,
			injectionGaps: true,
			queryGaps: true,
		},
		evolution: {
			enabled: true,
			autoEvaluate: false,
			evaluatorSignalThreshold: 1,
		},
	})

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload, time: Date.now() - startTime })
	})

	await brain.initialize()

	const externalLearners = brain.getLearners()
	console.log(`  External learners: ${externalLearners.length}`)
	for (const l of externalLearners) console.log(`    - ${l.id} (${l.name})`)

	console.log(`  Internal learners: ${brain.internalLearners.size}`)
	for (const [id] of brain.internalLearners) console.log(`    - ${id}`)

	logger.logAssertion('External learner count', externalLearners.length === 2, `expected 2, got ${externalLearners.length}`)
	logger.logAssertion('Internal learner count', brain.internalLearners.size === 4, `expected 4, got ${brain.internalLearners.size}`)
	logger.logAssertion('getLearners() excludes internal', externalLearners.every(l => !l.id.startsWith('__internal_')))
	for (const id of Object.values(INTERNAL_LEARNER_IDS)) {
		logger.logAssertion(`getInternalLearner(${id})`, brain.getInternalLearner(id) !== undefined)
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 2: Inject Relevant Data
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 2: Inject Relevant Data')

	console.log(`\n  [${elapsed()}s] Batch 1: Architecture data (${RELEVANT_BATCH_1.length} items)`)
	const r1 = await brain.inject(RELEVANT_BATCH_1)
	for (const b of r1.batches) {
		for (const lr of b.results) console.log(`    ${lr.learnerId}: ${lr.result.status}`)
	}

	console.log(`\n  [${elapsed()}s] Batch 2: Testing data (${RELEVANT_BATCH_2.length} items)`)
	const r2 = await brain.inject(RELEVANT_BATCH_2)
	for (const b of r2.batches) {
		for (const lr of b.results) console.log(`    ${lr.learnerId}: ${lr.result.status}`)
	}

	console.log(`\n  [${elapsed()}s] Batch 3: More architecture (${RELEVANT_BATCH_3.length} items)`)
	const r3 = await brain.inject(RELEVANT_BATCH_3)
	for (const b of r3.batches) {
		for (const lr of b.results) console.log(`    ${lr.learnerId}: ${lr.result.status}`)
	}

	// External synthesis events
	const synthEvents = events.filter(e => e.type === 'learner:synthesized')
	const externalSynthEvents = synthEvents.filter(e => {
		const p = e.payload as Record<string, unknown>
		return !String(p?.learnerId).startsWith('__internal_')
	})
	console.log(`\n  External synthesis events: ${externalSynthEvents.length}`)
	for (const e of externalSynthEvents) {
		const p = e.payload as Record<string, unknown>
		console.log(`    - ${p?.learnerId}: significance=${p?.significance}`)
	}

	logger.logAssertion('At least 1 external synthesis', externalSynthEvents.length >= 1, `got ${externalSynthEvents.length}`)

	// Global understanding state
	console.log(`\n  Global Understanding:`)
	await dumpLearner(brain, INTERNAL_LEARNER_IDS.globalUnderstanding, 'Global')

	const globalLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.globalUnderstanding)!
	const globalMetrics = globalLearner.getMetrics()
	logger.logAssertion('Global understanding fed', globalMetrics.ingestion.observationCount >= 1, `observationCount=${globalMetrics.ingestion.observationCount}`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 3: Inject Irrelevant Data
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 3: Inject Irrelevant Data')

	const dismissedCountBefore = (await brain.store.dismissedBatches.list()).length

	console.log(`\n  [${elapsed()}s] Cooking data (${IRRELEVANT_COOKING.length} items)`)
	const cookResult = await brain.inject(IRRELEVANT_COOKING)
	for (const b of cookResult.batches) {
		for (const lr of b.results) console.log(`    ${lr.learnerId}: ${lr.result.status}`)
	}

	console.log(`\n  [${elapsed()}s] Fitness data (${IRRELEVANT_FITNESS.length} items)`)
	const fitResult = await brain.inject(IRRELEVANT_FITNESS)
	for (const b of fitResult.batches) {
		for (const lr of b.results) console.log(`    ${lr.learnerId}: ${lr.result.status}`)
	}

	// Verify all dismissed
	const allCookDismissed = cookResult.batches.every(b => b.results.every(r => r.result.status === 'observe:dismissed'))
	const allFitDismissed = fitResult.batches.every(b => b.results.every(r => r.result.status === 'observe:dismissed'))
	logger.logAssertion('All cooking data dismissed', allCookDismissed)
	logger.logAssertion('All fitness data dismissed', allFitDismissed)

	// Dismissed batch buffer
	const dismissedBatches = await brain.store.dismissedBatches.list()
	console.log(`\n  Dismissed batch buffer: ${dismissedBatches.length} entries (was ${dismissedCountBefore})`)
	for (const db of dismissedBatches) {
		console.log(`    - ${db.id}: status=${db.status}, retryCount=${db.retryCount}`)
		console.log(`      gaps: ${truncate(JSON.stringify(db.gaps), 200)}`)
	}
	logger.logAssertion('Dismissed buffer has >= 2 entries', dismissedBatches.length >= 2, `got ${dismissedBatches.length}`)

	// Injection gap learner
	console.log(`\n  Injection Gap Learner:`)
	await dumpLearner(brain, INTERNAL_LEARNER_IDS.injectionGaps, 'Injection Gaps')

	const gapLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.injectionGaps)!
	const gapMetrics = gapLearner.getMetrics()
	logger.logAssertion('Injection gap learner fed', gapMetrics.ingestion.observationCount >= 2, `observationCount=${gapMetrics.ingestion.observationCount}`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 4: Query Storm
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 4: Query Storm')

	let askSuccessCount = 0
	let askFailCount = 0

	console.log(`\n  Answerable questions (${ANSWERABLE_QUESTIONS.length}):`)
	for (const q of ANSWERABLE_QUESTIONS) {
		try {
			const r = await brain.ask(q)
			askSuccessCount++
			console.log(`\n    Q: ${q}`)
			for (const s of r.sources) {
				console.log(`      ${s.learnerId}: relevance=${s.relevance.toFixed(2)}, confidence=${s.confidence.toFixed(2)}`)
			}
			console.log(`      Insight: ${truncate(r.insight, 100)}`)
		} catch (err) {
			askFailCount++
			console.log(`\n    Q: ${q}`)
			logger.logWarning(`ask() failed: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	console.log(`\n  Unanswerable questions (${UNANSWERABLE_QUESTIONS.length}):`)
	for (const q of UNANSWERABLE_QUESTIONS) {
		try {
			const r = await brain.ask(q)
			askSuccessCount++
			console.log(`\n    Q: ${q}`)
			for (const s of r.sources) {
				console.log(`      ${s.learnerId}: relevance=${s.relevance.toFixed(2)}, confidence=${s.confidence.toFixed(2)}`)
			}
			console.log(`      Insight: ${truncate(r.insight, 100)}`)
		} catch (err) {
			askFailCount++
			console.log(`\n    Q: ${q}`)
			logger.logWarning(`ask() failed: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	console.log(`\n  Ask results: ${askSuccessCount} succeeded, ${askFailCount} failed`)

	// Global query understanding
	console.log(`\n  Global Query Understanding:`)
	await dumpLearner(brain, INTERNAL_LEARNER_IDS.globalQueryUnderstanding, 'Global Query')

	const queryLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.globalQueryUnderstanding)!
	const queryMetrics = queryLearner.getMetrics()
	logger.logAssertion('Global query observationCount === 10', queryMetrics.ingestion.observationCount === 10, `got ${queryMetrics.ingestion.observationCount}`)

	// Query gap learner
	console.log(`\n  Query Gap Learner:`)
	await dumpLearner(brain, INTERNAL_LEARNER_IDS.queryGaps, 'Query Gaps')

	const queryGapLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.queryGaps)!
	const queryGapMetrics = queryGapLearner.getMetrics()
	logger.logAssertion('Query gap learner fed', queryGapMetrics.ingestion.observationCount >= 1, `observationCount=${queryGapMetrics.ingestion.observationCount}`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 5: Signal Check
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 5: Signal Check')

	const signalEvents = events.filter(e => e.type === 'brain:signal:received')
	console.log(`  Signals received: ${signalEvents.length}`)
	for (const e of signalEvents) {
		const p = e.payload as Record<string, unknown>
		console.log(`    source=${p?.source}, time=${e.time}ms`)
		console.log(`      ${truncate(String(p?.description), 200)}`)
	}

	// Internal learner synthesis events (should wire to system signals)
	const internalSynthEvents = synthEvents.filter(e => {
		const p = e.payload as Record<string, unknown>
		return String(p?.learnerId).startsWith('__internal_')
	})
	console.log(`\n  Internal learner synthesis events: ${internalSynthEvents.length}`)
	for (const e of internalSynthEvents) {
		const p = e.payload as Record<string, unknown>
		console.log(`    ${p?.learnerId}: significance=${p?.significance}`)
	}

	// Non-routine internal syntheses should produce system signals
	const nonRoutineSynths = internalSynthEvents.filter(e => {
		const p = e.payload as Record<string, unknown>
		return p?.significance !== 'routine'
	})
	const systemSignals = signalEvents.filter(e => {
		const p = e.payload as Record<string, unknown>
		return p?.source === 'system'
	})
	console.log(`\n  Non-routine internal syntheses: ${nonRoutineSynths.length}`)
	console.log(`  System signals: ${systemSignals.length}`)
	if (nonRoutineSynths.length > 0) {
		logger.logAssertion('System signals match non-routine syntheses', systemSignals.length >= 1, `got ${systemSignals.length}`)
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 6: Consult
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 6: Consult')

	// 6a. Consult all
	console.log(`\n  [${elapsed()}s] 6a. Consult ALL: "What patterns and knowledge gaps exist?"`)
	try {
		const consultAll = await brain.consult('What patterns and knowledge gaps exist across all system knowledge?')
		console.log(`    Insight (${consultAll.insight.length} chars): ${truncate(consultAll.insight, 400)}`)
		console.log(`    Sources: ${consultAll.sources.length}`)
		for (const s of consultAll.sources) {
			console.log(`      - ${s.learnerId}: relevance=${s.relevance.toFixed(2)}, confidence=${s.confidence.toFixed(2)}`)
		}
		console.log(`    Gaps: ${JSON.stringify(consultAll.gaps)}`)
	} catch (err) {
		logger.logWarning(`consult(all) failed: ${err instanceof Error ? err.message : String(err)}`)
	}

	// 6b-6e. Consult specific internal learners (skip those without knowledge)
	const consultTargets = [
		{ id: INTERNAL_LEARNER_IDS.globalUnderstanding, label: 'Global Understanding', question: 'What does the network understand as a whole? What cross-specialist patterns exist?' },
		{ id: INTERNAL_LEARNER_IDS.injectionGaps, label: 'Injection Gaps', question: 'What data has the system been unable to process? What domains are missing?' },
		{ id: INTERNAL_LEARNER_IDS.globalQueryUnderstanding, label: 'Global Query', question: 'What topics do users ask about most? What query patterns exist?' },
		{ id: INTERNAL_LEARNER_IDS.queryGaps, label: 'Query Gaps', question: 'What questions has the system been unable to answer?' },
	]

	for (const t of consultTargets) {
		const learner = brain.getInternalLearner(t.id)!
		const hasKnowledge = await learner.hasKnowledge()
		if (!hasKnowledge) {
			console.log(`\n  [${elapsed()}s] 6x. ${t.label}: skipped (no knowledge)`)
			continue
		}
		console.log(`\n  [${elapsed()}s] Consult ${t.label}: "${t.question}"`)
		try {
			const result = await brain.consult(t.question, { learner: t.id })
			console.log(`    Insight (${result.insight.length} chars): ${truncate(result.insight, 400)}`)
			if (result.sources.length > 0) {
				console.log(`    Relevance: ${result.sources[0].relevance.toFixed(2)}, Confidence: ${result.sources[0].confidence.toFixed(2)}`)
			}
		} catch (err) {
			logger.logWarning(`consult(${t.label}) failed: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	// 6f. Cross-domain ask (uses consult tools if internal learners have knowledge)
	console.log(`\n  [${elapsed()}s] 6f. Cross-domain ask with consult tools`)
	try {
		const crossResult = await brain.ask('What patterns connect architecture decisions to testing strategies?')
		console.log(`    Insight (${crossResult.insight.length} chars): ${truncate(crossResult.insight, 400)}`)
		console.log(`    Sources: ${crossResult.sources.length}`)
		console.log(`    Gaps: ${JSON.stringify(crossResult.gaps)}`)
	} catch (err) {
		logger.logWarning(`cross-domain ask() failed: ${err instanceof Error ? err.message : String(err)}`)
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 7: Evolution & Re-injection
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 7: Evolution & Re-injection')

	const preEvoLearnerCount = brain.getLearners().length
	const preDismissedCount = (await brain.store.dismissedBatches.list()).length
	console.log(`  Pre-evolution: ${preEvoLearnerCount} external learners, ${preDismissedCount} dismissed batches`)

	console.log(`\n  [${elapsed()}s] Evaluating evolution...`)
	const { decisions, results: evoResults } = await brain.evaluateEvolution()

	console.log(`\n  Decisions: ${decisions.length}`)
	for (const d of decisions) {
		console.log(`    ${d.action.toUpperCase()} → targets: ${d.targets.length > 0 ? d.targets.join(', ') : '(new)'}`)
		console.log(`      Reasoning: ${truncate(d.reasoning, 200)}`)
		console.log(`      Guidance: ${truncate(d.guidance, 200)}`)
	}

	console.log(`\n  Execution results:`)
	console.log(`    Created: ${evoResults.created.length} ${evoResults.created.length > 0 ? `(${evoResults.created.join(', ')})` : ''}`)
	console.log(`    Updated: ${evoResults.updated.length}`)
	console.log(`    Deleted: ${evoResults.deleted.length}`)
	console.log(`    Merged: ${evoResults.merged.length}`)

	logger.logAssertion('At least 1 evolution decision', decisions.length >= 1, `got ${decisions.length}`)

	// Post-evolution state
	const postEvoLearnerCount = brain.getLearners().length
	console.log(`\n  Post-evolution: ${postEvoLearnerCount} external learners`)
	if (postEvoLearnerCount > preEvoLearnerCount) {
		const newLearners = brain.getLearners().filter(l => l.id !== 'arch-learner' && l.id !== 'testing-learner')
		for (const l of newLearners) {
			console.log(`    NEW: ${l.id} — ${l.name}`)
			console.log(`      instructions: ${truncate(l.instructions, 200)}`)
		}
		logger.logAssertion('At least 1 new learner', newLearners.length >= 1)
	}

	// Wait for async re-injection
	console.log(`\n  [${elapsed()}s] Waiting 5s for async re-injection...`)
	await new Promise(r => setTimeout(r, 5000))

	// Dismissed batch buffer after
	const postDismissed = await brain.store.dismissedBatches.list()
	console.log(`\n  Dismissed batches: ${preDismissedCount} → ${postDismissed.length}`)
	for (const db of postDismissed) {
		console.log(`    - ${db.id}: status=${db.status}, retryCount=${db.retryCount}`)
	}

	const resolvedCount = preDismissedCount - postDismissed.length
	const retriedCount = postDismissed.filter(d => d.status === 'retried').length
	console.log(`  Resolved: ${resolvedCount}, Still retried: ${retriedCount}, Still pending: ${postDismissed.filter(d => d.status === 'pending').length}`)
	if (evoResults.created.length > 0) {
		logger.logAssertion('Some dismissed batches resolved or retried', resolvedCount > 0 || retriedCount > 0)
	}

	// Gap learner state after evolution
	console.log(`\n  Injection Gap Learner after evolution:`)
	await dumpLearner(brain, INTERNAL_LEARNER_IDS.injectionGaps, 'Injection Gaps')

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PHASE 8: Final State + KPI Summary
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('PHASE 8: Final State + KPI Summary')

	// 8a. External learners
	console.log(`\n  === External Learners (${brain.getLearners().length}) ===`)
	for (const l of brain.getLearners()) {
		const u = await l.getUnderstanding()
		const text = typeof u === 'string' ? u : JSON.stringify(u)
		const m = l.getMetrics()
		const h = l.getHealth()
		console.log(`\n  ${l.id} (${l.name}, ${l.type}):`)
		console.log(`    Understanding: ${text?.length ?? 0} chars`)
		console.log(`    Health: activation=${h.activation}, status=${h.status}`)
		console.log(`    Observations: ${m.ingestion.observationCount}, Synthesis: ${m.ingestion.synthesisCount}, Dismissals: ${m.ingestion.dismissalCount} (${(m.ingestion.dismissalRate * 100).toFixed(0)}%)`)
		console.log(`    Queries: ${m.query.count}`)
	}

	// 8b. Internal learners — FULL understanding dumps
	console.log(`\n  === Internal Learners (${brain.internalLearners.size}) — Full Understanding ===`)
	for (const id of Object.values(INTERNAL_LEARNER_IDS)) {
		console.log()
		await dumpLearner(brain, id, id, true)
	}

	// 8c. Dismissed batch buffer
	const finalDismissed = await brain.store.dismissedBatches.list()
	console.log(`\n  === Dismissed Batch Buffer: ${finalDismissed.length} entries ===`)
	for (const db of finalDismissed) {
		console.log(`    ${db.id}: status=${db.status}, retryCount=${db.retryCount}, gaps=${truncate(JSON.stringify(db.gaps), 150)}`)
	}

	// 8d. Event summary
	console.log(`\n  === Event Summary ===`)
	const eventCounts: Record<string, number> = {}
	for (const e of events) eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`    ${type}: ${count}`)
	}

	// 8e. KPI Summary
	const totalElapsed = Date.now() - startTime

	// Gather synthesis counts per internal learner
	const internalSynthCounts: Record<string, number> = {}
	for (const id of Object.values(INTERNAL_LEARNER_IDS)) {
		internalSynthCounts[id] = brain.getInternalLearner(id)!.getMetrics().ingestion.synthesisCount
	}

	// External dismissal rates
	const externalDismissalRates: Record<string, string> = {}
	for (const l of brain.getLearners()) {
		const m = l.getMetrics()
		externalDismissalRates[l.id] = `${(m.ingestion.dismissalRate * 100).toFixed(0)}%`
	}

	console.log(`\n  === KPI Summary ===`)
	console.log(`  Injection:`)
	console.log(`    External synthesis count: ${externalSynthEvents.length}`)
	console.log(`    Internal synthesis per learner: ${JSON.stringify(internalSynthCounts)}`)
	console.log(`    External dismissal rates: ${JSON.stringify(externalDismissalRates)}`)
	console.log(`  Queries:`)
	console.log(`    Total: ${ANSWERABLE_QUESTIONS.length + UNANSWERABLE_QUESTIONS.length}, Answerable: ${ANSWERABLE_QUESTIONS.length}, Unanswerable: ${UNANSWERABLE_QUESTIONS.length}`)
	console.log(`  Signals:`)
	console.log(`    Total: ${signalEvents.length}, System: ${systemSignals.length}`)
	console.log(`  Evolution:`)
	console.log(`    Decisions: ${decisions.length}, Created: ${evoResults.created.length}, Updated: ${evoResults.updated.length}, Deleted: ${evoResults.deleted.length}, Merged: ${evoResults.merged.length}`)
	console.log(`  Re-injection:`)
	console.log(`    Total dismissed: ${preDismissedCount}, Resolved: ${resolvedCount}, Still pending: ${postDismissed.filter(d => d.status === 'pending').length}, Retried: ${retriedCount}`)
	console.log(`  Timing:`)
	console.log(`    Total elapsed: ${(totalElapsed / 1000).toFixed(1)}s, Total events: ${events.length}`)

	await brain.dispose()
	logger.logSuccess(`Eval complete in ${(totalElapsed / 1000).toFixed(1)}s — ${events.length} total events`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
