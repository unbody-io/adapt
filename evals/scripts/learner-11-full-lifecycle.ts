/**
 * Eval: Learner Full Lifecycle
 *
 * Comprehensive eval exercising the complete learner lifecycle:
 *   init → update → learn → query
 * at various lifecycle points, against both MemoryStore and SQLiteStore.
 *
 * NO assertions — raw state dumps at every step for LLM review.
 *
 * Phases:
 *   1. Init completeness — verify all state keys, getters, defaults
 *   2. Update scenarios — config-only vs LLM-regen, each type of update
 *       2a config-only (name, description)
 *       2b threshold update (no regen)
 *       2c instructions update (full regen)
 *       2d focus update (observe-only regen)
 *       2e governance update (no regen)
 *       2f no-op update (same values → empty changedFields)
 *       2g multi-field update (instructions + thresholds + governance at once)
 *       2h blueprint model update (observer.blueprintModel → observe regen)
 *   3. Lifecycle timing — update at every lifecycle point
 *   4. Restore from store — new learner from existing store
 */

import { TextLearner } from '../../src/learners/text-learner/class'
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectEvents(learner: TextLearner) {
	const events: Array<{ type: string; payload?: unknown }> = []
	learner.on((event: { type: string; payload?: unknown }) => {
		events.push({ type: event.type, payload: event.payload })
	})
	return events
}

function eventsSince(events: Array<{ type: string; payload?: unknown }>, marker: number) {
	return events.slice(marker)
}

async function dumpStoreState(store: Store, label: string) {
	const stateRecords = await store.state.list()
	const observations = await store.observations.list()
	const understanding = await store.understanding.list()

	logger.logState(label, {
		state: {
			count: stateRecords.length,
			keys: stateRecords.map((s) => s.id),
			values: Object.fromEntries(
				stateRecords.map((s) => [
					s.id,
					typeof s.value === 'string' ? s.value.slice(0, 150) : s.value,
				]),
			),
		},
		observations: {
			total: observations.length,
			pending: observations.filter((o) => o.metadata_status === 'pending').length,
			processed: observations.filter((o) => o.metadata_status === 'processed').length,
		},
		understanding: {
			count: understanding.length,
			preview: understanding.map((u) =>
				typeof u.data === 'string' ? u.data.slice(0, 150) : u.data,
			),
		},
	})
}

function dumpLearnerGetters(learner: TextLearner, label: string) {
	logger.logState(label, {
		isInitialized: learner.isInitialized(),
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions.slice(0, 100),
		focus: learner.focus,
		observePrompt: learner.getObserveSystemPrompt()?.slice(0, 200) ?? null,
		understandPrompt: learner.getUnderstandSystemPrompt()?.slice(0, 200) ?? null,
		observationSchema: learner.getObservationSchema(),
		understandingSchema: learner.getUnderstandingSchema(),
		health: learner.getHealth(),
		metrics: learner.getMetrics(),
		thresholds: learner.getUnderstandThresholds(),
		governance: learner.getGovernance(),
	})
}

