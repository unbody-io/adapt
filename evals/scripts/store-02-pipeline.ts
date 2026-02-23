/**
 * Eval: Store ↔ Pipeline Integration
 *
 * Exercises the full learn() pipeline against both store adapters.
 * Dumps raw state after each phase — no assertions, no judgments.
 *
 * What to look for in output:
 * - Observations land in store with correct metadata fields
 * - After understand triggers, observations marked 'processed' (NOT deleted)
 * - Understanding written to store.understanding
 * - Evolution records stored in store.evolution
 * - Schemas persisted in store.state after init
 * - Restore from existing store recovers understanding + schemas
 *
 * Runs against both MemoryStore and SQLiteStore by default.
 * Use STORE=memory or STORE=sqlite to run a single adapter.
 */

import { TextLearner } from '../../src/learners/text-learner/class'
import { ListLearner } from '../../src/learners/list-learner/class'
import { MemoryStore, SQLiteStore } from '../../src/learners/stores'
import type { Store } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

type CreateStore = () => Store

async function dumpStoreState(store: Store, label: string) {
	const observations = await store.observations.list()
	const pending = await store.observations.list({ metadata_status: 'pending' })
	const processed = await store.observations.list({ metadata_status: 'processed' })
	const understanding = await store.understanding.list()
	const evolution = await store.evolution.list()
	const state = await store.state.list()

	logger.logState(label, {
		observations: {
			total: observations.length,
			pending: pending.length,
			processed: processed.length,
			items: observations.map((o) => ({
				id: o.id,
				data: typeof o.data === 'string' ? o.data.slice(0, 100) : o.data,
				status: o.metadata_status,
				importance: o.metadata_importance,
			})),
		},
		understanding: {
			count: understanding.length,
			items: understanding.map((u) => ({
				id: u.id,
				data: typeof u.data === 'string' ? u.data.slice(0, 150) : u.data,
				confidence: u.metadata_confidence,
			})),
		},
		evolution: {
			count: evolution.length,
			items: evolution.map((e) => ({
				id: e.id,
				significance: e.significance,
				summary: e.summary.slice(0, 100),
			})),
		},
		state: {
			count: state.length,
			keys: state.map((s) => s.id),
		},
	})
}

async function runPipeline(adapterName: string, createStore: CreateStore) {
	logger.logSection(`═══ ${adapterName} ═══`)

	// ── TEXT LEARNER ──────────────────────────────────────────────────────────

	logger.logSection('Text Learner')

	const textStore = createStore()

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
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Schemas after init
	logger.logSection('Text: Schemas after init')
	const textObsSchema = await textStore.state.get('observation_schema')
	const textUndSchema = await textStore.state.get('understanding_schema')
	logger.logState('Text schemas', {
		observation_schema: textObsSchema?.value,
		understanding_schema: textUndSchema?.value,
		getObservationSchema: textLearner.getObservationSchema(),
		getUnderstandingSchema: textLearner.getUnderstandingSchema(),
	})

	// Learn 1
	logger.logSection('Text: Learn 1')
	await textLearner.learn([
		'Rust uses ownership and borrowing to guarantee memory safety without a garbage collector.',
	])
	await dumpStoreState(textStore, 'Text: after learn 1')

	// Learn 2
	logger.logSection('Text: Learn 2')
	await textLearner.learn([
		'Go uses goroutines and channels for concurrent programming, making it easy to write parallel code.',
	])
	await dumpStoreState(textStore, 'Text: after learn 2')

	// Learn 3
	logger.logSection('Text: Learn 3')
	await textLearner.learn([
		'TypeScript adds static typing to JavaScript, catching type errors at compile time rather than runtime.',
	])
	await dumpStoreState(textStore, 'Text: after learn 3')

	// Cache vs store
	logger.logState('Text: cache vs store', {
		cachedUnderstanding: textLearner.getUnderstanding()?.slice(0, 200),
		storeUnderstanding: ((await textStore.understanding.get('current'))?.data as string)?.slice(0, 200),
	})

	// ── LIST LEARNER ─────────────────────────────────────────────────────────

	logger.logSection('List Learner')

	const listStore = createStore()

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
				maxObservations: 10,
			},
		},
	})

	await listLearner.init()

	listLearner.on((event) => {
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Schemas after init
	logger.logSection('List: Schemas after init')
	const listObsSchema = await listStore.state.get('observation_schema')
	const listUndSchema = await listStore.state.get('understanding_schema')
	logger.logState('List schemas', {
		observation_schema: listObsSchema?.value,
		understanding_schema: listUndSchema?.value,
	})

	// Learn 1
	logger.logSection('List: Learn 1')
	await listLearner.learn([
		'React 19 introduces server components and actions, enabling hybrid client-server rendering.',
	])
	await dumpStoreState(listStore, 'List: after learn 1')

	// Learn 2
	logger.logSection('List: Learn 2')
	await listLearner.learn([
		'Vue 3 uses the Composition API with reactive refs and computed values for state management.',
	])
	await dumpStoreState(listStore, 'List: after learn 2')

	// Cache vs store
	const listUnderstanding = await listStore.understanding.list()
	logger.logState('List: cache vs store', {
		cachedItemCount: listLearner.getUnderstanding().length,
		storeItemCount: listUnderstanding.length,
		cachedItems: listLearner.getUnderstanding(),
		storeItems: listUnderstanding.map((u) => ({
			id: u.id,
			data: u.data,
			confidence: u.metadata_confidence,
		})),
	})

	// ── RESTORE FROM STORE ───────────────────────────────────────────────────

	logger.logSection('Restore: New learner from existing store')

	const savedUnderstanding = textLearner.getUnderstanding()

	const textLearner2 = new TextLearner({
		id: 'text-restore-test',
		name: 'Text Restore Test',
		model,
		instructions: 'Track programming language features and paradigms.',
		store: textStore,
		governance: { strategy: 'continuous' as const },
		understand: { thresholds: { minImportance: 0.1, maxObservations: 10 } },
	})

	await textLearner2.init()

	logger.logState('Restore result', {
		originalUnderstanding: savedUnderstanding?.slice(0, 200),
		restoredUnderstanding: textLearner2.getUnderstanding()?.slice(0, 200),
		match: savedUnderstanding === textLearner2.getUnderstanding(),
		restoredObsSchema: textLearner2.getObservationSchema(),
		restoredUndSchema: textLearner2.getUnderstandingSchema(),
	})

	// Cleanup
	await textStore.dispose()
	await listStore.dispose()

	logger.logSuccess(`${adapterName}: pipeline complete`)
}

async function main() {
	console.log(`Store Pipeline Eval`)
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	const storeArg = process.env.STORE?.toLowerCase()

	if (!storeArg || storeArg === 'memory') {
		await runPipeline('MemoryStore', () => new MemoryStore())
	}

	if (!storeArg || storeArg === 'sqlite') {
		await runPipeline('SQLiteStore', () => new SQLiteStore())
	}

	logger.logSection('Done')
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
