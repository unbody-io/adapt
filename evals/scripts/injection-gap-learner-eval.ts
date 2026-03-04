/**
 * Focused Eval: Injection Gap Learner
 *
 * Scenario: Digital twin of a developer. Brain starts with 1 external learner
 * (software development). The person's life data spans 10+ domains — only dev
 * stuff matches the learner, everything else gets dismissed.
 *
 * Tests the full flow:
 * 1. Init Brain with 1 narrow external learner
 * 2. Inject mixed daily life data → dev data accepted, everything else dismissed
 * 3. Gap learner detects dismissed domains, synthesizes with decay governance
 * 4. Evaluator creates new learner(s) for uncovered domains
 * 5. Re-injection: dismissed batches get retried on new learners
 *
 * Internal learner thresholds: maxObservations=3, minImportance=0.1
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Brain } from '../../src/brain/class'
import { INTERNAL_LEARNER_IDS } from '../../src/brain/internal-learners'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// ━━━ Setup ━━━

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

const events: Array<{ type: string; payload?: unknown; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ━━━ Load dataset ━━━

interface DataEvent {
	id: string
	timestamp: string
	domain: string
	content: string
}

const datasetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'datasets')
const raw = JSON.parse(readFileSync(join(datasetsDir, 'digital-twin-daily.json'), 'utf-8'))
const allEvents = raw.events as DataEvent[]

// Group events by domain
const byDomain = new Map<string, DataEvent[]>()
for (const evt of allEvents) {
	const list = byDomain.get(evt.domain) ?? []
	list.push(evt)
	byDomain.set(evt.domain, list)
}

console.log(`Loaded ${allEvents.length} events across ${byDomain.size} domains:`)
for (const [domain, evts] of byDomain) {
	console.log(`  ${domain}: ${evts.length} items`)
}

// ━━━ Main ━━━

async function main() {
	console.log('\n=== Focused Eval: Injection Gap Learner ===\n')

	// ━━━ PHASE 1: INIT ━━━
	logger.logSection('PHASE 1: Init Brain — digital twin with 1 narrow learner')

	const brain = new Brain({
		prompt: 'You are a digital twin of a software developer. You will receive data from all aspects of their life — work, health, hobbies, relationships, travel, everything. Your job is to learn and remember everything about this person. Start with what you know (software development) and expand as new domains appear.',
		model,
		store: new MemoryBrainStore(),
		autoSetup: false,
		learners: [
			{
				id: 'dev-learner',
				name: 'Developer Knowledge',
				description: 'Tracks software development philosophy, coding patterns, and technical decisions',
				type: 'text',
				instructions:
					'Track knowledge about this developer: their coding philosophy, architecture preferences, tooling choices, debugging approaches, team practices, and technical opinions. Focus on patterns in how they think about software.',
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
			globalUnderstanding: false,
			globalQueryUnderstanding: false,
			injectionGaps: true,
			queryGaps: false,
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 1,
			autoEvaluate: true,
		},
	})

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload, time: Date.now() - startTime })
		const key = [
			'learner:observed',
			'learner:observe:dismissed',
			'learner:synthesized',
			'learner:synthesize:started',
			'evaluator:evaluation:started',
			'evaluator:evaluation:completed',
			'evaluator:evaluation:failed',
			'evolution:action:executed',
			'brain:learner:added',
			'brain:signal:received',
		]
		if (key.includes(event.type)) {
			const p = event.payload as Record<string, unknown>
			if (event.type === 'evaluator:evaluation:completed') {
				const decisions = p?.decisions as Array<Record<string, unknown>> | undefined
				console.log(`  [${elapsed()}s] ${event.type} — ${decisions?.length ?? 0} decisions`)
				if (decisions) {
					for (const d of decisions) {
						console.log(`    action=${d.action}, targets=${JSON.stringify(d.targets)}`)
						console.log(`    reasoning: ${String(d.reasoning).slice(0, 200)}`)
						console.log(`    guidance: ${String(d.guidance).slice(0, 200)}`)
					}
				}
			} else if (event.type === 'evaluator:evaluation:failed') {
				console.log(`  [${elapsed()}s] ${event.type} — ERROR: ${p?.error}`)
			} else if (event.type === 'brain:signal:received') {
				console.log(`  [${elapsed()}s] ${event.type} — source=${p?.source}, bypass=${p?.bypass}`)
			} else if (event.type === 'brain:learner:added') {
				console.log(`  [${elapsed()}s] ${event.type} — id=${p?.id}, name=${p?.name}`)
			} else {
				console.log(`  [${elapsed()}s] ${event.type} — ${p?.learnerId ?? ''}`)
			}
		}
	})

	await brain.initialize()

	const gapLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.injectionGaps)
	if (!gapLearner) {
		logger.logError('Injection gap learner NOT FOUND — aborting')
		process.exit(1)
	}

	console.log(`  External learners: ${brain.getLearners().length}`)
	console.log(`  Internal learners: ${brain.internalLearners.size}`)
	console.log(`  Gap learner ID: ${gapLearner.id}`)

	// ━━━ PHASE 2: INJECT DEV DATA (relevant — should be accepted) ━━━
	logger.logSection('PHASE 2: Inject dev data (should be accepted)')

	const devItems = allEvents.filter((e) => e.domain === 'software-development')
	const nonDevItems = allEvents.filter((e) => e.domain !== 'software-development')

	// Inject dev data in batches of 5
	for (let i = 0; i < devItems.length; i += 5) {
		const batch = devItems.slice(i, i + 5)
		console.log(`\n  --- Dev batch ${Math.floor(i / 5) + 1}: ${batch.length} items ---`)
		await brain.inject(batch.map((e) => e.content))
	}

	const gapAfterDev = await gapLearner.getBufferState()
	console.log(`\n  Gap buffer after dev injection: ${gapAfterDev.count} pending`)
	logger.logAssertion('No gaps from dev data', gapAfterDev.count === 0)

	// ━━━ PHASE 3: INJECT NON-DEV DATA (irrelevant — should be dismissed) ━━━
	logger.logSection('PHASE 3: Inject non-dev data by domain (should be dismissed)')

	// Group non-dev items by domain, inject each domain as a separate batch
	const nonDevByDomain = new Map<string, DataEvent[]>()
	for (const evt of nonDevItems) {
		const list = nonDevByDomain.get(evt.domain) ?? []
		list.push(evt)
		nonDevByDomain.set(evt.domain, list)
	}

	let totalDismissed = 0
	let totalAccepted = 0
	let batchNum = 0

	for (const [domain, domainEvents] of nonDevByDomain) {
		// Inject each domain's items in small batches (2-3 items)
		for (let i = 0; i < domainEvents.length; i += 2) {
			const batch = domainEvents.slice(i, i + 2)
			batchNum++
			console.log(`\n  --- Batch ${batchNum}: ${domain} (${batch.length} items) ---`)

			const result = await brain.inject(batch.map((e) => e.content))

			for (const b of result.batches) {
				for (const lr of b.results) {
					const isDismissed = lr.result.status === 'observe:dismissed'
					if (isDismissed) totalDismissed++
					else totalAccepted++
					console.log(`    ${lr.learnerId}: ${lr.result.status}`)
				}
			}

			const bufState = await gapLearner.getBufferState()
			const gapMetrics = gapLearner.getMetrics()
			console.log(`  [gap] buffer=${bufState.count}, observations=${gapMetrics.ingestion.observationCount}, syntheses=${gapMetrics.ingestion.synthesisCount}`)
		}
	}

	console.log(`\n  Non-dev batches: ${batchNum}`)
	console.log(`  Dismissed: ${totalDismissed}, Accepted: ${totalAccepted}`)

	// Wait for async evaluator + evolution
	console.log('\n  Waiting 25s for evaluator + evolution to complete...')
	await new Promise((r) => setTimeout(r, 25000))

	// ━━━ PHASE 3: VERIFY ━━━
	logger.logSection('PHASE 3: Verify gap learner state')

	const understanding = await gapLearner.getUnderstanding()
	const hasKnowledge = await gapLearner.hasKnowledge()
	const metrics = gapLearner.getMetrics()
	const finalBuffer = await gapLearner.getBufferState()

	console.log(`  Has knowledge: ${hasKnowledge}`)
	console.log(`  Understanding length: ${typeof understanding === 'string' ? understanding.length : 0} chars`)
	console.log(`  Buffer: ${finalBuffer.count} pending`)
	console.log(`  Observe count: ${metrics.ingestion.observationCount}`)
	console.log(`  Synthesis count: ${metrics.ingestion.synthesisCount}`)
	console.log(`  Dismissal rate: ${(metrics.ingestion.dismissalRate * 100).toFixed(0)}%`)

	if (typeof understanding === 'string' && understanding.length > 0) {
		console.log(`\n  ═══ GAP LEARNER UNDERSTANDING ═══`)
		console.log(`  ${understanding.replace(/\n/g, '\n  ')}`)
		console.log(`  ═══ END ═══`)
	}

	// Dismissed batch buffer
	const dismissedBatches = await brain.store.dismissedBatches.list()
	console.log(`\n  Dismissed batch buffer: ${dismissedBatches.length} entries`)
	for (const db of dismissedBatches.slice(0, 5)) {
		console.log(`    - ${db.id}: gaps=${JSON.stringify(db.gaps).slice(0, 150)}`)
	}
	if (dismissedBatches.length > 5) {
		console.log(`    ... and ${dismissedBatches.length - 5} more`)
	}

	// ━━━ PHASE 4: VERIFY EVOLUTION ━━━
	logger.logSection('PHASE 4: Verify evolution — new learners created')

	const externalLearners = brain.getLearners()
	console.log(`  External learners after evolution: ${externalLearners.length}`)
	for (const l of externalLearners) {
		console.log(`    - ${l.id}: ${l.name}`)
		console.log(`      instructions: ${l.instructions.slice(0, 120)}...`)
	}

	// ━━━ CHECKS ━━━
	logger.logSection('Checks')

	// Check 1: Some data was accepted by dev learner
	const acceptEvents = events.filter(
		(e) => e.type === 'learner:observed' && (e.payload as Record<string, unknown>)?.learnerId === 'dev-learner',
	)
	logger.logAssertion(
		'Dev learner accepted some data',
		acceptEvents.length >= 1,
		`accepted=${acceptEvents.length}`,
	)

	// Check 2: Dev learner dismissed non-dev data
	const devDismissEvents = events.filter(
		(e) => e.type === 'learner:observe:dismissed' && (e.payload as Record<string, unknown>)?.learnerId === 'dev-learner',
	)
	logger.logAssertion(
		'Dev learner dismissed non-dev batches',
		devDismissEvents.length >= batchNum * 0.7,
		`dismissed=${devDismissEvents.length} of ${batchNum} batches`,
	)

	// Check 3: Gap learner received observations
	const gapObserveEvents = events.filter(
		(e) => e.type === 'learner:observed' && (e.payload as Record<string, unknown>)?.learnerId === gapLearner.id,
	)
	logger.logAssertion(
		'Gap learner observed gap data',
		gapObserveEvents.length >= 1,
		`observed=${gapObserveEvents.length}`,
	)

	// Check 4: Gap learner synthesized
	logger.logAssertion(
		'Gap learner synthesized and has knowledge',
		hasKnowledge,
		`hasKnowledge=${hasKnowledge}, synthesisCount=${metrics.ingestion.synthesisCount}`,
	)

	// Check 5: Multiple synthesis cycles
	logger.logAssertion(
		'Gap learner synthesized multiple times',
		metrics.ingestion.synthesisCount >= 2,
		`synthesisCount=${metrics.ingestion.synthesisCount}`,
	)

	// Check 6: Buffer empty after synthesis
	logger.logAssertion(
		'Buffer empty after synthesis',
		finalBuffer.count === 0,
		`pending=${finalBuffer.count}`,
	)

	// Check 7: Dismissed batch buffer populated
	logger.logAssertion(
		'Dismissed batch buffer has entries',
		dismissedBatches.length >= 3,
		`count=${dismissedBatches.length}`,
	)

	// Check 8: Evaluator ran
	const evalStarted = events.filter((e) => e.type === 'evaluator:evaluation:started')
	const evalCompleted = events.filter((e) => e.type === 'evaluator:evaluation:completed')
	const evalFailed = events.filter((e) => e.type === 'evaluator:evaluation:failed')
	logger.logAssertion(
		'Evaluator was triggered',
		evalStarted.length >= 1,
		`started=${evalStarted.length}, completed=${evalCompleted.length}, failed=${evalFailed.length}`,
	)

	// Check 9: New learners created
	logger.logAssertion(
		'Evolution created new learner(s)',
		externalLearners.length > 1,
		`learners=${externalLearners.length}`,
	)

	// Check 10: Gap understanding mentions diverse domains
	if (typeof understanding === 'string') {
		const domainKeywords = [
			{ name: 'therapy/health', pattern: /therap|psycholog|mental|sleep|boundar/i },
			{ name: 'cooking/food', pattern: /cook|recipe|food|ramen|curry|pasta|kitchen/i },
			{ name: 'fitness', pattern: /run|fitness|exercise|yoga|marathon|training/i },
			{ name: 'relationships', pattern: /relationship|partner|sarah|dog|luna|family/i },
			{ name: 'finance', pattern: /financ|invest|portfolio|tax|stock|money/i },
			{ name: 'travel', pattern: /travel|lisbon|trip|vacation|flight/i },
			{ name: 'music', pattern: /music|piano|jazz|einaudi|debussy/i },
			{ name: 'reading', pattern: /read|book|novel|fiction/i },
			{ name: 'home', pattern: /home|house|apartment|faucet|office/i },
		]
		const detected = domainKeywords.filter((d) => d.pattern.test(understanding))
		console.log(`\n  Domains mentioned in gap understanding: ${detected.map((d) => d.name).join(', ')}`)
		logger.logAssertion(
			'Gap understanding covers multiple life domains',
			detected.length >= 3,
			`detected ${detected.length}/9 domains: ${detected.map((d) => d.name).join(', ')}`,
		)
	}

	// Event summary
	logger.logSection('Event Summary')
	const eventCounts: Record<string, number> = {}
	for (const e of events) eventCounts[e.type] = (eventCounts[e.type] || 0) + 1
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`  ${type}: ${count}`)
	}

	await brain.dispose()
	logger.logSuccess(`Eval complete in ${elapsed()}s — ${events.length} total events`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
