/**
 * Eval: Learner Signal - High Dismissal Rate
 * Tests learner emits signal when dismissing too many observations
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

	// Create brain and learner with narrow focus
	const brain = new Brain({
		prompt: 'Test brain for signal testing',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		name: 'TypeScript Learner',
		description: 'Only tracks TypeScript syntax and type system features',
		instructions:
			'You ONLY track TypeScript syntax, type system features, and compiler behavior. Dismiss anything about React, APIs, databases, or other topics.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
		governance: {
			signalThresholds: {
				dismissalRate: 0.7, // Low threshold to trigger easily
				lowConfidence: 0.3,
				bufferOverflow: 1.5,
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

	logger.logState('Learner State', {
		name: learner.name,
		instructions: learner.instructions.substring(0, 100) + '...',
		dismissalThreshold: learner.getGovernance().signalThresholds.dismissalRate,
	})

	logger.logSection('Action: Ingest irrelevant observations to trigger dismissals')

	const irrelevantObservations = [
		'React hooks are a powerful way to manage component state.',
		'REST APIs should follow HATEOAS principles for discoverability.',
		'MongoDB uses BSON format for document storage.',
		'Docker containers provide process isolation for applications.',
		'Kubernetes orchestrates containerized workloads across clusters.',
		'GraphQL allows clients to request exactly the data they need.',
		'PostgreSQL supports advanced indexing strategies like GIN and GiST.',
		'Redis can be used as a cache or message broker.',
		'AWS Lambda supports serverless function execution.',
		'Microservices architecture enables independent deployment.',
	]

	for (const text of irrelevantObservations) {
		await learner.ingest({ text })
		logger.logState('Ingested', { text: text.substring(0, 50) + '...' })
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

	// Verify dismissal signal specifically
	assertEventEmitted(
		events,
		'learner:signal',
		(payload) =>
			payload.description.toLowerCase().includes('dismiss') &&
			payload.metrics?.dismissalRate !== undefined,
	)

	// Verify the signal has correct structure
	const dismissalSignal = signalEvents.find(
		(e) => e.payload.description.toLowerCase().includes('dismiss'),
	)
	assertTrue(!!dismissalSignal, 'Dismissal signal found')
	assertTrue(
		dismissalSignal!.payload.metrics.dismissalRate > 0.7,
		`Dismissal rate is high (${dismissalSignal!.payload.metrics.dismissalRate})`,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
