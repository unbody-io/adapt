/**
 * Eval: Learner Update Inside Brain
 *
 * Tests learner.update() called directly on a learner that lives inside a Brain.
 * Verifies brain-level coherence after direct learner modification:
 *   - Learner still accessible via brain.getLearner()
 *   - Events forwarded through brain
 *   - brain.inject() routes to updated learner
 *   - brain.ask() includes updated learner's contributions
 *
 * Phases:
 *   1. Baseline — init + inject + ask
 *   2. Direct instructions update — prompts regen, understanding preserved, brain coherent
 *   3. brain.ask() after direct update — brain still works
 *   4. Direct threshold update — gating behavior changes
 *   5. Direct model update — no prompt regen
 *   6. Direct metadata update — no prompt regen, brain sees changes
 *   7. brain.inject() routes to updated learner
 *   8. Immutability guard — id change throws
 *   9. Global event audit
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertDefined,
	assertContains,
	assertGreaterThan,
	assertEventEmitted,
	assertEventNotEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'anthropic/claude-opus-4.5'

async function main() {
	const events: Array<{ type: string; payload?: any }> = []
	let sectionEvents: Array<{ type: string; payload?: any }> = []

	function resetSection() {
		sectionEvents = []
	}

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 1: Baseline
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 1: Baseline')

	const brain = new Brain({
		prompt: 'Track software development: code quality practices and API design patterns',
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			autoEvaluate: false,
			evaluatorSignalThreshold: 100, // High threshold — prevent auto-evolution
		},
	})

	await brain.initialize()

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		sectionEvents.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	assertTrue(brain.learners.size > 0, 'Brain created learners')

	// Inject baseline data
	await brain.inject([
		'Clean code principles: functions should do one thing, names should be descriptive, avoid magic numbers.',
		'RESTful APIs use resource-oriented URLs, HTTP verbs for actions, and proper status codes.',
	])

	await brain.inject([
		'Code reviews should focus on logic errors, security issues, and maintainability — not style.',
		'API versioning strategies: URL path (/v1/), query parameter (?v=1), or Accept header.',
	])

	const baselineAsk = await brain.ask('What are important code quality practices?')
	assertGreaterThan(baselineAsk.insight.length, 0, 'Baseline ask returns insight')

	// Snapshot and pick target learner
	const baselineLearnerIds = Array.from(brain.learners.keys())
	const baselineLearnerCount = brain.learners.size
	const targetId = baselineLearnerIds[0]
	const target = brain.getLearner(targetId)!

	assertDefined(target, 'Target learner exists')

	const baselineState = {
		targetId,
		targetName: target.name,
		targetInstructions: target.instructions,
		targetObservePrompt: target.getObserveSystemPrompt(),
		targetSynthesizePrompt: target.getSynthesizeSystemPrompt(),
		targetUnderstanding: target.getUnderstanding(),
	}

	logger.logState('Baseline', {
		learnerCount: baselineLearnerCount,
		learnerIds: baselineLearnerIds,
		targetId: baselineState.targetId,
		targetName: baselineState.targetName,
		targetUnderstandingLength: baselineState.targetUnderstanding.length,
	})

	logger.logSuccess('Phase 1 passed — baseline established')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 2: Direct Instructions Update
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 2: Direct Instructions Update')
	resetSection()

	const newInstructions =
		'You track GraphQL API design patterns, schema design, resolvers, and client-side data fetching strategies.'

	const directResult = await target.update({
		instructions: newInstructions,
	})

	logger.logState('Direct Update Result', {
		changedFields: directResult.changedFields,
	})

	// Hard: instructions changed
	assertTrue(
		directResult.changedFields.includes('instructions'),
		'Direct: instructions in changedFields',
	)
	assertEqual(target.instructions, newInstructions, 'Direct: instructions stored')

	// Hard: prompts regenerated
	assertTrue(
		target.getObserveSystemPrompt() !== baselineState.targetObservePrompt,
		'Direct: observe prompt changed',
	)
	assertTrue(
		target.getSynthesizeSystemPrompt() !== baselineState.targetSynthesizePrompt,
		'Direct: synthesize prompt changed',
	)

	// Hard: events forwarded through brain
	assertEventEmitted(
		sectionEvents,
		'learner:config:updated',
		(p) => p.learnerId === targetId && p.changedFields.includes('instructions'),
	)
	assertEventEmitted(
		sectionEvents,
		'learner:prompts:regenerated',
		(p) => p.learnerId === targetId,
	)

	// Hard: understanding NOT wiped
	assertEqual(
		target.getUnderstanding(),
		baselineState.targetUnderstanding,
		'Direct: understanding preserved',
	)

	// Hard: brain coherence — learner still accessible
	const reAccessed = brain.getLearner(targetId)
	assertDefined(reAccessed, 'Direct: learner still accessible via brain.getLearner()')
	assertEqual(reAccessed!.instructions, newInstructions, 'Direct: brain sees updated instructions')
	assertTrue(brain.learners.has(targetId), 'Direct: learner still in brain.learners map')
	assertEqual(brain.learners.size, baselineLearnerCount, 'Direct: learner count unchanged')

	logger.logSuccess('Phase 2 passed — direct instructions update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 3: brain.ask() After Direct Update
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 3: brain.ask() After Direct Update')
	resetSection()

	// Inject GraphQL content so the updated learner has relevant data
	await brain.inject([
		'GraphQL schemas should be designed around the domain model, not the database schema. Use interfaces for shared fields.',
		'Apollo Client uses InMemoryCache with type policies for normalized caching of GraphQL responses.',
	])

	const postUpdateAsk = await brain.ask('What are good GraphQL schema design practices?')

	assertGreaterThan(postUpdateAsk.insight.length, 0, 'PostDirect: brain.ask() works')
	assertEventEmitted(sectionEvents, 'brain:ask:completed')

	// Log whether the updated learner contributed
	const targetSource = postUpdateAsk.sources.find((s) => s.learnerId === targetId)
	if (targetSource) {
		logger.logState('Updated learner contribution', {
			confidence: targetSource.confidence,
			insightPreview: targetSource.insight.substring(0, 200),
		})
	} else {
		logger.logWarning('Updated learner did not contribute to ask result')
	}

	logger.logSuccess('Phase 3 passed — brain.ask() works after direct update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 4: Direct Threshold Update
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 4: Direct Threshold Update')
	resetSection()

	// Pick second learner if available, otherwise use target
	const target2Id = baselineLearnerIds[1] ?? targetId
	const target2 = brain.getLearner(target2Id)!
	assertDefined(target2, 'Target2 learner exists')

	const preThreshold = target2.getSynthesizeThresholds().minImportance

	await target2.update({
		synthesize: {
			thresholds: {
				minImportance: 0.95,
			},
		},
	})

	// Hard: threshold stored
	assertEqual(
		target2.getSynthesizeThresholds().minImportance,
		0.95,
		'Direct threshold: stored correctly',
	)

	// Hard: no prompt regen for threshold-only change
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	// Behavioral: inject with high threshold — observe dismissal pattern
	const highThresholdInject = await brain.inject([
		'Code coverage metrics should target meaningful coverage, not arbitrary percentages.',
	])

	// Log whether target2 dismissed
	for (const batch of highThresholdInject.batches) {
		const target2Result = batch.results.find((r) => r.learnerId === target2Id)
		if (target2Result) {
			logger.logMetric(
				'Direct threshold: observation importance vs threshold',
				0.95,
				target2Result.result.status === 'observe:dismissed' ? 0 : 1,
			)
		}
	}

	// Restore
	await target2.update({
		synthesize: { thresholds: { minImportance: preThreshold } },
	})
	assertEqual(
		target2.getSynthesizeThresholds().minImportance,
		preThreshold,
		'Direct threshold: restored',
	)

	logger.logSuccess('Phase 4 passed — direct threshold update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 5: Direct Model Update
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 5: Direct Model Update')
	resetSection()

	const preModelObservePrompt = target.getObserveSystemPrompt()

	const modelResult = await target.update({
		model: openrouter(MODEL),
	})

	// Hard: model changed
	assertTrue(modelResult.changedFields.includes('model'), 'Direct model: model in changedFields')

	// Hard: prompts NOT regenerated (model change doesn't trigger regen)
	assertEqual(
		target.getObserveSystemPrompt(),
		preModelObservePrompt,
		'Direct model: observe prompt unchanged',
	)
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	logger.logSuccess('Phase 5 passed — direct model update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 6: Direct Metadata Update
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 6: Direct Metadata Update')
	resetSection()

	const preMetaObservePrompt = target.getObserveSystemPrompt()

	await target.update({
		name: 'GraphQL Tracker',
		description: 'Tracks GraphQL patterns and best practices',
	})

	// Hard: metadata updated
	assertEqual(target.name, 'GraphQL Tracker', 'Direct meta: name updated')
	assertEqual(
		target.description,
		'Tracks GraphQL patterns and best practices',
		'Direct meta: description updated',
	)

	// Hard: prompts unchanged (metadata-only change)
	assertEqual(
		target.getObserveSystemPrompt(),
		preMetaObservePrompt,
		'Direct meta: observe prompt unchanged',
	)
	assertEventNotEmitted(sectionEvents, 'learner:prompts:regenerated')

	// Hard: brain sees the updated metadata
	const learnerFromBrain = brain.getLearners().find((l) => l.id === targetId)
	assertDefined(learnerFromBrain, 'Direct meta: still in getLearners()')
	assertEqual(learnerFromBrain!.name, 'GraphQL Tracker', 'Direct meta: brain sees new name')

	logger.logSuccess('Phase 6 passed — direct metadata update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 7: brain.inject() Routes to Updated Learner
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 7: Injection Routing After Update')
	resetSection()

	// Clear understanding for a clean test
	const preRouteUnderstanding = target.getUnderstanding()
	// Note: we don't call setUnderstanding('') — we just inject matching content
	// and verify the learner processes it (understanding grows)

	await brain.inject([
		'GraphQL subscriptions use WebSocket transport for real-time data updates from server to client.',
		'DataLoader batches and caches database calls within a single GraphQL request to solve the N+1 problem.',
	])

	const postRouteUnderstanding = target.getUnderstanding()
	logger.logMetric(
		'Route: understanding growth',
		preRouteUnderstanding.length,
		postRouteUnderstanding.length,
	)

	// The learner should have observed the GraphQL content (its instructions now match GraphQL)
	assertEventEmitted(
		sectionEvents,
		'learner:observe:started',
		(p) => p.learnerId === targetId,
	)

	logger.logSuccess('Phase 7 passed — injection routing works')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 8: Immutability Guard
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 8: Immutability Guard')
	resetSection()

	let idError: Error | null = null
	try {
		await target.update({ id: 'different-id' } as any)
	} catch (err) {
		idError = err as Error
	}

	assertTrue(!!idError, 'Immutability: updating id throws')
	assertContains(idError!.message, 'immutable', 'Immutability: error mentions immutable')

	// Verify learner is still fine after failed update
	assertEqual(target.id, targetId, 'Immutability: id unchanged after failed update')
	assertDefined(brain.getLearner(targetId), 'Immutability: learner still accessible')

	logger.logSuccess('Phase 8 passed — immutability guard')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 9: Global Event Audit
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 9: Global Event Audit')

	const eventTypes = [...new Set(events.map((e) => e.type))]
	logger.logState('All event types observed', eventTypes)

	// Learner-level events forwarded through brain
	assertEventEmitted(events, 'learner:config:updated')
	assertEventEmitted(events, 'learner:prompts:regenerated')
	assertEventEmitted(events, 'learner:observe:started')

	// Brain-level events
	assertEventEmitted(events, 'brain:inject:completed')
	assertEventEmitted(events, 'brain:ask:completed')

	// Count checks
	const configUpdatedCount = events.filter((e) => e.type === 'learner:config:updated').length
	assertGreaterThan(configUpdatedCount, 3, `At least 4 config:updated events (got ${configUpdatedCount})`)

	const injectCount = events.filter((e) => e.type === 'brain:inject:completed').length
	assertGreaterThan(injectCount, 3, `At least 4 inject:completed events (got ${injectCount})`)

	logger.logSuccess('Phase 9 passed — event audit')

	// ═════════════════════════════════════════════════════════════════════════

	logger.logSuccess('All phases passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
