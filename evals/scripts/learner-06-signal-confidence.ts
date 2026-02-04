/**
 * Eval: Learner Signal - Low Confidence
 * Tests learner emits signal when query confidence is consistently low
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertTrue,
	assertEventEmitted,
	assertGreaterThan,
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

	// Create brain and learner with minimal understanding
	const brain = new Brain({
		prompt: 'Test brain for signal testing',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		name: 'Python Learner',
		description: 'Tracks Python best practices',
		instructions: 'You track Python programming patterns and idioms.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
		governance: {
			signalThresholds: {
				dismissalRate: 0.8,
				lowConfidence: 0.4, // Higher threshold to trigger more easily
				bufferOverflow: 1.5,
				stagnationWindow: 100,
			},
		},
	})

	// Set minimal understanding so queries will have low confidence
	await learner.setUnderstanding(
		'Python is a programming language. It has variables and functions.',
	)

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	logger.logState('Learner State', {
		name: learner.name,
		understanding: learner.getUnderstanding()?.substring(0, 100) + '...',
		confidenceThreshold: learner.getGovernance().signalThresholds.lowConfidence,
	})

	logger.logSection('Action: Ask complex questions to trigger low confidence')

	const complexQuestions = [
		'What are the best practices for async/await in Python?',
		'How should I structure a large Django application?',
		'What are the performance implications of list comprehensions vs generators?',
		'When should I use metaclasses in Python?',
		'What are the differences between @staticmethod and @classmethod decorators?',
	]

	for (const question of complexQuestions) {
		await learner.ask(question)
		logger.logState('Asked', { question: question.substring(0, 50) + '...' })
	}

	// Wait for signal emission
	await new Promise((resolve) => setTimeout(resolve, 1000))

	logger.logSection('After State')

	const signalEvents = events.filter((e) => e.type === 'learner:signal')

	logger.logState('Signals Emitted', {
		count: signalEvents.length,
		signals: signalEvents.map((e) => e.payload),
	})

	logger.logMetric('Signal events', 0, signalEvents.length)

	logger.logSection('Assertions')

	// Verify signal was emitted
	assertGreaterThan(signalEvents.length, 0, 'At least one signal was emitted')

	// Verify low confidence signal specifically
	assertEventEmitted(
		events,
		'learner:signal',
		(payload) =>
			payload.description.toLowerCase().includes('confidence') &&
			payload.metrics?.avgConfidence !== undefined,
	)

	// Verify the signal has correct structure
	const confidenceSignal = signalEvents.find(
		(e) => e.payload.description.toLowerCase().includes('confidence'),
	)
	assertTrue(!!confidenceSignal, 'Low confidence signal found')
	assertTrue(
		confidenceSignal!.payload.metrics.avgConfidence < 0.4,
		`Average confidence is low (${confidenceSignal!.payload.metrics.avgConfidence})`,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
