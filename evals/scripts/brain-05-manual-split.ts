/**
 * Eval: Manual Split Action
 * Tests brain.split() for dividing a learner into multiple focused learners
 */

import { Brain } from '../../src/brain/class'
import { TextLearner } from '../../src/learners'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertEventEmitted,
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
		prompt: 'Test brain for manual split',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Create a broad learner
	const broadLearner = await brain.createLearnerFromConfig({
		id: 'web-dev-learner',
		name: 'Web Development Learner',
		description: 'Tracks everything about web development',
		instructions: 'You track all aspects of web development including frontend, backend, databases, and deployment.',
		type: 'text' as const,
		governance: {
			strategy: 'continuous' as const,
		},
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	// Give it understanding that spans multiple domains
	await broadLearner.setUnderstanding(`Web Development Knowledge:

Frontend: React, Vue, Angular for building user interfaces. CSS frameworks like Tailwind. State management with Redux.

Backend: Node.js with Express, Python with Django/Flask. RESTful APIs and GraphQL endpoints.

Databases: PostgreSQL for relational data, MongoDB for documents. Redis for caching.

Deployment: Docker containers, Kubernetes orchestration, AWS/GCP cloud platforms.`)

	logger.logSection('Before State')

	const beforeLearnerCount = brain.learners.size

	logger.logState('Brain Before Split', {
		learnersCount: beforeLearnerCount,
		broadLearner: {
			id: broadLearner.id,
			name: broadLearner.name,
			understanding: (await broadLearner.getUnderstanding())?.substring(0, 150) + '...',
		},
	})

	logger.logSection('Action: Split Into Focused Learners')

	const guidance = 'Split this overly broad learner into two focused learners: one for frontend development (React, state, UI) and one for backend development (APIs, databases, deployment).'

	const newLearners = await brain.splitLearner(broadLearner.id, guidance)

	logger.logSection('After State')

	const afterLearnerCount = brain.learners.size

	const afterState = {
		learnersCount: afterLearnerCount,
		newLearners: await Promise.all(newLearners.map(async (l: TextLearner) => ({
			id: l.id,
			name: l.name,
			description: l.description,
			instructionsPreview: l.instructions.substring(0, 80) + '...',
			understandingPreview: (await l.getUnderstanding())?.substring(0, 80) + '...',
		}))),
	}

	logger.logState('Brain After Split', afterState)
	logger.logMetric('Learners', beforeLearnerCount, afterLearnerCount)

	logger.logSection('Assertions')

	// Learner count assertions
	assertEqual(newLearners.length, 2, 'Split produced 2 new learners')
	assertEqual(afterLearnerCount, beforeLearnerCount + 1, 'Net gain of 1 learner (1 deleted, 2 created)')

	// Old learner deleted
	assertLearnerDeleted(brain, broadLearner.id)

	// New learners have valid configs
	for (const learner of newLearners) {
		assertTrue(!!learner.name, `Learner ${learner.id} has name`)
		assertTrue(!!learner.description, `Learner ${learner.id} has description`)
		assertGreaterThan(learner.instructions.length, 20, `Learner ${learner.id} has instructions`)

		const understanding = await learner.getUnderstanding()
		assertTrue(!!understanding, `Learner ${learner.id} has understanding`)
		assertGreaterThan(understanding!.length, 30, `Learner ${learner.id} understanding is substantial`)
	}

	// Verify learners have different focuses
	const allInstructions = newLearners.map((l: TextLearner) => l.instructions.toLowerCase()).join(' ')
	assertTrue(
		allInstructions.includes('frontend') || allInstructions.includes('react') || allInstructions.includes('ui'),
		'At least one learner covers frontend',
	)
	assertTrue(
		allInstructions.includes('backend') || allInstructions.includes('api') || allInstructions.includes('database'),
		'At least one learner covers backend',
	)

	// Event assertions
	assertEventEmitted(
		events,
		'evolution:action:started',
		(payload) => payload.action === 'split',
	)
	assertEventEmitted(
		events,
		'evolution:action:executed',
		(payload) =>
			payload.action === 'split' &&
			payload.result.deletedLearnerIds?.includes(broadLearner.id) &&
			payload.result.newLearnerIds?.length === 2,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
