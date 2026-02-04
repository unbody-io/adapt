/**
 * Eval: Manual Merge Action
 * Tests brain.merge() for combining multiple learners
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
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
		prompt: 'Test brain for manual merge',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Create two learners with overlapping domains
	const learner1 = await brain.createLearnerFromConfig({
		name: 'React Hooks Learner',
		description: 'Tracks React hooks patterns',
		instructions: 'You track React hooks usage patterns and best practices.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	const learner2 = await brain.createLearnerFromConfig({
		name: 'React State Learner',
		description: 'Tracks React state management',
		instructions: 'You track React state management approaches and patterns.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	// Give them some understanding
	await learner1.setUnderstanding('React hooks like useState and useEffect manage component state and lifecycle.')
	await learner2.setUnderstanding('React state can be managed with Context API, Redux, or local state.')

	logger.logSection('Before State')

	const beforeLearnerCount = brain.learners.size

	logger.logState('Brain Before Merge', {
		learnersCount: beforeLearnerCount,
		learner1: {
			id: learner1.id,
			name: learner1.name,
			understanding: learner1.getUnderstanding()?.substring(0, 50) + '...',
		},
		learner2: {
			id: learner2.id,
			name: learner2.name,
			understanding: learner2.getUnderstanding()?.substring(0, 50) + '...',
		},
	})

	logger.logSection('Action: Merge Two Learners')

	const guidance = 'Merge these two learners into a unified React learner that covers both hooks and state management.'

	const mergedLearner = await brain.merge([learner1.id, learner2.id], guidance)

	logger.logSection('After State')

	const afterLearnerCount = brain.learners.size

	const afterState = {
		learnersCount: afterLearnerCount,
		mergedLearner: {
			id: mergedLearner.id,
			name: mergedLearner.name,
			description: mergedLearner.description,
			instructions: mergedLearner.instructions.substring(0, 100) + '...',
			understanding: mergedLearner.getUnderstanding()?.substring(0, 100) + '...',
		},
	}

	logger.logState('Brain After Merge', afterState)
	logger.logMetric('Learners', beforeLearnerCount, afterLearnerCount)

	logger.logSection('Assertions')

	// Learner count assertions
	assertEqual(afterLearnerCount, beforeLearnerCount - 1, 'Two learners merged into one')

	// Old learners deleted
	assertLearnerDeleted(brain, learner1.id)
	assertLearnerDeleted(brain, learner2.id)

	// New learner exists
	assertLearnerExists(brain, mergedLearner.id)

	// New learner has valid config
	assertTrue(!!mergedLearner.name, 'Merged learner has name')
	assertGreaterThan(mergedLearner.instructions.length, 20, 'Merged learner has instructions')

	// New learner understanding combines both
	const understanding = mergedLearner.getUnderstanding()
	assertTrue(!!understanding, 'Merged learner has understanding')
	assertGreaterThan(understanding!.length, 50, 'Merged understanding is substantial')

	// Event assertions
	assertEventEmitted(
		events,
		'evolution:action:started',
		(payload) => payload.action === 'merge',
	)
	assertEventEmitted(
		events,
		'evolution:action:executed',
		(payload) =>
			payload.action === 'merge' &&
			payload.result.deletedLearnerIds?.length === 2 &&
			payload.result.newLearnerIds?.includes(mergedLearner.id),
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
