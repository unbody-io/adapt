/**
 * Eval: Learner Signal - Stagnation
 * Tests learner emits signal when no synthesis happens for extended period
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

	// Create brain and learner
	const brain = new Brain({
		prompt: 'Test brain for signal testing',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		id: 'stagnant-learner',
		name: 'Stagnant Learner',
		description: 'A learner that will stagnate',
		instructions: 'You track software patterns.',
		type: 'text' as const,
		governance: {
			strategy: 'continuous' as const,
		},
		thresholds: {
			minImportance: 0.95, // Very high to prevent synthesis
			maxObservations: 100, // High to prevent synthesis via buffer
		},
		governance: {
			signalThresholds: {
				maxDismissalRate: 0.8,
				minConfidence: 0.3,
				maxObservationsWithoutSynthesis: 5, // Low threshold to trigger quickly
			},
		},
	})

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	logger.logState('Learner State', {
		name: learner.name,
		stagnationWindow: learner.getHealth().signalThresholds.maxObservationsWithoutSynthesis,
		minImportance: learner.getUnderstandThresholds().minImportance,
	})

	logger.logSection('Action: Ingest low-importance observations to trigger stagnation')

	const observations = [
		'Some random fact about programming.',
		'Another minor observation.',
		'Yet another trivial detail.',
		'More low-importance content.',
		'Additional unimportant information.',
		'Extra low-value observation.',
	]

	for (const text of observations) {
		await learner.learn([text])
		logger.logState('Ingested', {
			text: text.substring(0, 50) + '...',
		})
	}

	// Wait for signal emission
	await new Promise((resolve) => setTimeout(resolve, 1000))

	logger.logSection('After State')

	const signalEvents = events.filter((e) => e.type === 'learner:signal')
	const synthesisEvents = events.filter((e) => e.type === 'learner:synthesize:completed')

	logger.logState('Events Summary', {
		signalCount: signalEvents.length,
		synthesisCount: synthesisEvents.length,
		signals: signalEvents.map((e) => e.payload),
	})

	logger.logMetric('Signal events', 0, signalEvents.length)
	logger.logMetric('Synthesis events', 0, synthesisEvents.length)

	logger.logSection('Assertions')

	// Verify no synthesis happened
	assertTrue(synthesisEvents.length === 0, 'No synthesis occurred (stagnation)')

	// Verify signal was emitted
	assertGreaterThan(signalEvents.length, 0, 'At least one signal was emitted')

	// Verify stagnation signal specifically
	assertEventEmitted(
		events,
		'learner:signal',
		(payload) =>
			payload.description.toLowerCase().includes('synthesis') ||
			payload.description.toLowerCase().includes('stagnation') ||
			payload.description.toLowerCase().includes('no synthesis'),
	)

	// Verify the signal mentions observations
	const stagnationSignal = signalEvents.find(
		(e) =>
			e.payload.description.toLowerCase().includes('synthesis') ||
			e.payload.description.toLowerCase().includes('stagnation'),
	)
	assertTrue(!!stagnationSignal, 'Stagnation signal found')

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
