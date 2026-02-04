/**
 * Eval: Manual Delete Action
 * Tests brain.deleteLearner() for removing learners
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertEventEmitted,
	assertLearnerExists,
	assertLearnerDeleted,
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

	// Create brain
	const brain = new Brain({
		prompt: 'Test brain for manual delete',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Create a learner
	const learner = await brain.createLearnerFromConfig({
		name: 'Obsolete Learner',
		description: 'A learner that is no longer needed',
		instructions: 'You track information that is now irrelevant.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	logger.logSection('Before State')

	const beforeLearnerCount = brain.learners.size

	logger.logState('Brain Before Delete', {
		learnersCount: beforeLearnerCount,
		targetLearner: {
			id: learner.id,
			name: learner.name,
			description: learner.description,
		},
	})

	// Verify learner exists
	assertLearnerExists(brain, learner.id)

	logger.logSection('Action: Delete Learner')

	const guidance = 'Remove this learner as it is no longer relevant to the Brain\'s purpose.'

	await brain.deleteLearner(learner.id, guidance)

	logger.logSection('After State')

	const afterLearnerCount = brain.learners.size

	logger.logState('Brain After Delete', {
		learnersCount: afterLearnerCount,
		learnerDeleted: !brain.learners.has(learner.id),
	})

	logger.logMetric('Learners', beforeLearnerCount, afterLearnerCount)

	logger.logSection('Assertions')

	// Learner count assertions
	assertEqual(afterLearnerCount, beforeLearnerCount - 1, 'One learner was deleted')

	// Learner no longer exists
	assertLearnerDeleted(brain, learner.id)

	// Event assertions
	assertEventEmitted(
		events,
		'evolution:action:started',
		(payload) => payload.action === 'delete',
	)
	assertEventEmitted(
		events,
		'evolution:action:executed',
		(payload) =>
			payload.action === 'delete' && payload.result.deletedLearnerIds?.includes(learner.id),
	)

	assertEventEmitted(
		events,
		'brain:learner:removed',
		(payload) => payload.learnerId === learner.id,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
