/**
 * Eval: Learner Adjust
 *
 * Exercises learner.adjust(directive) across various directive types.
 * Dumps full before/after state for each scenario — inspect visually.
 *
 * What to look for in output:
 * - Additive: old topics preserved + new topic added in instructions & identity
 * - Subtractive: removed topic gone from instructions & identity
 * - Full pivot: entirely new domain in instructions & identity
 * - Behavioral tweak: same domain but stricter/looser criteria
 * - Data preservation: understanding + buffer unchanged after adjust
 * - List learner: adjust works on list-type learners too
 *
 * Structural assertions (non-LLM-dependent):
 * - instructions string changed
 * - observe/understand prompts regenerated (string !== old string)
 * - events emitted (learner:prompts:regenerated, learner:config:updated)
 * - changedFields includes expected keys
 * - persisted data (understanding, buffer) untouched
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertTrue,
	assertDefined,
	assertContains,
	assertEqual,
	assertEventEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

function dumpLearnerState(label: string, learner: any) {
	logger.logState(label, {
		instructions: learner.instructions,
		observePrompt: learner.getObserveSystemPrompt(),
		understandPrompt: learner.getUnderstandSystemPrompt(),
	})
}

async function main() {
	const brain = new Brain({
		prompt: 'Test brain for adjust eval',
		model: openrouter(MODEL),
	})
	await brain.initialize()

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 1: Additive — "also track X"
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 1: Additive — "also track React"')

	const learner = await brain.createLearnerFromConfig({
		id: 'adjust-text',
		name: 'Adjust Test',
		instructions: 'Track TypeScript patterns and best practices.',
		type: 'text' as const,
		governance: { strategy: 'continuous' as const },
		thresholds: { minImportance: 0.3, maxObservations: 10 },
	})

	const events: Array<{ type: string; payload?: any }> = []
	learner.on((event: { type: string; payload?: any }) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	dumpLearnerState('Before adjust', learner)

	const preObserve = learner.getObserveSystemPrompt()
	const preUnderstand = learner.getUnderstandSystemPrompt()
	const preInstructions = learner.instructions

	const result1 = await learner.adjust(
		'Also track React component patterns and hooks usage.',
	)

	dumpLearnerState('After additive adjust', learner)
	logger.logState('changedFields', result1.changedFields)

	// Structural: something changed
	assertTrue(learner.instructions !== preInstructions, 'Instructions changed')
	assertTrue(learner.getObserveSystemPrompt() !== preObserve, 'Observe prompt changed')
	assertTrue(learner.getUnderstandSystemPrompt() !== preUnderstand, 'Understand prompt changed')
	assertEventEmitted(events, 'learner:prompts:regenerated')
	assertEventEmitted(events, 'learner:config:updated', (p) => p.changedFields?.includes('instructions'))

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 2: Subtractive — "stop tracking X"
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 2: Subtractive — "stop tracking React"')

	const pre2 = learner.instructions
	dumpLearnerState('Before subtractive adjust', learner)

	await learner.adjust('Stop tracking React patterns. Focus only on TypeScript.')

	dumpLearnerState('After subtractive adjust', learner)

	assertTrue(learner.instructions !== pre2, 'Instructions changed after subtractive')

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 3: Full pivot — "only track X from now on"
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 3: Full pivot — "only track Python"')

	const pre3 = learner.instructions
	dumpLearnerState('Before pivot', learner)

	await learner.adjust(
		'From now on, only track Python best practices. Ignore everything else.',
	)

	dumpLearnerState('After pivot', learner)

	assertTrue(learner.instructions !== pre3, 'Instructions changed after pivot')

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 4: Behavioral tweak — "be stricter"
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 4: Behavioral tweak — "be stricter"')

	const pre4Observe = learner.getObserveSystemPrompt()
	dumpLearnerState('Before behavioral tweak', learner)

	await learner.adjust(
		'Be much stricter about what counts as a best practice. Only include well-established, widely-accepted patterns.',
	)

	dumpLearnerState('After behavioral tweak', learner)

	assertTrue(learner.getObserveSystemPrompt() !== pre4Observe, 'Observe prompt changed after tweak')

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 5: Data preservation — adjust doesn't touch stored data
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 5: Data preservation')

	const learner5 = await brain.createLearnerFromConfig({
		id: 'adjust-data',
		name: 'Data Preservation',
		instructions: 'Track cooking recipes and techniques.',
		type: 'text' as const,
		governance: { strategy: 'continuous' as const },
		thresholds: { minImportance: 0.1, maxObservations: 2 },
	})

	// Ingest data first
	await learner5.learn([
		'Searing meat at high heat creates a Maillard reaction that adds deep flavor.',
		'Resting meat after cooking allows juices to redistribute evenly.',
	])

	const preUnderstanding = await learner5.getUnderstanding()
	const preBuffer = await learner5.getBufferState()

	logger.logState('Pre-adjust (with data)', {
		understanding: typeof preUnderstanding === 'string'
			? preUnderstanding.slice(0, 200)
			: preUnderstanding,
		bufferCount: preBuffer.count,
		instructions: learner5.instructions,
	})

	await learner5.adjust('Also track baking techniques and pastry science.')

	const postUnderstanding = await learner5.getUnderstanding()
	const postBuffer = await learner5.getBufferState()

	logger.logState('Post-adjust (with data)', {
		understanding: typeof postUnderstanding === 'string'
			? postUnderstanding.slice(0, 200)
			: postUnderstanding,
		bufferCount: postBuffer.count,
		instructions: learner5.instructions,
		observePrompt: learner5.getObserveSystemPrompt(),
	})

	// These are hard guarantees — adjust must never touch stored data
	assertEqual(preUnderstanding, postUnderstanding, 'Understanding unchanged after adjust')
	assertEqual(preBuffer.count, postBuffer.count, 'Buffer count unchanged after adjust')

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 6: changedFields + events
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 6: changedFields and events')

	const learner6 = await brain.createLearnerFromConfig({
		id: 'adjust-events',
		name: 'Events Test',
		instructions: 'Track weather patterns.',
		type: 'text' as const,
		governance: { strategy: 'continuous' as const },
		thresholds: { minImportance: 0.3, maxObservations: 10 },
	})

	const events6: Array<{ type: string; payload?: any }> = []
	learner6.on((event: { type: string; payload?: any }) => {
		events6.push({ type: event.type, payload: event.payload })
	})

	const result6 = await learner6.adjust('Also track ocean currents.')

	logger.logState('changedFields', result6.changedFields)
	logger.logState('Events emitted', events6.map((e) => e.type))

	assertContains(result6.changedFields.join(','), 'instructions', 'changedFields has instructions')
	assertContains(result6.changedFields.join(','), 'observe_prompt', 'changedFields has observe_prompt')
	assertContains(result6.changedFields.join(','), 'understand_prompt', 'changedFields has understand_prompt')
	assertEventEmitted(events6, 'learner:prompts:regenerated')
	assertEventEmitted(events6, 'learner:config:updated')

	// ═══════════════════════════════════════════════════════════════════════
	// Scenario 7: List learner adjust
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Scenario 7: List learner adjust')

	const listLearner = await brain.createLearnerFromConfig({
		id: 'adjust-list',
		name: 'List Adjust Test',
		instructions: 'Track a list of team members and their roles.',
		type: 'list' as const,
		thresholds: { minImportance: 0.3, maxObservations: 5 },
	})

	dumpLearnerState('List learner before adjust', listLearner)

	const preListObserve = listLearner.getObserveSystemPrompt()

	await listLearner.adjust("Also track each person's preferred programming language.")

	dumpLearnerState('List learner after adjust', listLearner)

	assertTrue(listLearner.getObserveSystemPrompt() !== preListObserve, 'List observe prompt changed')

	// ═══════════════════════════════════════════════════════════════════════
	// Summary
	// ═══════════════════════════════════════════════════════════════════════

	logger.logSection('Summary')
	logger.logSuccess('All 7 scenarios completed — review dumps above for quality')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
