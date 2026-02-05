/**
 * Eval: Organic Evolution
 * Tests complete end-to-end evolution flow: learner signal → buffering → evaluation → action execution
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
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

	// Create brain with evolution enabled
	const brain = new Brain({
		prompt: 'You track software development best practices.',
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 3, // Low threshold for easier triggering
			autoEvaluate: true,
		},
	})

	await brain.initialize()

	// Subscribe to ALL events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Also subscribe to learner events
	for (const learner of brain.learners.values()) {
		learner.on((event) => {
			events.push({ type: event.type, payload: event.payload })
			logger.logEvent({ type: event.type, payload: event.payload })
		})
	}

	logger.logSection('Before State')

	const beforeLearnerCount = brain.learners.size

	logger.logState('Brain Initial State', {
		learnersCount: beforeLearnerCount,
		evolutionEnabled: brain.config.evolution?.enabled,
		signalThreshold: brain.config.evolution?.evaluatorSignalThreshold,
	})

	logger.logSection('Action: Trigger Organic Evolution via Signals')

	// Send manual signals to trigger evolution
	// (In reality, these would come from learner metrics)
	brain.signal({
		source: 'test-signal-1',
		description: 'We need better coverage of Python best practices. Current learners focus too much on JavaScript.',
	})

	brain.signal({
		source: 'test-signal-2',
		description: 'Database learner is getting low confidence queries. It might be too broad.',
	})

	brain.signal({
		source: 'test-signal-3',
		description: 'API design learner has high dismissal rate. Scope might be too narrow.',
	})

	logger.logState('Signals Sent', { count: 3, threshold: 3 })

	// Wait for evaluation and execution
	await new Promise((resolve) => setTimeout(resolve, 10000))

	logger.logSection('After Evolution')

	const afterLearnerCount = brain.learners.size

	logger.logState('Brain After Evolution', {
		learnersCount: afterLearnerCount,
		learnerCountChanged: afterLearnerCount !== beforeLearnerCount,
	})

	logger.logMetric('Learners', beforeLearnerCount, afterLearnerCount)

	// Collect evolution events
	const signalReceivedEvents = events.filter((e) => e.type === 'brain:signal:received')
	const evaluationStartedEvents = events.filter((e) => e.type === 'evaluator:evaluation:started')
	const evaluationCompletedEvents = events.filter((e) => e.type === 'evaluator:evaluation:completed')
	const actionStartedEvents = events.filter((e) => e.type === 'evolution:action:started')
	const actionExecutedEvents = events.filter((e) => e.type === 'evolution:action:executed')

	logger.logState('Evolution Events Summary', {
		signalsReceived: signalReceivedEvents.length,
		evaluationsStarted: evaluationStartedEvents.length,
		evaluationsCompleted: evaluationCompletedEvents.length,
		actionsStarted: actionStartedEvents.length,
		actionsExecuted: actionExecutedEvents.length,
	})

	logger.logSection('Assertions')

	// Signal buffering assertions
	assertGreaterThan(signalReceivedEvents.length, 0, 'Signals were received')
	assertEventEmitted(events, 'brain:signal:received')

	// Evaluation assertions
	assertGreaterThan(evaluationStartedEvents.length, 0, 'Evaluation was triggered')
	assertEventEmitted(events, 'evaluator:evaluation:started')
	assertEventEmitted(events, 'evaluator:evaluation:completed')

	// Action execution assertions (if any decisions were made)
	if (actionExecutedEvents.length > 0) {
		logger.logSuccess('Evolution actions were executed!')
		assertEventEmitted(events, 'evolution:action:started')
		assertEventEmitted(events, 'evolution:action:executed')

		// Log what actions were taken
		for (const actionEvent of actionExecutedEvents) {
			logger.logState('Action Executed', {
				action: actionEvent.payload.action,
				reasoning: actionEvent.payload.reasoning,
				targets: actionEvent.payload.targets,
			})
		}
	} else {
		logger.logWarning('No evolution actions were executed (Evaluator decided no changes needed)')
	}

	// Complete flow assertion
	assertTrue(
		evaluationCompletedEvents.length > 0,
		'Complete organic evolution flow executed (signal → evaluation → decision)',
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
