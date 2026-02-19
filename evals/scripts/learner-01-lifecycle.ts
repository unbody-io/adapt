/**
 * Eval: Learner Lifecycle
 * Tests learner creation from config and initialization
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertDefined,
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

	// Create learner config
	const learnerConfig = {
		id: 'test-learner',
		name: 'Test Learner',
		description: 'A learner for testing lifecycle',
		instructions:
			'You are responsible for tracking information about TypeScript best practices and design patterns.',
		type: 'text' as const,
		governance: { strategy: 'continuous' as const },
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	}

	logger.logState('Learner Config', learnerConfig)

	logger.logSection('Before State')
	logger.logState('Learners', { count: 0, learners: [] })

	logger.logSection('Action: Create Learner')

	// Create a minimal brain just to use createLearnerFromConfig
	const brain = new Brain({
		prompt: 'Test brain for learner lifecycle',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Create learner using brain's internal method
	const learner = await brain.createLearnerFromConfig(learnerConfig)

	// Also subscribe to learner events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('After State')

	const afterState = {
		learner: {
			id: learner.id,
			name: learner.name,
			description: learner.description,
			instructions: learner.instructions,
			thresholds: learner.getSynthesizeThresholds(),
			governance: {
				activation: learner.getHealth().activation,
				status: learner.getHealth().status,
			},
		},
	}

	logger.logState('Learner Created', afterState)

	logger.logSection('Assertions')

	// Config assertions
	assertDefined(learner.id, 'Learner ID')
	assertEqual(learner.name, learnerConfig.name, 'Learner name matches config')
	assertEqual(
		learner.description,
		learnerConfig.description,
		'Learner description matches config',
	)
	assertEqual(
		learner.instructions,
		learnerConfig.instructions,
		'Learner instructions match config',
	)
	assertEqual(
		learner.getSynthesizeThresholds().minImportance,
		learnerConfig.thresholds.minImportance,
		'minImportance threshold matches',
	)
	assertEqual(
		learner.getSynthesizeThresholds().maxObservations,
		learnerConfig.thresholds.maxObservations,
		'maxObservations threshold matches',
	)

	// Governance assertions (defaults for new learners)
	assertEqual(learner.getHealth().activation, 0, 'Activation starts at 0 (dormant)')
	assertEqual(learner.getHealth().status, 'dormant', 'Status is dormant')

	// Event assertions
	assertEventEmitted(events, 'learner:init:started', (payload) => payload.learnerId === learner.id)
	assertEventEmitted(events, 'learner:init:completed', (payload) => payload.learnerId === learner.id)
	assertEventEmitted(events, 'brain:learner:added', (payload) => payload.name === learner.name)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
