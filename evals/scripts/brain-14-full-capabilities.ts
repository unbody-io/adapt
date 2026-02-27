/**
 * Eval: Full Brain Capabilities with Store Backends
 *
 * Tests the complete Brain lifecycle with both MemoryBrainStore and SQLiteBrainStore:
 * 1. Fresh init (descriptor-driven, creates both text + list learners)
 * 2. Inject data → verify learners absorbed it
 * 3. Ask a question → verify synthesis
 * 4. Basic tier management (adjustLearner, removeLearner)
 * 5. Registry persistence verification
 * 6. Persist → restore flow (second Brain instance reuses the store)
 * 7. Dispose
 *
 * Runs the full suite twice: once with MemoryBrainStore, once with SQLiteBrainStore.
 */

import { Brain } from '../../src/brain/class'
import { MemoryBrainStore, SQLiteBrainStore } from '../../src/brain/stores'
import type { BrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertDefined,
	assertEventEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function runSuite(suiteName: string, createBrainStore: () => BrainStore) {
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`  ${suiteName}`)
	console.log('═'.repeat(60))

	const events: Array<{ type: string; payload?: unknown }> = []

	// Learner stores keyed by ID — reused across Brain instances for restore
	const learnerStores = new Map<string, MemoryStore>()

	const brainStore = createBrainStore()

	// ── Phase 1: Fresh Init ─────────────────────────────────────────────────

	logger.logSection('Phase 1: Fresh Init')

	const brain = new Brain({
		prompt: `Track software engineering practices:
- TypeScript type safety patterns
- Tools and frameworks used (as a list/catalog)`,
		model: openrouter(MODEL),
		store: brainStore,
		learning: {
			store: (learnerId: string) => {
				const store = new MemoryStore()
				learnerStores.set(learnerId, store)
				return store
			},
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 10,
			autoEvaluate: false,
		},
	})

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
	})

	await brain.initialize()

	const learners = brain.getLearners()
	assertGreaterThan(learners.length, 0, 'At least 1 learner created')
	assertTrue(learners.length <= 6, `Reasonable learner count (${learners.length})`)

	// Verify descriptors worked — check that types are properly assigned
	for (const learner of learners) {
		assertDefined(learner.id, `Learner has ID`)
		assertDefined(learner.name, `Learner ${learner.id} has name`)
		assertTrue(
			learner.type === 'text' || learner.type === 'list',
			`Learner ${learner.id} has valid type: ${learner.type}`,
		)
	}

	// Verify registry was populated
	const registryCount = await brainStore.registry.count()
	assertEqual(registryCount, learners.length, 'Registry has one entry per learner')

	// Verify brain state was persisted
	const stateCount = await brainStore.state.count()
	assertGreaterThan(stateCount, 0, 'Brain state was persisted')

	logger.logState('Learners created', learners.map((l) => ({
		id: l.id,
		name: l.name,
		type: l.type,
	})))

	// ── Phase 2: Inject Data ────────────────────────────────────────────────

	logger.logSection('Phase 2: Inject Data')

	const injectResult = await brain.inject([
		'We use TypeScript strict mode with no-any rules enforced by ESLint.',
		'Our API layer uses Hono framework for HTTP routing.',
		'PostgreSQL 15 is our primary database, accessed through Drizzle ORM.',
		'We prefer interfaces over type aliases for object shapes.',
	])

	assertDefined(injectResult.id, 'Inject returned an ID')
	assertGreaterThan(injectResult.batches.length, 0, 'At least 1 batch processed')

	assertEventEmitted(events, 'brain:inject:completed')

	// ── Phase 3: Ask a Question ─────────────────────────────────────────────

	logger.logSection('Phase 3: Ask a Question')

	const askResult = await brain.ask('What TypeScript practices does the team follow?')

	assertDefined(askResult.insight, 'Ask returned an insight')
	assertGreaterThan(askResult.insight.length, 20, 'Insight is substantial')
	assertGreaterThan(askResult.sources.length, 0, 'At least 1 source')

	logger.logState('Ask result', {
		insightPreview: askResult.insight.substring(0, 200),
		sourceCount: askResult.sources.length,
	})

	assertEventEmitted(events, 'brain:ask:completed')

	// ── Phase 4: Basic Tier Management ──────────────────────────────────────

	logger.logSection('Phase 4: Basic Tier Management')

	// Pick first learner for adjust test
	const firstLearner = learners[0]
	const beforeInstructions = firstLearner.instructions

	const adjusted = await brain.adjustLearner(
		firstLearner.id,
		'Focus more specifically on type narrowing patterns and discriminated unions.',
	)

	assertEqual(adjusted.id, firstLearner.id, 'adjustLearner returns same learner')
	assertTrue(
		adjusted.instructions !== beforeInstructions,
		'Instructions changed after adjust',
	)

	// Verify registry was updated
	const registryRecord = await brainStore.registry.get(firstLearner.id)
	assertDefined(registryRecord, 'Adjusted learner still in registry')
	assertEqual(
		registryRecord.instructions,
		adjusted.instructions,
		'Registry instructions match adjusted learner',
	)

	// Remove a learner (if there are 2+)
	if (learners.length >= 2) {
		const toRemove = learners[learners.length - 1]
		const removeId = toRemove.id

		await brain.removeLearner(removeId)

		assertTrue(!brain.learners.has(removeId), 'Removed learner gone from Brain map')

		const removedRegistry = await brainStore.registry.get(removeId)
		assertTrue(removedRegistry === undefined, 'Removed learner gone from registry')

		assertEventEmitted(events, 'brain:learner:removed', (p) => p.learnerId === removeId)
	}

	// ── Phase 5: Registry Verification ──────────────────────────────────────

	logger.logSection('Phase 5: Registry Verification')

	const remainingLearners = brain.getLearners()
	const registryList = await brainStore.registry.list()
	assertEqual(
		registryList.length,
		remainingLearners.length,
		'Registry count matches remaining learners',
	)

	for (const learner of remainingLearners) {
		const record = await brainStore.registry.get(learner.id)
		assertDefined(record, `Registry has entry for learner ${learner.id}`)
		assertEqual(record.type, learner.type, `Registry type matches for ${learner.id}`)
		assertEqual(record.instructions, learner.instructions, `Registry instructions match for ${learner.id}`)
	}

	// ── Phase 6: Persist → Restore ──────────────────────────────────────────

	logger.logSection('Phase 6: Persist → Restore')

	// Capture state before "restart"
	const learnerCountBefore = remainingLearners.length
	const learnerIdsBefore = remainingLearners.map((l) => l.id).sort()

	// Create a new Brain instance pointing to the SAME brainStore
	// (simulating restart with persistent storage)
	const brain2 = new Brain({
		prompt: 'will be overwritten by restore',
		model: openrouter(MODEL),
		store: brainStore,
		learning: {
			store: (learnerId: string) => {
				// Reuse existing learner stores (simulating same DB)
				const existing = learnerStores.get(learnerId)
				if (existing) return existing
				const store = new MemoryStore()
				learnerStores.set(learnerId, store)
				return store
			},
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 10,
			autoEvaluate: false,
		},
	})

	await brain2.initialize()

	// Verify restore
	const restoredLearners = brain2.getLearners()
	assertEqual(restoredLearners.length, learnerCountBefore, 'Same number of learners after restore')

	const restoredIds = restoredLearners.map((l) => l.id).sort()
	assertEqual(
		JSON.stringify(restoredIds),
		JSON.stringify(learnerIdsBefore),
		'Same learner IDs after restore',
	)

	// Verify restored prompt
	assertEqual(brain2.prompt, brain.prompt, 'Brain prompt restored correctly')

	// Verify restored learners have the right types
	for (const learner of restoredLearners) {
		assertTrue(
			learner.type === 'text' || learner.type === 'list',
			`Restored learner ${learner.id} has valid type: ${learner.type}`,
		)
	}

	// ── Phase 7: Dispose ────────────────────────────────────────────────────

	logger.logSection('Phase 7: Dispose')

	await brain2.dispose()
	assertEqual(brain2.learners.size, 0, 'All learners cleared after dispose')

	logger.logSuccess(`${suiteName} — all phases passed!`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Brain Full Capabilities Eval\n')

	await runSuite('MemoryBrainStore', () => new MemoryBrainStore())
	await runSuite('SQLiteBrainStore', () => new SQLiteBrainStore())

	logger.logSuccess('All suites passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
