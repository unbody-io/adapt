/**
 * Eval: Brain Update
 * Tests brain.update() with the 3-category field system:
 * 1. Brain-only fields (evolution config)
 * 2. Mechanical cascade (model changes → learner.update())
 * 3. Signal-driven (prompt change → evaluator)
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertEventEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function main() {
	logger.logSection('Setup')

	// Event collector
	const events: Array<{ type: string; payload?: any }> = []

	const initialPrompt = 'You help developers learn TypeScript best practices.'

	// Create brain
	const brain = new Brain({
		prompt: initialPrompt,
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 5,
			autoEvaluate: true,
		},
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeState = {
		prompt: brain.prompt,
		evolutionEnabled: brain.config.evolution?.enabled,
		evaluatorSignalThreshold: brain.config.evolution?.evaluatorSignalThreshold,
		learnersCount: brain.learners.size,
	}

	logger.logState('Brain Before Update', beforeState)

	// ── Category 1: Brain-only fields ──

	logger.logSection('Action 1: Update Evolution Config (Brain-only)')

	const configResult = await brain.update({
		evolution: {
			evaluatorSignalThreshold: 10,
			autoEvaluate: false,
		},
	})

	logger.logState('Config Update Result', {
		changedFields: configResult.changedFields,
		learnerResults: configResult.learnerResults,
	})

	assertEqual(
		brain.config.evolution?.evaluatorSignalThreshold,
		10,
		'Evaluator signal threshold was updated',
	)
	assertEqual(brain.config.evolution?.autoEvaluate, false, 'Auto-evaluate was disabled')
	assertTrue(
		configResult.changedFields.includes('evolution.evaluatorSignalThreshold'),
		'changedFields includes evolution.evaluatorSignalThreshold',
	)
	assertTrue(
		configResult.changedFields.includes('evolution.autoEvaluate'),
		'changedFields includes evolution.autoEvaluate',
	)
	assertEqual(configResult.learnerResults.length, 0, 'No learner results for brain-only update')

	assertEventEmitted(
		events,
		'brain:config:updated',
		(payload) => payload.changedFields.includes('evolution.evaluatorSignalThreshold'),
	)

	// ── Category 2: Mechanical cascade ──

	logger.logSection('Action 2: Update Model (Mechanical Cascade)')

	const newModel = openrouter(MODEL) // Same provider, tests the cascade path
	const modelResult = await brain.update({
		model: newModel,
	})

	logger.logState('Model Update Result', {
		changedFields: modelResult.changedFields,
		learnerResultCount: modelResult.learnerResults.length,
		learnerResults: modelResult.learnerResults.map(r => ({
			learnerId: r.learnerId,
			changedFields: r.changedFields,
		})),
	})

	assertTrue(
		modelResult.changedFields.includes('model'),
		'changedFields includes model',
	)
	assertEqual(
		modelResult.learnerResults.length,
		brain.learners.size,
		'All learners received update',
	)
	// Each learner should report model as changed
	for (const lr of modelResult.learnerResults) {
		assertTrue(
			lr.changedFields.includes('model'),
			`Learner ${lr.learnerId} reports model changed`,
		)
	}

	// ── Category 3: Signal-driven ──

	logger.logSection('Action 3: Update Prompt (Signal-driven)')

	// Re-enable autoEvaluate for this test
	await brain.update({ evolution: { autoEvaluate: true } })

	const newPrompt = 'You help developers learn TypeScript, React, and Node.js best practices.'
	const promptResult = await brain.update({
		prompt: newPrompt,
	})

	logger.logState('Prompt Update Result', {
		changedFields: promptResult.changedFields,
		hasEvolutionResults: !!promptResult.evolutionResults,
		evolutionResults: promptResult.evolutionResults,
	})

	assertEqual(brain.prompt, newPrompt, 'Prompt was updated')
	assertEqual(brain.config.prompt, newPrompt, 'Config prompt was updated')
	assertTrue(
		promptResult.changedFields.includes('prompt'),
		'changedFields includes prompt',
	)

	// Signal should have been emitted
	assertEventEmitted(
		events,
		'brain:signal:received',
		(payload) =>
			payload.source === 'brain' && payload.description.includes('SYSTEM DIRECTIVE'),
	)

	// Evolution should have been triggered (bypass signal)
	if (promptResult.evolutionResults) {
		logger.logState('Evolution Results', promptResult.evolutionResults)
		assertTrue(
			Array.isArray(promptResult.evolutionResults.decisions),
			'evolutionResults has decisions array',
		)
	}

	// ── Return type validation ──

	logger.logSection('Return Type Validation')

	assertTrue(Array.isArray(promptResult.changedFields), 'changedFields is array')
	assertTrue(promptResult.config !== undefined, 'config is present')
	assertTrue(Array.isArray(promptResult.learnerResults), 'learnerResults is array')
	assertEqual(promptResult.config.prompt, newPrompt, 'Returned config has updated prompt')

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
