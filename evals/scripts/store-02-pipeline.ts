/**
 * Eval: Store ↔ Pipeline Integration
 *
 * Verifies that the learn() pipeline correctly uses the store:
 * 1. Observations land in store.observations with metadata_status 'pending'
 * 2. After understand, observations are marked 'processed' (NOT deleted)
 * 3. Understanding is written to store.understanding
 * 4. Evolution records are stored in store.evolution
 *
 * Creates learners directly (no Brain) with an injected MemoryStore.
 */

import { TextLearner } from '../../src/learners/text-learner/class'
import { ListLearner } from '../../src/learners/list-learner/class'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertEventEmitted,
	assertDefined,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

async function main() {
	// ── TEXT LEARNER ──────────────────────────────────────────────────────────

	logger.logSection('Text Learner: Store-Pipeline Integration')

	const events: Array<{ type: string; payload?: any }> = []
	const textStore = new MemoryStore()

	const textLearner = new TextLearner({
		id: 'text-store-test',
		name: 'Text Store Test',
		model,
		instructions: 'Track programming language features and paradigms.',
		store: textStore,
		governance: { strategy: 'continuous' as const },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 3,
			},
		},
	})

	await textLearner.init()

	textLearner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// ── Phase 1: First observation — should stay pending ──────────────────

	logger.logSection('Text: Phase 1 — First observation (below threshold)')

	await textLearner.learn([
		'Rust uses ownership and borrowing to guarantee memory safety without a garbage collector.',
	])

	const textObs1 = await textStore.observations.list()
	const textPending1 = await textStore.observations.list({ metadata_status: 'pending' })
	const textProcessed1 = await textStore.observations.list({ metadata_status: 'processed' })

	logger.logState('After first learn', {
		totalObs: textObs1.length,
		pending: textPending1.length,
		processed: textProcessed1.length,
	})

	assertGreaterThan(textObs1.length, 0, 'Text: observation stored after first learn')
	assertEqual(textProcessed1.length, 0, 'Text: no processed observations yet')
	assertEqual(textPending1.length, textObs1.length, 'Text: all observations are pending')

	// Check metadata fields on each observation
	for (const obs of textPending1) {
		assertEqual(obs.metadata_status, 'pending', 'Text: status is pending')
		assertDefined(obs.metadata_importance, 'Text: has metadata_importance')
		assertDefined(obs.metadata_created_at, 'Text: has metadata_created_at')
	}

	// Understanding should NOT be in store yet
	assertEqual(
		(await textStore.understanding.list()).length,
		0,
		'Text: no understanding before threshold',
	)

	// ── Phase 2: Second observation — still below threshold ───────────────

	logger.logSection('Text: Phase 2 — Second observation (still below threshold)')

	await textLearner.learn([
		'Go uses goroutines and channels for concurrent programming, making it easy to write parallel code.',
	])

	const textPending2 = await textStore.observations.list({ metadata_status: 'pending' })

	assertGreaterThan(textPending2.length, textPending1.length, 'Text: pending count grew')
	assertEqual(
		(await textStore.observations.list({ metadata_status: 'processed' })).length,
		0,
		'Text: still no processed observations',
	)

	// ── Phase 3: Third observation — should trigger understand ────────────

	logger.logSection('Text: Phase 3 — Third observation (triggers understand)')

	await textLearner.learn([
		'TypeScript adds static typing to JavaScript, catching type errors at compile time rather than runtime.',
	])

	const textAllObs = await textStore.observations.list()
	const textPending3 = await textStore.observations.list({ metadata_status: 'pending' })
	const textProcessed3 = await textStore.observations.list({ metadata_status: 'processed' })

	logger.logState('After third learn (understand triggered)', {
		totalObs: textAllObs.length,
		pending: textPending3.length,
		processed: textProcessed3.length,
	})

	// Observations NOT deleted, just marked processed
	assertGreaterThan(textAllObs.length, 0, 'Text: observations NOT deleted after understand')
	assertGreaterThan(textProcessed3.length, 0, 'Text: some observations marked processed')

	// Understanding written to store
	const textCurrentUnderstanding = await textStore.understanding.get('current')
	assertDefined(textCurrentUnderstanding, 'Text: understanding record with id "current"')
	assertTrue(
		typeof textCurrentUnderstanding!.data === 'string' &&
			textCurrentUnderstanding!.data.length > 0,
		'Text: understanding data is non-empty string',
	)
	assertDefined(
		textCurrentUnderstanding!.metadata_updated_at,
		'Text: understanding has metadata_updated_at',
	)

	// Cache matches store
	assertEqual(
		textLearner.getUnderstanding(),
		textCurrentUnderstanding!.data as string,
		'Text: cached understanding matches store',
	)

	// Evolution recorded
	const textEvolution = await textStore.evolution.list()
	assertGreaterThan(textEvolution.length, 0, 'Text: evolution record stored')
	assertDefined(textEvolution[0].significance, 'Text: evolution has significance')
	assertDefined(textEvolution[0].createdAt, 'Text: evolution has createdAt')

	// Events
	assertEventEmitted(events, 'learner:observe:started')
	assertEventEmitted(events, 'learner:synthesize:started')
	assertEventEmitted(events, 'learner:synthesized')
	assertEventEmitted(events, 'learner:understanding:set')

	// ── LIST LEARNER ─────────────────────────────────────────────────────────

	logger.logSection('List Learner: Store-Pipeline Integration')

	const listEvents: Array<{ type: string; payload?: any }> = []
	const listStore = new MemoryStore()

	const listLearner = new ListLearner({
		id: 'list-store-test',
		name: 'List Store Test',
		model,
		instructions: 'Track popular frontend frameworks and their key features.',
		store: listStore,
		governance: { maxItems: 20, dedup: true },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 2,
			},
		},
	})

	await listLearner.init()

	listLearner.on((event) => {
		listEvents.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// ── Phase 1: First observation ────────────────────────────────────────

	logger.logSection('List: Phase 1 — First observation')

	await listLearner.learn([
		'React 19 introduces server components and actions, enabling hybrid client-server rendering.',
	])

	assertGreaterThan(
		(await listStore.observations.list({ metadata_status: 'pending' })).length,
		0,
		'List: observation stored as pending',
	)

	// ── Phase 2: Second observation (triggers understand) ─────────────────

	logger.logSection('List: Phase 2 — Second observation (triggers understand)')

	await listLearner.learn([
		'Vue 3 uses the Composition API with reactive refs and computed values for state management.',
	])

	const listAllObs = await listStore.observations.list()
	const listProcessed = await listStore.observations.list({ metadata_status: 'processed' })

	logger.logState('After list understand', {
		totalObs: listAllObs.length,
		processed: listProcessed.length,
	})

	assertGreaterThan(listAllObs.length, 0, 'List: observations NOT deleted after understand')
	assertGreaterThan(listProcessed.length, 0, 'List: observations marked processed')

	// Understanding in store — list learner stores multiple records
	const listUnderstanding = await listStore.understanding.list()
	assertGreaterThan(listUnderstanding.length, 0, 'List: understanding records in store')

	for (const rec of listUnderstanding) {
		assertDefined(rec.data, 'List: understanding record has data')
		assertDefined(rec.metadata_confidence, 'List: understanding record has confidence')
	}

	// Cache matches store
	assertEqual(
		listLearner.getUnderstanding().length,
		listUnderstanding.length,
		'List: cached item count matches store',
	)

	// Evolution recorded
	assertGreaterThan(
		(await listStore.evolution.list()).length,
		0,
		'List: evolution record stored',
	)

	// Events
	assertEventEmitted(listEvents, 'learner:observe:started')
	assertEventEmitted(listEvents, 'learner:synthesized')
	assertEventEmitted(listEvents, 'learner:understanding:set')

	// ── RESTORE FROM STORE ───────────────────────────────────────────────────

	logger.logSection('Restore: New learner restores understanding from existing store')

	const savedUnderstanding = textLearner.getUnderstanding()

	const textLearner2 = new TextLearner({
		id: 'text-restore-test',
		name: 'Text Restore Test',
		model,
		instructions: 'Track programming language features and paradigms.',
		store: textStore, // Same store
		governance: { strategy: 'continuous' as const },
		understand: { thresholds: { minImportance: 0.1, maxObservations: 10 } },
	})

	await textLearner2.init()

	const restored = textLearner2.getUnderstanding()
	assertTrue(restored.length > 0, 'Restored: has understanding from store')
	assertEqual(restored, savedUnderstanding, 'Restored: matches original')

	// ── DONE ─────────────────────────────────────────────────────────────────

	logger.logSection('Summary')
	logger.logSuccess('All store-pipeline integration assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
