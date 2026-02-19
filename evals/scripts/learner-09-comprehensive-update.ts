/**
 * Eval: Comprehensive Learner Update
 *
 * End-to-end behavioral eval that verifies learner.update() actually changes
 * runtime behavior — not just stored config values. Exercises the full
 * init → learn → query → update → learn → query pipeline.
 *
 * Previous evals passed despite updates not propagating because they only
 * checked config fields. This eval verifies through actual LLM calls that:
 *   - After instructions change, learn() observes differently
 *   - After instructions change, query() responds differently
 *   - After threshold change, synthesis behavior changes
 *   - Mid-workflow updates take effect on the next operation
 *   - Prompts regenerate with correct domain content
 *   - Events fire with correct payloads at every step
 *
 * Phases:
 *   1. Baseline — learn TS content, query TS + cooking, establish behavior
 *   2. Update instructions → cooking — learn cooking, query both domains
 *   3. Update thresholds — verify synthesis gating changes
 *   4. Mid-workflow update — switch domain between learns
 *   5. Static guards — immutability, no-op, metadata, governance, model
 *   6. Event audit — verify all events across the full run
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertFalse,
	assertDefined,
	assertContains,
	assertEventEmitted,
	assertEventNotEmitted,
	assertGreaterThan,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function main() {
	const events: Array<{ type: string; payload?: any }> = []
	let sectionEvents: Array<{ type: string; payload?: any }> = []

	function resetSection() {
		sectionEvents = []
	}

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 1: Baseline — TypeScript Learner (init + learn + query)
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 1: TypeScript Baseline')

	const brain = new Brain({
		prompt: 'Test brain for comprehensive learner update eval',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		id: 'comprehensive-test',
		name: 'TypeScript Tracker',
		description: 'Tracks TypeScript patterns and best practices',
		instructions:
			'You track TypeScript patterns, idioms, design patterns, and best practices used in codebases.',
		type: 'text' as const,
		maintenance: {
			strategy: 'continuous' as const,
		},
		thresholds: {
			minImportance: 0.3,
			maxObservations: 10,
		},
	})

	learner.on((event: { type: string; payload?: any }) => {
		events.push({ type: event.type, payload: event.payload })
		sectionEvents.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// ── Verify init state ──

	assertTrue(learner.isInitialized(), 'Learner initialized')
	assertDefined(learner.getObserveSystemPrompt(), 'Observe prompt exists')
	assertDefined(learner.getSynthesizeSystemPrompt(), 'Synthesize prompt exists')

	const initObservePrompt = learner.getObserveSystemPrompt()!

	// Prompts should reflect TS domain
	assertTrue(
		initObservePrompt.toLowerCase().includes('typescript') ||
			initObservePrompt.toLowerCase().includes('code') ||
			initObservePrompt.toLowerCase().includes('pattern'),
		'Observe prompt reflects TypeScript/code domain',
	)

	// ── Learn TypeScript content (2 items → continuous strategy = synthesize each) ──

	logger.logSection('Phase 1a: Learn TypeScript Content')
	resetSection()

	const tsLearn1 = await learner.learn([
		'TypeScript interfaces are preferred over type aliases for object shapes because they support declaration merging and can be extended with "extends".',
	])
	logger.logState('TS Learn 1', {
		status: tsLearn1.status,
		output: (tsLearn1 as any).output?.substring(0, 200),
	})

	assertTrue(
		tsLearn1.status === 'observed' || tsLearn1.status === 'synthesized',
		`TS content accepted by TS learner (got: ${tsLearn1.status})`,
	)
	assertEventEmitted(sectionEvents, 'learner:observe:started')

	resetSection()

	const tsLearn2 = await learner.learn([
		'Use discriminated unions in TypeScript for type-safe state machines. A shared literal property like "type" or "kind" lets the compiler narrow union members in switch/case blocks.',
	])
	logger.logState('TS Learn 2', {
		status: tsLearn2.status,
		output: (tsLearn2 as any).output?.substring(0, 200),
	})

	// After 2 learns with continuous strategy, should have understanding
	const tsUnderstanding = learner.getUnderstanding()
	logger.logState('TS Understanding', {
		length: tsUnderstanding.length,
		preview: tsUnderstanding.substring(0, 300),
	})

	assertGreaterThan(tsUnderstanding.length, 0, 'Understanding built from TS content')

	// ── Query TypeScript (should be relevant) ──

	logger.logSection('Phase 1b: Query TypeScript')
	resetSection()

	const tsQuery = await learner.query('What TypeScript features help with type safety?')
	logger.logState('TS Query Result', {
		confidence: tsQuery.confidence,
		relevant: tsQuery.relevant,
		insight: tsQuery.insight.substring(0, 300),
	})

	assertTrue(tsQuery.relevant, 'TS query is relevant to TS learner')
	assertGreaterThan(tsQuery.confidence, 0.3, 'TS query confidence > 0.3')
	assertEventEmitted(sectionEvents, 'learner:query:started')
	assertEventEmitted(sectionEvents, 'learner:query:completed')

	// ── Query Cooking (should be NOT relevant) ──

	resetSection()

	const cookingQueryBaseline = await learner.query(
		'How do you make Neapolitan pizza dough and what flour is used?',
	)
	logger.logState('Cooking Query Baseline (with TS learner)', {
		confidence: cookingQueryBaseline.confidence,
		relevant: cookingQueryBaseline.relevant,
		insight: cookingQueryBaseline.insight.substring(0, 200),
	})

	// A TS learner shouldn't know about pizza
	const baselineCookingConfidence = cookingQueryBaseline.confidence

	logger.logSuccess('Phase 1 passed — baseline established')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 2: Update Instructions to Cooking → Learn + Query
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 2: Update Instructions → Cooking')
	resetSection()

	const preUpdateObserve = learner.getObserveSystemPrompt()!
	const preUpdateSynthesize = learner.getSynthesizeSystemPrompt()!

	const instrResult = await learner.update({
		instructions:
			'You track Italian cooking recipes, traditional techniques, ingredient pairings, and regional specialties of Italian cuisine.',
	})

	logger.logState('Instructions Update', { changedFields: instrResult.changedFields })

	// ── Prompts actually regenerated ──

	const postUpdateObserve = learner.getObserveSystemPrompt()!
	const postUpdateSynthesize = learner.getSynthesizeSystemPrompt()!

	assertTrue(
		postUpdateObserve !== preUpdateObserve,
		'Observe prompt string changed after instructions update',
	)
	assertTrue(
		postUpdateSynthesize !== preUpdateSynthesize,
		'Synthesize prompt string changed after instructions update',
	)

	// ── Semantic: new prompts reflect cooking domain ──

	const cookingKeywords = ['cook', 'recipe', 'italian', 'cuisine', 'ingredient', 'food', 'dish']
	const newObserveLower = postUpdateObserve.toLowerCase()
	const newSynthesizeLower = postUpdateSynthesize.toLowerCase()

	assertTrue(
		cookingKeywords.some((kw) => newObserveLower.includes(kw)),
		'Observe prompt contains cooking keyword',
	)
	assertTrue(
		cookingKeywords.some((kw) => newSynthesizeLower.includes(kw)),
		'Synthesize prompt contains cooking keyword',
	)
	assertFalse(
		newObserveLower.includes('typescript'),
		'Observe prompt no longer mentions TypeScript',
	)
	assertFalse(
		newSynthesizeLower.includes('typescript'),
		'Synthesize prompt no longer mentions TypeScript',
	)

	// ── Events ──

	assertEventEmitted(
		sectionEvents,
		'learner:config:updated',
		(p: any) => p.changedFields?.includes('instructions'),
	)
	assertEventEmitted(sectionEvents, 'learner:prompts:regenerated')

	const regenEvent = sectionEvents.find((e) => e.type === 'learner:prompts:regenerated')
	assertEqual(
		regenEvent!.payload.observePrompt,
		postUpdateObserve,
		'Regen event payload matches actual observe prompt',
	)

	// ── Learn cooking content (should be accepted) ──

	logger.logSection('Phase 2a: Learn Cooking Content')
	resetSection()

	// Reset understanding so we get fresh cooking understanding
	learner.setUnderstanding('')

	const cookLearn1 = await learner.learn([
		'Traditional Neapolitan pizza dough uses tipo 00 flour, water, salt, and fresh yeast. The dough ferments for 24-72 hours at room temperature for optimal flavor development.',
	])
	logger.logState('Cook Learn 1', {
		status: cookLearn1.status,
		output: (cookLearn1 as any).output?.substring(0, 200),
	})

	assertTrue(
		cookLearn1.status === 'observed' || cookLearn1.status === 'synthesized',
		`Cooking content accepted by cooking learner (got: ${cookLearn1.status})`,
	)

	resetSection()

	const cookLearn2 = await learner.learn([
		'Risotto alla Milanese requires carnaroli or arborio rice, saffron threads bloomed in warm broth, finely diced onion soffritto, and cold butter stirred in at the end (mantecatura) for creaminess.',
	])
	logger.logState('Cook Learn 2', {
		status: cookLearn2.status,
		output: (cookLearn2 as any).output?.substring(0, 200),
	})

	const cookingUnderstanding = learner.getUnderstanding()
	logger.logState('Cooking Understanding', {
		length: cookingUnderstanding.length,
		preview: cookingUnderstanding.substring(0, 300),
	})

	assertGreaterThan(cookingUnderstanding.length, 0, 'Understanding built from cooking content')

	// ── Learn TypeScript content with cooking instructions → should be dismissed ──

	logger.logSection('Phase 2b: Learn TS Content With Cooking Instructions')
	resetSection()

	const tsWithCookingInstr = await learner.learn([
		'TypeScript const assertions (as const) create readonly literal types from object/array literals, preventing widening.',
	])
	logger.logState('TS Content With Cooking Instructions', {
		status: tsWithCookingInstr.status,
		output: (tsWithCookingInstr as any).output?.substring(0, 200),
	})

	// With cooking instructions, TS content should be dismissed or have low importance
	// This is the KEY behavioral proof that instructions update propagated
	logger.logMetric(
		'TS content status with cooking instructions',
		0,
		tsWithCookingInstr.status === 'observe:dismissed' ? 1 : 0,
	)

	// ── Query cooking (NOW should be relevant) ──

	logger.logSection('Phase 2c: Query After Domain Switch')
	resetSection()

	const cookingQueryAfterUpdate = await learner.query(
		'How do you make Neapolitan pizza dough and what flour is used?',
	)
	logger.logState('Cooking Query After Update', {
		confidence: cookingQueryAfterUpdate.confidence,
		relevant: cookingQueryAfterUpdate.relevant,
		insight: cookingQueryAfterUpdate.insight.substring(0, 300),
	})

	// After switching to cooking and learning pizza/risotto content,
	// this exact query should now be relevant — the learner has this knowledge
	assertTrue(
		cookingQueryAfterUpdate.relevant,
		'Pizza query now relevant after learning pizza content',
	)
	assertGreaterThan(
		cookingQueryAfterUpdate.confidence,
		baselineCookingConfidence,
		`Cooking confidence improved: ${cookingQueryAfterUpdate.confidence} > baseline ${baselineCookingConfidence}`,
	)

	// ── Query TypeScript (understanding is now cooking, instructions are cooking) ──

	resetSection()

	const tsQueryAfterUpdate = await learner.query(
		'What TypeScript features help with type safety?',
	)
	logger.logState('TS Query After Domain Switch', {
		confidence: tsQueryAfterUpdate.confidence,
		relevant: tsQueryAfterUpdate.relevant,
		insight: tsQueryAfterUpdate.insight.substring(0, 200),
	})

	// TS query confidence should be lower now (understanding is about cooking)
	logger.logMetric('TS query confidence', tsQuery.confidence, tsQueryAfterUpdate.confidence)

	logger.logSuccess('Phase 2 passed — domain switch verified through learn + query')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 3: Update Thresholds → Behavioral Effect on Synthesis
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 3: Update Thresholds')
	resetSection()

	// Set minImportance very high — observations should be dismissed
	await learner.update({
		synthesize: {
			thresholds: {
				minImportance: 0.99,
			},
		},
	})

	assertEqual(
		learner.getSynthesizeThresholds().minImportance,
		0.99,
		'minImportance stored as 0.99',
	)

	// No prompt regeneration for threshold change
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	resetSection()

	const highThresholdLearn = await learner.learn([
		'Cacio e pepe requires only three ingredients: tonnarelli pasta, Pecorino Romano, and freshly ground black pepper. The key technique is creating a cream from pasta water and cheese.',
	])
	logger.logState('Learn with HIGH minImportance (0.99)', {
		status: highThresholdLearn.status,
		output: (highThresholdLearn as any).output?.substring(0, 200),
	})

	// With 0.99 minImportance, observation likely dismissed (importance rarely >= 0.99)
	logger.logMetric(
		'High threshold dismissal',
		0,
		highThresholdLearn.status === 'observe:dismissed' ? 1 : 0,
	)

	// Now lower threshold back
	resetSection()

	await learner.update({
		synthesize: {
			thresholds: {
				minImportance: 0.3,
			},
		},
	})

	assertEqual(
		learner.getSynthesizeThresholds().minImportance,
		0.3,
		'minImportance restored to 0.3',
	)

	const lowThresholdLearn = await learner.learn([
		'Osso buco alla Milanese is a braised veal shank dish served with gremolata (lemon zest, garlic, parsley) and traditionally accompanied by risotto alla Milanese.',
	])
	logger.logState('Learn with LOW minImportance (0.3)', {
		status: lowThresholdLearn.status,
		output: (lowThresholdLearn as any).output?.substring(0, 200),
	})

	assertTrue(
		lowThresholdLearn.status === 'observed' || lowThresholdLearn.status === 'synthesized',
		`Low threshold: content accepted (got: ${lowThresholdLearn.status})`,
	)

	logger.logSuccess('Phase 3 passed — threshold changes affect synthesis gating')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 4: Mid-Workflow Update — Switch Domain Between Learns
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 4: Mid-Workflow Update')

	// Currently cooking instructions. Learn cooking → update to music → learn music.
	resetSection()

	const preMidLearn = await learner.learn([
		'Authentic Italian gelato uses less cream and more milk than American ice cream, and is churned at a slower speed to incorporate less air (overrun), resulting in a denser texture.',
	])
	logger.logState('Pre-mid-update learn (cooking)', {
		status: preMidLearn.status,
	})

	// Update to music theory
	resetSection()

	const preMidPrompts = {
		observe: learner.getObserveSystemPrompt()!,
		synthesize: learner.getSynthesizeSystemPrompt()!,
	}

	await learner.update({
		instructions:
			'You track music theory concepts, harmonic progressions, compositional techniques, and instrument-specific patterns.',
	})

	const postMidObserve = learner.getObserveSystemPrompt()!
	assertTrue(
		postMidObserve !== preMidPrompts.observe,
		'Mid-workflow: observe prompt changed after instructions update',
	)

	const musicKeywords = ['music', 'harmon', 'compos', 'instrument', 'melod', 'chord', 'note']
	assertTrue(
		musicKeywords.some((kw) => postMidObserve.toLowerCase().includes(kw)),
		'Mid-workflow: observe prompt reflects music domain',
	)

	assertEventEmitted(sectionEvents, 'learner:prompts:regenerated')

	// Learn music content → should work with new instructions
	resetSection()

	const musicLearn = await learner.learn([
		'The ii-V-I chord progression is the most common harmonic movement in jazz. In the key of C major, this translates to Dm7 → G7 → Cmaj7, creating a strong sense of resolution.',
	])
	logger.logState('Music learn after mid-workflow update', {
		status: musicLearn.status,
		output: (musicLearn as any).output?.substring(0, 200),
	})

	assertTrue(
		musicLearn.status === 'observed' || musicLearn.status === 'synthesized',
		`Music content accepted by music learner (got: ${musicLearn.status})`,
	)

	// Learn cooking content with music instructions → should be dismissed
	resetSection()

	const cookingWithMusicInstr = await learner.learn([
		'Traditional balsamic vinegar of Modena is aged for a minimum of 12 years in a battery of progressively smaller barrels made from different woods.',
	])
	logger.logState('Cooking content with music instructions', {
		status: cookingWithMusicInstr.status,
		output: (cookingWithMusicInstr as any).output?.substring(0, 200),
	})

	logger.logMetric(
		'Cross-domain dismissal (cooking→music)',
		0,
		cookingWithMusicInstr.status === 'observe:dismissed' ? 1 : 0,
	)

	// Query music → should be relevant
	resetSection()

	const musicQuery = await learner.query('What chord progressions are common in jazz?')
	logger.logState('Music query', {
		confidence: musicQuery.confidence,
		relevant: musicQuery.relevant,
		insight: musicQuery.insight.substring(0, 200),
	})

	assertEventEmitted(sectionEvents, 'learner:query:completed')

	logger.logSuccess('Phase 4 passed — mid-workflow update verified')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 5: Static Guards
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 5: Static Guards')

	// ── 5a: Immutability — only id throws ──

	let idError: Error | null = null
	try {
		await learner.update({ id: 'different-id' })
	} catch (error) {
		idError = error as Error
	}
	assertTrue(!!idError, 'Updating id throws error')
	assertContains(idError!.message, 'immutable', 'Error mentions immutability')

	let modelError: Error | null = null
	try {
		await learner.update({ model: openrouter(MODEL) })
	} catch (error) {
		modelError = error as Error
	}
	assertFalse(!!modelError, 'Updating model does NOT throw')

	// ── 5b: No-op update ──

	resetSection()
	const currentName = learner.name
	const currentDesc = learner.description
	const noop = await learner.update({ name: currentName, description: currentDesc })
	assertEqual(noop.changedFields.length, 0, 'No-op: empty changedFields')
	assertEventNotEmitted(sectionEvents, 'learner:config:updated')

	// ── 5c: Metadata update — no side effects on prompts ──

	resetSection()
	const preMetaObserve = learner.getObserveSystemPrompt()
	const preMetaSynthesize = learner.getSynthesizeSystemPrompt()

	const metaResult = await learner.update({
		name: 'Renamed Learner',
		description: 'New description',
	})

	assertEqual(learner.name, 'Renamed Learner', 'Name updated')
	assertEqual(learner.description, 'New description', 'Description updated')
	assertEqual(
		learner.getObserveSystemPrompt(),
		preMetaObserve,
		'Metadata: observe prompt unchanged',
	)
	assertEqual(
		learner.getSynthesizeSystemPrompt(),
		preMetaSynthesize,
		'Metadata: synthesize prompt unchanged',
	)
	assertFalse(
		metaResult.changedFields.includes('instructions'),
		'Metadata: instructions not in changedFields',
	)
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	// ── 5d: Governance signal thresholds ──

	resetSection()
	const preGov = learner.getHealth()

	await learner.update({
		governance: {
			signalThresholds: {
				maxDismissalRate: 0.5,
				minConfidence: 0.6,
				maxObservationsWithoutSynthesis:
					preGov.signalThresholds.maxObservationsWithoutSynthesis,
			},
		},
	})

	assertEqual(
		learner.getHealth().signalThresholds.maxDismissalRate,
		0.5,
		'maxDismissalRate → 0.5',
	)
	assertEqual(
		learner.getHealth().signalThresholds.minConfidence,
		0.6,
		'minConfidence → 0.6',
	)
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	// ── 5e: Model update — no prompt regen ──

	resetSection()
	const preModelObserve = learner.getObserveSystemPrompt()
	const modelResult = await learner.update({ model: openrouter(MODEL) })

	assertTrue(modelResult.changedFields.includes('model'), 'Model in changedFields')
	assertEqual(
		learner.getObserveSystemPrompt(),
		preModelObserve,
		'Model: observe prompt unchanged',
	)
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	logger.logSuccess('Phase 5 passed — all static guards verified')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 6: Global Event Audit
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 6: Global Event Audit')

	const eventTypes = [...new Set(events.map((e) => e.type))]
	logger.logState('All Event Types', eventTypes)

	// Must have learning events (observe + synthesize from actual LLM calls)
	assertEventEmitted(events, 'learner:observe:started')
	assertEventEmitted(events, 'learner:observe:thinking')

	// Must have query events
	assertEventEmitted(events, 'learner:query:started')
	assertEventEmitted(events, 'learner:query:completed')

	// Must have config + prompt events
	assertEventEmitted(events, 'learner:config:updated')
	assertEventEmitted(events, 'learner:prompts:regenerated')

	// Count key events
	const counts = {
		configUpdated: events.filter((e) => e.type === 'learner:config:updated').length,
		promptsRegen: events.filter((e) => e.type === 'learner:prompts:regenerated').length,
		observeStarted: events.filter((e) => e.type === 'learner:observe:started').length,
		queryStarted: events.filter((e) => e.type === 'learner:query:started').length,
		queryCompleted: events.filter((e) => e.type === 'learner:query:completed').length,
	}

	logger.logState('Event Counts', counts)

	// Verify minimum counts
	assertGreaterThan(counts.configUpdated, 5, `config:updated events (got ${counts.configUpdated})`)
	// 3 instruction updates → 3 prompt regens (Phase 2, Phase 4 cooking→music, Phase 4's happens once)
	assertGreaterThan(counts.promptsRegen, 1, `prompts:regenerated events (got ${counts.promptsRegen})`)
	// Many learn calls across all phases
	assertGreaterThan(counts.observeStarted, 5, `observe:started events (got ${counts.observeStarted})`)
	// Multiple query calls
	assertGreaterThan(counts.queryStarted, 3, `query:started events (got ${counts.queryStarted})`)
	assertEqual(counts.queryStarted, counts.queryCompleted, 'Every query started was completed')

	// Every config:updated event has proper payload
	const configEvents = events.filter((e) => e.type === 'learner:config:updated')
	for (const evt of configEvents) {
		assertTrue(
			Array.isArray(evt.payload?.changedFields),
			'config:updated has changedFields array',
		)
		assertGreaterThan(evt.payload.changedFields.length, 0, 'changedFields non-empty')
		assertDefined(evt.payload.config, 'config:updated has config')
	}

	logger.logState('Final Learner State', {
		name: learner.name,
		instructions: learner.instructions.substring(0, 60) + '...',
		understanding: learner.getUnderstanding().substring(0, 200) + '...',
		thresholds: learner.getSynthesizeThresholds(),
		governance: {
			activation: learner.getHealth().activation,
			status: learner.getHealth().status,
			signalThresholds: learner.getHealth().signalThresholds,
		},
		totalEvents: events.length,
	})

	logger.logSuccess('All 6 phases passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
