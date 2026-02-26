/**
 * Eval: Brain Update Scenarios
 *
 * Tests 5 brain.update() scenarios end-to-end on a single brain instance,
 * exercising the full signal-driven evolution path (prompt → evaluator → decisions → execution).
 *
 * Mixed strictness:
 *   - Hard fail: deterministic parts (prompt stored, signal emitted, config cascaded)
 *   - Soft fail: LLM-dependent parts (evolution decisions) — logged as metrics
 *
 * Scenarios (sequential, cumulative state):
 *   0. Baseline — init + inject + ask
 *   1. Additive prompt — expand scope, existing learners preserved
 *   2. Combo update — prompt + model in one call
 *   3. Threshold cascade — mechanical, no signal
 *   4. Subtractive prompt — narrow scope, irrelevant learners restructured
 *   5. Full pivot — completely new domain
 *   6. Global event audit
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertFalse,
	assertDefined,
	assertGreaterThan,
	assertEventEmitted,
	assertEventNotEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { BrainUpdateResult } from '../../src/brain/types'

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
	// Phase 0: Baseline — Init + Inject + Ask
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 0: Baseline')

	const brain = new Brain({
		prompt: 'Track my development patterns: TypeScript skills, React architecture, and testing philosophy',
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 1,
			autoEvaluate: true,
		},
	})

	await brain.initialize()

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		sectionEvents.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	assertTrue(brain.learners.size > 0, 'Brain created learners from decomposition')

	const learnerIds = Array.from(brain.learners.keys())
	logger.logState('Initial Learners', learnerIds)

	// Inject baseline data (2 items per topic)
	await brain.inject([
		'TypeScript interfaces are preferred over type aliases for object shapes because they support declaration merging and can be extended.',
		'Discriminated unions in TypeScript enable exhaustive pattern matching in switch/case blocks using a shared literal property.',
	])

	await brain.inject([
		'React hooks should be composed into custom hooks when logic is shared. useEffect cleanup functions prevent memory leaks.',
		'React Server Components separate server-only and client-only code at the component level, reducing bundle size.',
	])

	await brain.inject([
		'Unit tests should follow the AAA pattern: Arrange, Act, Assert. Integration tests verify component interactions.',
		'Test doubles include mocks, stubs, and spies. Prefer stubs for deterministic behavior and mocks for interaction verification.',
	])

	const baselineAsk = await brain.ask('What TypeScript patterns are important for type safety?')

	assertDefined(baselineAsk.insight, 'Baseline ask returns insight')
	assertGreaterThan(baselineAsk.insight.length, 0, 'Baseline ask insight is non-empty')

	// Snapshot baseline state
	const baselineSnapshot = {
		learnerCount: brain.learners.size,
		learnerIds: Array.from(brain.learners.keys()),
		understandings: new Map(
			await Promise.all(brain.getLearners().map(async (l) => [l.id, await l.getUnderstanding()] as const)),
		),
	}

	logger.logState('Baseline Snapshot', {
		learnerCount: baselineSnapshot.learnerCount,
		learnerIds: baselineSnapshot.learnerIds,
		understandingLengths: Object.fromEntries(
			Array.from(baselineSnapshot.understandings.entries()).map(([id, u]) => [id, u.length]),
		),
	})

	logger.logSuccess('Phase 0 passed — baseline established')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 1: Additive Prompt — Expand scope with DevOps/CI-CD
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 1: Additive Prompt Update')
	resetSection()

	const additivePrompt =
		'Track my development patterns: TypeScript skills, React architecture, testing philosophy, and DevOps/CI-CD pipeline practices'

	const preAdditive = {
		learnerCount: brain.learners.size,
		learnerIds: Array.from(brain.learners.keys()),
		understandings: new Map(
			await Promise.all(brain.getLearners().map(async (l) => [l.id, await l.getUnderstanding()] as const)),
		),
	}

	let additiveResult: BrainUpdateResult | undefined
	try {
		additiveResult = await brain.update({ prompt: additivePrompt })

		logger.logState('Additive Update Result', {
			changedFields: additiveResult.changedFields,
			hasEvolutionResults: !!additiveResult.evolutionResults,
			learnerResultCount: additiveResult.learnerResults.length,
			evolutionSummary: additiveResult.evolutionResults
				? {
						created: additiveResult.evolutionResults.created,
						deleted: additiveResult.evolutionResults.deleted,
						updated: additiveResult.evolutionResults.updated,
						merged: additiveResult.evolutionResults.merged,
						decisions: additiveResult.evolutionResults.decisions.map((d) => ({
							action: d.action,
							reasoning: d.reasoning,
							targets: d.targets,
						})),
					}
				: null,
		})
	} catch (err) {
		logger.logWarning(`Evolution failed during additive update (non-fatal): ${err}`)
	}

	// Hard: prompt changed
	assertEqual(brain.prompt, additivePrompt, 'Additive: prompt updated')

	if (additiveResult) {
		assertTrue(additiveResult.changedFields.includes('prompt'), 'Additive: prompt in changedFields')
	}

	// Hard: signal emitted
	assertEventEmitted(
		sectionEvents,
		'brain:signal:received',
		(p) => p.source === 'brain' && p.description.includes('SYSTEM DIRECTIVE'),
	)

	// Hard: config:updated event (if update completed)
	if (additiveResult) {
		assertEventEmitted(
			sectionEvents,
			'brain:config:updated',
			(p) => p.changedFields.includes('prompt'),
		)
	}

	// Soft: evolution decisions
	if (additiveResult?.evolutionResults) {
		const evo = additiveResult.evolutionResults
		logger.logMetric('Additive: deleted learners', 0, evo.deleted.length)
		logger.logMetric('Additive: created learners', 0, evo.created.length)
		logger.logMetric('Additive: updated learners', 0, evo.updated.length)
		logger.logMetric('Additive: learner count change', preAdditive.learnerCount, brain.learners.size)
	}

	// Soft: understanding preservation on surviving learners
	for (const oldId of preAdditive.learnerIds) {
		const learner = brain.getLearner(oldId)
		if (learner) {
			const oldLen = preAdditive.understandings.get(oldId)?.length ?? 0
			const newLen = (await learner.getUnderstanding()).length
			logger.logMetric(`Additive: ${oldId} understanding`, oldLen, newLen)
		} else {
			logger.logWarning(`Additive: learner ${oldId} was removed during evolution`)
		}
	}

	// Behavioral: inject DevOps content and verify brain can answer
	await brain.inject([
		'CI/CD pipelines should run tests, lint, and type-check on every PR. GitHub Actions with matrix builds cover multiple Node.js versions.',
		'Docker multi-stage builds reduce image size. Use Alpine base images and separate build/runtime stages.',
	])

	const devopsAsk = await brain.ask('What are good CI/CD pipeline practices?')
	assertGreaterThan(devopsAsk.insight.length, 0, 'Additive: brain answers DevOps questions')

	logger.logSuccess('Phase 1 passed — additive prompt update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 2: Combo Update — prompt + model in one call
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 2: Combo Update (prompt + model)')
	resetSection()

	const comboPrompt =
		'Track my development patterns: TypeScript skills, React architecture, testing philosophy, DevOps/CI-CD, and database design'

	const preCombo = {
		learnerCount: brain.learners.size,
		learnerIds: Array.from(brain.learners.keys()),
	}

	let comboResult: BrainUpdateResult | undefined
	try {
		comboResult = await brain.update({
			prompt: comboPrompt,
			model: openrouter(MODEL),
		})

		logger.logState('Combo Update Result', {
			changedFields: comboResult.changedFields,
			learnerResultCount: comboResult.learnerResults.length,
			hasEvolutionResults: !!comboResult.evolutionResults,
		})
	} catch (err) {
		logger.logWarning(`Evolution failed during combo update (non-fatal): ${err}`)
	}

	// Hard: both fields changed
	assertEqual(brain.prompt, comboPrompt, 'Combo: prompt updated')

	if (comboResult) {
		assertTrue(comboResult.changedFields.includes('prompt'), 'Combo: prompt in changedFields')
		assertTrue(comboResult.changedFields.includes('model'), 'Combo: model in changedFields')

		// Hard: model cascaded to all learners that existed before evolution
		// (learnerResults only contains learners that received the cascade in Category 2)
		assertGreaterThan(
			comboResult.learnerResults.length,
			0,
			'Combo: model cascaded to learners',
		)
	}

	// Hard: signal emitted (for prompt part)
	assertEventEmitted(
		sectionEvents,
		'brain:signal:received',
		(p) => p.source === 'brain',
	)

	// Soft: evolution decisions
	if (comboResult?.evolutionResults) {
		logger.logMetric('Combo: created learners', 0, comboResult.evolutionResults.created.length)
		logger.logMetric('Combo: deleted learners', 0, comboResult.evolutionResults.deleted.length)
	}

	logger.logSuccess('Phase 2 passed — combo update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 3: Threshold Cascade — mechanical, no signal
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 3: Threshold Cascade')
	resetSection()

	const thresholdResult = await brain.update({
		learning: {
			synthesize: {
				thresholds: {
					maxObservations: 3,
				},
			},
		},
	})

	logger.logState('Threshold Update Result', {
		changedFields: thresholdResult.changedFields,
		learnerResultCount: thresholdResult.learnerResults.length,
	})

	// Hard: all learners received update
	assertEqual(
		thresholdResult.learnerResults.length,
		brain.learners.size,
		'Threshold: all learners updated',
	)

	// Hard: each learner has new threshold
	for (const learner of brain.getLearners()) {
		assertEqual(
			learner.getUnderstandThresholds().maxObservations,
			3,
			`Threshold: ${learner.id} maxObservations is 3`,
		)
	}

	// Hard: NO signal emitted (mechanical, not semantic)
	assertEventNotEmitted(sectionEvents, 'brain:signal:received')

	// Hard: no evolution
	assertFalse(!!thresholdResult.evolutionResults, 'Threshold: no evolution results')

	// Restore
	await brain.update({
		learning: { synthesize: { thresholds: { maxObservations: 10 } } },
	})

	logger.logSuccess('Phase 3 passed — threshold cascade')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 4: Subtractive Prompt — narrow scope
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 4: Subtractive Prompt Update')
	resetSection()

	const subtractivePrompt = 'Track only my TypeScript skills and testing philosophy'

	const preSubtractive = {
		learnerCount: brain.learners.size,
		learnerIds: Array.from(brain.learners.keys()),
	}

	logger.logState('Pre-subtractive', {
		learnerCount: preSubtractive.learnerCount,
		learnerIds: preSubtractive.learnerIds,
	})

	let subtractiveResult: BrainUpdateResult | undefined
	try {
		subtractiveResult = await brain.update({ prompt: subtractivePrompt })

		logger.logState('Subtractive Update Result', {
			changedFields: subtractiveResult.changedFields,
			hasEvolutionResults: !!subtractiveResult.evolutionResults,
			evolutionSummary: subtractiveResult.evolutionResults
				? {
						created: subtractiveResult.evolutionResults.created,
						deleted: subtractiveResult.evolutionResults.deleted,
						updated: subtractiveResult.evolutionResults.updated,
						merged: subtractiveResult.evolutionResults.merged,
						decisions: subtractiveResult.evolutionResults.decisions.map((d) => ({
							action: d.action,
							reasoning: d.reasoning,
							targets: d.targets,
						})),
					}
				: null,
		})
	} catch (err) {
		logger.logWarning(`Evolution failed during subtractive update (non-fatal): ${err}`)
	}

	// Hard: prompt changed
	assertEqual(brain.prompt, subtractivePrompt, 'Subtractive: prompt updated')

	// Hard: signal emitted
	assertEventEmitted(
		sectionEvents,
		'brain:signal:received',
		(p) => p.source === 'brain' && p.description.includes('SYSTEM DIRECTIVE'),
	)

	// Soft: evolution decisions — some restructuring expected
	if (subtractiveResult?.evolutionResults) {
		const evo = subtractiveResult.evolutionResults
		const hasRestructuring = evo.deleted.length > 0 || evo.updated.length > 0 || evo.merged.length > 0
		logger.logMetric('Subtractive: deleted', 0, evo.deleted.length)
		logger.logMetric('Subtractive: updated', 0, evo.updated.length)
		logger.logMetric('Subtractive: merged', 0, evo.merged.length)
		logger.logMetric('Subtractive: created', 0, evo.created.length)
		logger.logMetric('Subtractive: learner count change', preSubtractive.learnerCount, brain.learners.size)

		if (!hasRestructuring) {
			logger.logWarning('Subtractive: no restructuring happened (expected deletions or updates)')
		}
	}

	// Behavioral: TS questions still answered
	const tsAskAfterSubtractive = await brain.ask('What TypeScript type patterns do I use?')
	assertGreaterThan(tsAskAfterSubtractive.insight.length, 0, 'Subtractive: TS questions still answered')

	logger.logSuccess('Phase 4 passed — subtractive prompt update')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 5: Full Pivot — completely new domain
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 5: Full Pivot to Cooking')
	resetSection()

	const pivotPrompt =
		'Track Italian cooking: traditional recipes, regional specialties, and ingredient sourcing'

	const prePivot = {
		learnerCount: brain.learners.size,
		learnerIds: Array.from(brain.learners.keys()),
	}

	logger.logState('Pre-pivot', {
		learnerCount: prePivot.learnerCount,
		learnerIds: prePivot.learnerIds,
	})

	let pivotResult: BrainUpdateResult | undefined
	try {
		pivotResult = await brain.update({ prompt: pivotPrompt })

		logger.logState('Pivot Update Result', {
			changedFields: pivotResult.changedFields,
			hasEvolutionResults: !!pivotResult.evolutionResults,
			evolutionSummary: pivotResult.evolutionResults
				? {
						created: pivotResult.evolutionResults.created,
						deleted: pivotResult.evolutionResults.deleted,
						updated: pivotResult.evolutionResults.updated,
						merged: pivotResult.evolutionResults.merged,
						decisions: pivotResult.evolutionResults.decisions.map((d) => ({
							action: d.action,
							reasoning: d.reasoning,
							targets: d.targets,
						})),
					}
				: null,
		})
	} catch (err) {
		logger.logWarning(`Evolution failed during pivot (non-fatal): ${err}`)
	}

	// Hard: prompt changed
	assertEqual(brain.prompt, pivotPrompt, 'Pivot: prompt updated')

	// Hard: signal emitted
	assertEventEmitted(
		sectionEvents,
		'brain:signal:received',
		(p) => p.source === 'brain' && p.description.includes('SYSTEM DIRECTIVE'),
	)

	// Soft: evolution decisions
	if (pivotResult?.evolutionResults) {
		const evo = pivotResult.evolutionResults
		logger.logMetric('Pivot: deleted learners', 0, evo.deleted.length)
		logger.logMetric('Pivot: created learners', 0, evo.created.length)
		logger.logMetric('Pivot: updated learners', 0, evo.updated.length)
		logger.logMetric('Pivot: learner count', prePivot.learnerCount, brain.learners.size)

		if (evo.deleted.length === 0 && evo.created.length === 0) {
			logger.logWarning('Pivot: expected old learners deleted and new ones created, but neither happened')
		}
	}

	// Log surviving old learners (for diagnosis)
	for (const oldId of prePivot.learnerIds) {
		const learner = brain.getLearner(oldId)
		if (learner) {
			logger.logWarning(
				`Pivot: old learner ${oldId} survived — instructions: ${learner.instructions.substring(0, 100)}`,
			)
		}
	}

	// Behavioral: inject cooking content and verify brain answers
	await brain.inject([
		'Traditional Neapolitan pizza dough uses tipo 00 flour, water, salt, and fresh yeast. The dough ferments for 24-72 hours.',
		'Risotto alla Milanese requires carnaroli rice and saffron threads bloomed in warm broth.',
	])

	const cookingAsk = await brain.ask('What ingredients are needed for Neapolitan pizza?')
	assertGreaterThan(cookingAsk.insight.length, 0, 'Pivot: brain answers cooking questions')

	logger.logSuccess('Phase 5 passed — full pivot')

	// ═════════════════════════════════════════════════════════════════════════
	// Phase 6: Global Event Audit
	// ═════════════════════════════════════════════════════════════════════════

	logger.logSection('Phase 6: Global Event Audit')

	const eventTypes = [...new Set(events.map((e) => e.type))]
	logger.logState('All event types observed', eventTypes)

	// Signal events from 4 prompt changes (phases 1, 2, 4, 5)
	const signalCount = events.filter((e) => e.type === 'brain:signal:received').length
	assertGreaterThan(signalCount, 3, `At least 4 signal events (got ${signalCount})`)

	// Config updated events
	assertEventEmitted(events, 'brain:config:updated')
	const configUpdatedCount = events.filter((e) => e.type === 'brain:config:updated').length
	assertGreaterThan(configUpdatedCount, 3, `At least 4 config:updated events (got ${configUpdatedCount})`)

	// Evaluator events (at least some should have fired)
	const evalStartedCount = events.filter((e) => e.type === 'evaluator:evaluation:started').length
	logger.logMetric('Evaluator evaluations started', 0, evalStartedCount)

	// Inject/Ask events
	assertEventEmitted(events, 'brain:inject:completed')
	assertEventEmitted(events, 'brain:ask:completed')

	const injectCount = events.filter((e) => e.type === 'brain:inject:completed').length
	const askCount = events.filter((e) => e.type === 'brain:ask:completed').length
	assertGreaterThan(injectCount, 3, `At least 4 inject events (got ${injectCount})`)
	assertGreaterThan(askCount, 3, `At least 4 ask events (got ${askCount})`)

	logger.logSuccess('Phase 6 passed — event audit')

	// ═════════════════════════════════════════════════════════════════════════

	logger.logSuccess('All phases passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
