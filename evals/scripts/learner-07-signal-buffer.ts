/**
 * Eval: Learner Signal - Buffer Overflow
 * Tests learner emits signal when buffer consistently exceeds threshold
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
		name: 'General Learner',
		description: 'Tracks everything',
		instructions: 'You track all software engineering topics.',
		thresholds: {
			minImportance: 0.9, // Very high to prevent synthesis
			maxObservations: 5, // Low max so buffer overflows easily
		},
		governance: {
			signalThresholds: {
				dismissalRate: 0.8,
				lowConfidence: 0.3,
				bufferOverflow: 1.2, // Low multiplier to trigger easily
				stagnationWindow: 100,
			},
		},
	})

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeBuffer = learner._buffer.getBufferState()

	logger.logState('Learner State', {
		name: learner.name,
		bufferCount: beforeBuffer.count,
		maxObservations: learner.getSynthesizeThresholds().maxObservations,
		bufferThreshold:
			learner.getSynthesizeThresholds().maxObservations *
			learner.getGovernance().signalThresholds.bufferOverflow,
	})

	logger.logSection('Action: Ingest many observations to overflow buffer')

	const observations = [
		'TypeScript provides static typing for JavaScript.',
		'React uses virtual DOM for efficient updates.',
		'Node.js enables server-side JavaScript execution.',
		'GraphQL provides flexible API query capabilities.',
		'Docker containers provide consistent environments.',
		'Kubernetes orchestrates containerized applications.',
		'PostgreSQL is a powerful relational database.',
		'Redis provides fast in-memory data storage.',
	]

	for (const text of observations) {
		await learner.ingest({ text })
		const bufferState = learner._buffer.getBufferState()
		logger.logState('After Ingest', {
			text: text.substring(0, 50) + '...',
			bufferCount: bufferState.count,
		})
	}

	// Wait for signal emission
	await new Promise((resolve) => setTimeout(resolve, 1000))

	logger.logSection('After State')

	const afterBuffer = learner._buffer.getBufferState()
	const signalEvents = events.filter((e) => e.type === 'learner:signal')

	logger.logState('Signals Emitted', {
		bufferCount: afterBuffer.count,
		signalCount: signalEvents.length,
		signals: signalEvents.map((e) => e.payload),
	})

	logger.logMetric('Buffer observations', beforeBuffer.count, afterBuffer.count)
	logger.logMetric('Signal events', 0, signalEvents.length)

	logger.logSection('Assertions')

	// Verify buffer grew
	assertGreaterThan(afterBuffer.count, beforeBuffer.count, 'Buffer has observations')

	// Verify signal was emitted
	assertGreaterThan(signalEvents.length, 0, 'At least one signal was emitted')

	// Verify buffer overflow signal specifically
	assertEventEmitted(
		events,
		'learner:signal',
		(payload) =>
			payload.description.toLowerCase().includes('buffer') &&
			payload.metrics?.bufferCount !== undefined,
	)

	// Verify the signal has correct structure
	const bufferSignal = signalEvents.find(
		(e) => e.payload.description.toLowerCase().includes('buffer'),
	)
	assertTrue(!!bufferSignal, 'Buffer overflow signal found')
	assertTrue(
		bufferSignal!.payload.metrics.bufferCount >
			learner.getSynthesizeThresholds().maxObservations *
				learner.getGovernance().signalThresholds.bufferOverflow,
		`Buffer count exceeds threshold (${bufferSignal!.payload.metrics.bufferCount})`,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
