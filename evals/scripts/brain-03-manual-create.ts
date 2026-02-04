/**
 * Eval: Manual Create Action
 * Tests brain.create() for manual learner creation
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertEventEmitted,
	assertLearnerExists,
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

	// Create and initialize brain
	const brain = new Brain({
		prompt: 'You help developers with software engineering',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeLearnerCount = brain.learners.size

	logger.logState('Brain Before Create', {
		learnersCount: beforeLearnerCount,
		learnerNames: Array.from(brain.learners.values()).map((l) => l.name),
	})

	logger.logSection('Action: Manual Create')

	const guidance =
		'Create a learner specialized in tracking Python best practices, including PEP8 conventions, pythonic idioms, and common design patterns.'

	logger.logState('Creation Guidance', { guidance })

	const newLearner = await brain.create(guidance)

	logger.logSection('After State')

	const afterLearnerCount = brain.learners.size

	const afterState = {
		learnersCount: afterLearnerCount,
		newLearner: {
			id: newLearner.id,
			name: newLearner.name,
			description: newLearner.description,
			instructions: newLearner.instructions,
			activation: newLearner.governance.activation,
			status: newLearner.governance.status,
		},
	}

	logger.logState('Brain After Create', afterState)
	logger.logMetric('Learners', beforeLearnerCount, afterLearnerCount)

	logger.logSection('Assertions')

	// Learner count assertion
	assertEqual(afterLearnerCount, beforeLearnerCount + 1, 'One new learner created')

	// Learner existence assertion
	assertLearnerExists(brain, newLearner.id)

	// Learner config assertions
	assertTrue(!!newLearner.id, 'New learner has ID')
	assertTrue(!!newLearner.name, 'New learner has name')
	assertTrue(!!newLearner.description, 'New learner has description')
	assertGreaterThan(newLearner.instructions.length, 20, 'New learner has instructions')

	// Verify learner is relevant to guidance
	const instructionsLower = newLearner.instructions.toLowerCase()
	assertTrue(
		instructionsLower.includes('python') ||
			instructionsLower.includes('pep') ||
			instructionsLower.includes('pythonic'),
		'Learner instructions are relevant to Python guidance',
	)

	// Governance assertions
	assertEqual(newLearner.governance.status, 'active', 'New learner is active')
	assertEqual(newLearner.governance.activation, 1.0, 'New learner activation is 1.0')

	// Verify learner is registered in brain
	const retrieved = brain.learners.get(newLearner.id)
	assertEqual(retrieved, newLearner, 'Learner is retrievable from brain.learners')

	// Event assertions
	assertEventEmitted(
		events,
		'evolution:action:started',
		(payload) => payload.action === 'create',
	)
	assertEventEmitted(
		events,
		'evolution:action:executed',
		(payload) =>
			payload.action === 'create' && payload.result.newLearnerIds.includes(newLearner.id),
	)
	assertEventEmitted(
		events,
		'brain:learner:added',
		(payload) => payload.learnerId === newLearner.id,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
