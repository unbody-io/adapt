/**
 * Eval: Brain Signal Buffering
 * Tests that Brain/Evaluator buffers signals and triggers evaluation at threshold
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertGreaterThan,
	assertEventEmitted,
	assertEventNotEmitted,
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

	// Create brain with signal threshold of 5
	const brain = new Brain({
		prompt: 'Test brain for signal buffering',
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

	logger.logState('Brain Config', {
		evaluatorSignalThreshold: brain.config.evolution?.evaluatorSignalThreshold,
		autoEvaluate: brain.config.evolution?.autoEvaluate,
	})

	logger.logSection('Action 1: Send 4 signals (below threshold)')

	for (let i = 1; i <= 4; i++) {
		brain.signal({
			source: 'test',
			description: `Test signal ${i} - below threshold`,
		})
		logger.logState(`Signal ${i} sent`, { signalCount: i })
	}

	// Wait a bit
	await new Promise((resolve) => setTimeout(resolve, 500))

	logger.logSection('After 4 Signals')

	const evaluationEvents1 = events.filter((e) => e.type === 'evaluator:evaluation:started')

	logger.logState('Evaluation Status', {
		evaluationsTriggered: evaluationEvents1.length,
	})

	logger.logSection('Action 2: Send 5th signal (triggers threshold)')

	brain.signal({
		source: 'test',
		description: 'Test signal 5 - should trigger evaluation',
	})

	logger.logState('Signal 5 sent', { signalCount: 5 })

	// Wait for evaluation to potentially trigger
	await new Promise((resolve) => setTimeout(resolve, 2000))

	logger.logSection('After 5 Signals')

	const evaluationStartedEvents = events.filter((e) => e.type === 'evaluator:evaluation:started')
	const evaluationCompletedEvents = events.filter(
		(e) => e.type === 'evaluator:evaluation:completed',
	)

	logger.logState('Evaluation Status', {
		evaluationsStarted: evaluationStartedEvents.length,
		evaluationsCompleted: evaluationCompletedEvents.length,
	})

	logger.logMetric('Evaluations triggered', evaluationEvents1.length, evaluationStartedEvents.length)

	logger.logSection('Assertions')

	// Verify no evaluation before threshold
	assertEqual(evaluationEvents1.length, 0, 'No evaluation triggered before threshold')

	// Verify signal received events (all 5)
	const signalReceivedEvents = events.filter((e) => e.type === 'brain:signal:received')
	assertEqual(signalReceivedEvents.length, 5, '5 signal:received events emitted')

	// Verify evaluation triggered after 5th signal
	assertGreaterThan(
		evaluationStartedEvents.length,
		0,
		'Evaluation triggered after reaching threshold',
	)

	// Verify evaluation completed
	assertEventEmitted(events, 'evaluator:evaluation:completed')

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