function logEvents(events: Array<{ type: string; payload?: unknown }>, label: string) {
	logger.logState(label, {
		count: events.length,
		types: events.map((e) => e.type),
	})
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

async function runLifecycle(adapterName: string, createStore: CreateStore) {
	logger.logSection(`═══ ${adapterName} ═══`)

	const store = createStore()

	const learner = new TextLearner({
		id: 'lifecycle-test',
		name: 'Lifecycle Test Learner',
		description: 'Tests the full init/update/learn/query cycle',
		model,
		instructions: 'Track programming language features, paradigms, and best practices.',
		store,
		governance: { strategy: 'continuous' as const },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 3,
			},
		},
	})

	const events = collectEvents(learner)

	// ═══════════════════════════════════════════════════════════════════════════
	// Phase 1: Init Completeness
	// ═══════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 1: Init Completeness')

	logger.logState('Before init', { isInitialized: learner.isInitialized() })

	await learner.init()

	dumpLearnerGetters(learner, 'After init — all getters')
	await dumpStoreState(store, 'After init — store state')
	logEvents(events, 'Init events')

	// ═══════════════════════════════════════════════════════════════════════════
	// Phase 2: Update Scenarios
	// ═══════════════════════════════════════════════════════════════════════════

	// ── 2a: Config-only (name, description) ──

	logger.logSection('Phase 2a: Config-only update (name, description)')

	let marker = events.length
	const promptsBefore2a = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2a = await learner.update({
		name: 'Renamed Learner',
		description: 'Updated description for testing',
	})

	logger.logState('Update result', { changedFields: result2a.changedFields })
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2a.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2a.understand,
	})
	logger.logState('New name/description', {
		name: learner.name,
		description: learner.description,
	})
	logEvents(eventsSince(events, marker), 'Events from 2a')
	await dumpStoreState(store, 'Store after 2a')

	// ── 2b: Threshold update ──

	logger.logSection('Phase 2b: Threshold update')

	marker = events.length
	const promptsBefore2b = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2b = await learner.update({
		understand: { thresholds: { minImportance: 0.5 } },
	})

	logger.logState('Update result', { changedFields: result2b.changedFields })
	logger.logState('Thresholds after', learner.getUnderstandThresholds())
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2b.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2b.understand,
	})
	logEvents(eventsSince(events, marker), 'Events from 2b')

	// ── 2c: Instructions update (triggers full regen) ──

	logger.logSection('Phase 2c: Instructions update (full regen)')

	marker = events.length
	const promptsBefore2c = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2c = await learner.update({
		instructions: 'Track Italian cooking recipes, traditional techniques, and regional specialties.',
	})

	logger.logState('Update result', { changedFields: result2c.changedFields })
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2c.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2c.understand,
	})
	logger.logState('New observe prompt (preview)', {
		prompt: learner.getObserveSystemPrompt()?.slice(0, 300),
	})
	logger.logState('New understand prompt (preview)', {
		prompt: learner.getUnderstandSystemPrompt()?.slice(0, 300),
	})
	logEvents(eventsSince(events, marker), 'Events from 2c')
	await dumpStoreState(store, 'Store after 2c')

	// ── 2d: Focus update (observe-only regen) ──

	logger.logSection('Phase 2d: Focus update (observe-only regen)')

	marker = events.length
	const promptsBefore2d = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2d = await learner.update({
		focus: 'Neapolitan pizza and pasta traditions',
	})

	logger.logState('Update result', { changedFields: result2d.changedFields })
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2d.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2d.understand,
	})
	logger.logState('New observe prompt (preview)', {
		prompt: learner.getObserveSystemPrompt()?.slice(0, 300),
	})
	logEvents(eventsSince(events, marker), 'Events from 2d')

	// ── 2e: Governance update (no regen) ──

	logger.logSection('Phase 2e: Governance update')

	marker = events.length
	const promptsBefore2e = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2e = await learner.update({
		governance: { strategy: 'cumulative' as const },
	})

	logger.logState('Update result', { changedFields: result2e.changedFields })
	logger.logState('Governance after', learner.getGovernance())
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2e.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2e.understand,
	})
	logEvents(eventsSince(events, marker), 'Events from 2e')

	// ── 2f: No-op update (same values → empty changedFields) ──

	logger.logSection('Phase 2f: No-op update (same values)')

	marker = events.length
	const promptsBefore2f = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2f = await learner.update({
		name: learner.name,
		description: learner.description,
	})

	logger.logState('Update result', { changedFields: result2f.changedFields })
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2f.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2f.understand,
	})
	logEvents(eventsSince(events, marker), 'Events from 2f (expect 0 — no changes)')

	// ── 2g: Multi-field update (instructions + thresholds + governance at once) ──

	logger.logSection('Phase 2g: Multi-field update (instructions + thresholds + governance)')

	marker = events.length
	const before2g = {
		instructions: learner.instructions,
		thresholds: { ...learner.getUnderstandThresholds() },
		governance: { ...learner.getGovernance() },
		observePrompt: learner.getObserveSystemPrompt(),
		understandPrompt: learner.getUnderstandSystemPrompt(),
	}

	logger.logState('Before 2g', before2g)

	const result2g = await learner.update({
		instructions: 'Track jazz music theory, chord voicings, and modal interchange.',
		understand: { thresholds: { minImportance: 0.3, maxObservations: 5 } },
		governance: { strategy: 'continuous' as const },
	})

	logger.logState('Update result', { changedFields: result2g.changedFields })
	logger.logState('After 2g', {
		instructions: learner.instructions,
		thresholds: learner.getUnderstandThresholds(),
		governance: learner.getGovernance(),
	})
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== before2g.observePrompt,
		understandChanged: learner.getUnderstandSystemPrompt() !== before2g.understandPrompt,
	})
	logger.logState('New observe prompt (preview)', {
		prompt: learner.getObserveSystemPrompt()?.slice(0, 300),
	})
	logger.logState('New understand prompt (preview)', {
		prompt: learner.getUnderstandSystemPrompt()?.slice(0, 300),
	})
	logEvents(eventsSince(events, marker), 'Events from 2g')
	await dumpStoreState(store, 'Store after 2g')

	// ── 2h: Blueprint model update (observer.blueprintModel → observe regen) ──

	logger.logSection('Phase 2h: Blueprint model update (observer.blueprintModel)')

	marker = events.length
	const ALT_MODEL = process.env.ALT_MODEL ?? 'google/gemini-2.0-flash-001'
	const altModel = openrouter(ALT_MODEL)
	const promptsBefore2h = {
		observe: learner.getObserveSystemPrompt(),
		understand: learner.getUnderstandSystemPrompt(),
	}

	const result2h = await learner.update({
		observer: { blueprintModel: altModel },
	})

	logger.logState('Update result', { changedFields: result2h.changedFields })
	logger.logState('Prompts changed?', {
		observeChanged: learner.getObserveSystemPrompt() !== promptsBefore2h.observe,
		understandChanged: learner.getUnderstandSystemPrompt() !== promptsBefore2h.understand,
	})
	logger.logState('New observe prompt (preview — should reflect regen with new blueprint)', {
		prompt: learner.getObserveSystemPrompt()?.slice(0, 300),
	})
	logEvents(eventsSince(events, marker), 'Events from 2h')

	// ═══════════════════════════════════════════════════════════════════════════
	// Phase 3: Lifecycle Timing
	// ═══════════════════════════════════════════════════════════════════════════

	// Fresh learner for lifecycle timing — clean state
	const store3 = createStore()
	const learner3 = new TextLearner({
		id: 'lifecycle-timing',
		name: 'Lifecycle Timing Learner',
		model,
		instructions: 'Track TypeScript design patterns and best practices.',
		store: store3,
		governance: { strategy: 'continuous' as const },
		understand: {
			thresholds: {
				minImportance: 0.1,
				maxObservations: 2,
			},
		},
	})

	const events3 = collectEvents(learner3)
	await learner3.init()

	// ── 3a: Update after init, before learn ──

	logger.logSection('Phase 3a: Update after init, before learn')

	marker = events3.length

	await learner3.update({
		instructions: 'Track cooking techniques and ingredient pairings for Mediterranean cuisine.',
	})

	logger.logState('Instructions changed to cooking', {
		instructions: learner3.instructions,
		observePrompt: learner3.getObserveSystemPrompt()?.slice(0, 200),
	})

	const learn3a = await learner3.learn([
		'Risotto alla Milanese uses saffron, carnaroli rice, and parmesan with cold butter mantecatura.',
	])

	logger.logState('Learn cooking content after instructions change', {
		status: learn3a.status,
		observations: (learn3a as { output?: unknown[] }).output,
		usage: (learn3a as { usage?: unknown }).usage,
	})
	logEvents(eventsSince(events3, marker), 'Events from 3a')

	// ── 3b: Update between learn batches ──

	logger.logSection('Phase 3b: Update between learn batches')

	marker = events3.length

	const learn3b1 = await learner3.learn([
		'Traditional Neapolitan pizza uses tipo 00 flour and San Marzano tomatoes.',
	])

	logger.logState('Batch 1 (cooking domain)', {
		status: learn3b1.status,
		observations: (learn3b1 as { output?: unknown[] }).output,
	})

	// Switch domain mid-stream
	await learner3.update({
		instructions: 'Track jazz music theory, chord progressions, and improvisational techniques.',
	})

	logger.logState('Domain switched to jazz', {
		instructions: learner3.instructions,
		observePrompt: learner3.getObserveSystemPrompt()?.slice(0, 200),
	})

	const learn3b2 = await learner3.learn([
		'The ii-V-I progression in C major is Dm7-G7-Cmaj7, the most common resolution in jazz harmony.',
	])

	logger.logState('Batch 2 (jazz domain, after switch)', {
		status: learn3b2.status,
		observations: (learn3b2 as { output?: unknown[] }).output,
	})

	await dumpStoreState(store3, 'Store after 3b')
	logEvents(eventsSince(events3, marker), 'Events from 3b')

	// ── 3c: Update after understand has triggered ──

	logger.logSection('Phase 3c: Update after understand triggers')

	marker = events3.length

	// Feed enough items to trigger understand (maxObservations = 2, already have some)
	const learn3c1 = await learner3.learn([
		'Bebop jazz uses rapid tempo, complex chord progressions, and virtuosic improvisation over standard forms.',
	])

	logger.logState('Learn to trigger understand', {
		status: learn3c1.status,
	})

	const understanding3c = await learner3.getUnderstanding()
	logger.logState('Understanding after trigger', {
		hasUnderstanding: understanding3c.length > 0,
		preview: understanding3c.slice(0, 300),
	})

	// Now update instructions AFTER understanding exists
	await learner3.update({
		instructions: 'Track modern web development frameworks and their architectural patterns.',
	})

	logger.logState('Instructions changed to web dev (after understanding exists)', {
		instructions: learner3.instructions,
		observePrompt: learner3.getObserveSystemPrompt()?.slice(0, 200),
	})

	const learn3c2 = await learner3.learn([
		'React 19 server components render on the server and stream HTML to the client, reducing bundle size.',
	])

	logger.logState('Learn web dev content after domain switch', {
		status: learn3c2.status,
		observations: (learn3c2 as { output?: unknown[] }).output,
	})

	const understanding3c2 = await learner3.getUnderstanding()
	logger.logState('Understanding after post-switch learn', {
		preview: understanding3c2.slice(0, 300),
	})

	logEvents(eventsSince(events3, marker), 'Events from 3c')

	// ── 3d: Update bracketing query ──

	logger.logSection('Phase 3d: Update before and after query')

	marker = events3.length

	// Query with current domain (web dev)
	const query3d1 = await learner3.query('What frameworks support server-side rendering?')

	logger.logState('Query 1 (web dev domain)', {
		relevant: query3d1.relevant,
		confidence: query3d1.confidence,
		insight: query3d1.insight.slice(0, 200),
	})

	// Switch domain
	await learner3.update({
		instructions: 'Track classical music composition techniques and orchestration.',
	})

	// Query same-ish topic — should be less relevant now
	const query3d2 = await learner3.query('What frameworks support server-side rendering?')

	logger.logState('Query 2 (same question, after switch to classical music)', {
		relevant: query3d2.relevant,
		confidence: query3d2.confidence,
		insight: query3d2.insight.slice(0, 200),
	})

	logger.logState('Query comparison', {
		query1Confidence: query3d1.confidence,
		query2Confidence: query3d2.confidence,
		query1Relevant: query3d1.relevant,
		query2Relevant: query3d2.relevant,
	})

	logEvents(eventsSince(events3, marker), 'Events from 3d')

	// ═══════════════════════════════════════════════════════════════════════════
	// Phase 4: Restore from Store
	// ═══════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 4: Restore from existing store')

	const savedPrompts = {
		observe: learner3.getObserveSystemPrompt(),
		understand: learner3.getUnderstandSystemPrompt(),
	}
	const savedSchemas = {
		observation: learner3.getObservationSchema(),
		understanding: learner3.getUnderstandingSchema(),
	}
	const savedUnderstanding = await learner3.getUnderstanding()

	// New learner instance, same store
	const learner4 = new TextLearner({
		id: 'lifecycle-restored',
		name: 'Restored Learner',
		model,
		instructions: 'This should be overridden by store state.',
		store: store3,
		governance: { strategy: 'continuous' as const },
		understand: { thresholds: { minImportance: 0.1, maxObservations: 10 } },
	})

	const events4 = collectEvents(learner4)
	await learner4.init()

	logger.logState('Restored vs original', {
		promptsMatch: {
			observe: learner4.getObserveSystemPrompt() === savedPrompts.observe,
			understand: learner4.getUnderstandSystemPrompt() === savedPrompts.understand,
		},
		schemasMatch: {
			observation:
				JSON.stringify(learner4.getObservationSchema()) ===
				JSON.stringify(savedSchemas.observation),
			understanding:
				JSON.stringify(learner4.getUnderstandingSchema()) ===
				JSON.stringify(savedSchemas.understanding),
		},
		understandingMatch: (await learner4.getUnderstanding()) === savedUnderstanding,
		restoredUnderstandingPreview: (await learner4.getUnderstanding()).slice(0, 200),
	})

	logEvents(events4, 'Restore events (should have NO LLM generation events)')

	dumpLearnerGetters(learner4, 'Restored learner getters')

	// ── Cleanup ──

	await store.dispose()
	await store3.dispose()

	logger.logSuccess(`${adapterName}: full lifecycle complete`)
}

// ── Entry ────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Learner Full Lifecycle Eval')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	const storeArg = process.env.STORE?.toLowerCase()

	if (!storeArg || storeArg === 'memory') {
		await runLifecycle('MemoryStore', () => new MemoryStore())
	}

	if (!storeArg || storeArg === 'sqlite') {
		await runLifecycle('SQLiteStore', () => new SQLiteStore())
	}

	logger.logSection('Done')
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
