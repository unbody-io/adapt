/**
 * Eval: Manual Update Action
 * Tests brain.updateLearner() for modifying learner configuration
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
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

	// Create brain
	const brain = new Brain({
		prompt: 'Test brain for manual update',
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
		id: 'typescript-learner',
		name: 'TypeScript Learner',
		description: 'Tracks TypeScript basics',
		instructions: 'You track basic TypeScript syntax and type system features.',
		type: 'text' as const,
		governance: {
			strategy: 'continuous' as const,
		},
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	logger.logSection('Before State')

	const beforeState = {
		id: learner.id,
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions,
		thresholds: learner.getSynthesizeThresholds(),
	}

	logger.logState('Learner Before Update', beforeState)

	logger.logSection('Action: Update Learner to Expand Scope')

	const guidance = 'Expand this learner to also track advanced TypeScript features like conditional types, mapped types, and template literal types.'

	const updatedLearner = await brain.updateLearner(learner.id, guidance)

	logger.logSection('After State')

	const afterState = {
		id: updatedLearner.id,
		name: updatedLearner.name,
		description: updatedLearner.description,
		instructions: updatedLearner.instructions,
		thresholds: updatedLearner.getSynthesizeThresholds(),
	}

	logger.logState('Learner After Update', afterState)

	logger.logSection('Assertions')

	// Learner identity preserved
	assertEqual(updatedLearner.id, learner.id, 'Learner ID unchanged')

	// Config was updated
	assertTrue(
		updatedLearner.instructions !== beforeState.instructions,
		'Instructions were updated',
	)

	// Verify expanded scope in instructions
	const instructionsLower = updatedLearner.instructions.toLowerCase()
	assertTrue(
		instructionsLower.includes('advanced') ||
			instructionsLower.includes('conditional') ||
			instructionsLower.includes('mapped') ||
			instructionsLower.includes('template'),
		'Instructions now mention advanced TypeScript features',
	)

	// Event assertions
	assertEventEmitted(
		events,
		'evolution:action:started',
		(payload) => payload.action === 'update',
	)
	assertEventEmitted(
		events,
		'evolution:action:executed',
		(payload) =>
			payload.action === 'update' && payload.result.updatedLearnerIds?.includes(learner.id),
	)

	// Learner update events
	assertEventEmitted(
		events,
		'learner:config:updated',
		(payload) => payload.learnerId === learner.id,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
