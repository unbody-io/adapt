/**
 * Eval: Learner Update
 * Tests learner.update() with config changes and immutability validation
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertEventEmitted,
	assertContains,
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
		prompt: 'Test brain for learner updates',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		id: 'original-learner',
		name: 'Original Name',
		description: 'Original description',
		instructions: 'Original instructions about tracking TypeScript patterns.',
		type: 'text' as const,
		governance: {
			strategy: 'continuous' as const,
		},
		thresholds: {
			minImportance: 0.5,
			maxObservations: 10,
		},
	})

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeState = {
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions,
		thresholds: learner.getSynthesizeThresholds(),
		hasObservePrompt: !!learner.getObserveSystemPrompt(),
		hasSynthesizePrompt: !!learner.getSynthesizeSystemPrompt(),
	}

	logger.logState('Learner Before Update', beforeState)

	logger.logSection('Action 1: Update name and description')

	await learner.update({
		name: 'Updated Name',
		description: 'Updated description with more details',
	})

	logger.logSection('After State 1')

	const afterState1 = {
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions,
		thresholds: learner.getSynthesizeThresholds(),
	}

	logger.logState('Learner After Name/Description Update', afterState1)
	logger.logMetric('Name changed', 0, 1)
	logger.logMetric('Description changed', 0, 1)

	logger.logSection('Action 2: Update instructions (triggers prompt regeneration)')

	const oldObservePrompt = learner.getObserveSystemPrompt()
	const oldSynthesizePrompt = learner.getSynthesizeSystemPrompt()

	await learner.update({
		instructions:
			'You are now responsible for tracking React best practices and component patterns.',
	})

	logger.logSection('After State 2')

	const afterState2 = {
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions,
		thresholds: learner.getSynthesizeThresholds(),
		observePromptChanged: oldObservePrompt !== learner.getObserveSystemPrompt(),
		synthesizePromptChanged:
			oldSynthesizePrompt !== learner.getSynthesizeSystemPrompt(),
	}

	logger.logState('Learner After Instructions Update', afterState2)

	logger.logSection('Action 3: Update thresholds')

	await learner.update({
		synthesize: {
			thresholds: {
				minImportance: 0.7,
				maxObservations: 20,
			},
		},
	})

	logger.logSection('After State 3')

	const afterState3 = {
		thresholds: learner.getSynthesizeThresholds(),
	}

	logger.logState('Learner After Threshold Update', afterState3)
	logger.logMetric('minImportance', 0.5, 0.7)
	logger.logMetric('maxObservations', 10, 20)

	logger.logSection('Action 4: Test immutability (should fail)')

	let immutabilityError: Error | null = null

	try {
		// Try to update immutable field (id)
		await (learner as any).update({ id: 'new-id' })
	} catch (error) {
		immutabilityError = error as Error
		logger.logState('Expected Error Caught', {
			message: immutabilityError.message,
		})
	}

	logger.logSection('Assertions')

	// Name and description update assertions
	assertEqual(learner.name, 'Updated Name', 'Name was updated')
	assertEqual(
		learner.description,
		'Updated description with more details',
		'Description was updated',
	)

	// Instructions update assertions
	assertContains(
		learner.instructions,
		'React best practices',
		'Instructions contain new content',
	)
	assertTrue(afterState2.observePromptChanged, 'Observe prompt was regenerated')
	assertTrue(afterState2.synthesizePromptChanged, 'Synthesize prompt was regenerated')

	// Threshold update assertions
	assertEqual(learner.getSynthesizeThresholds().minImportance, 0.7, 'minImportance was updated')
	assertEqual(
		learner.getSynthesizeThresholds().maxObservations,
		20,
		'maxObservations was updated',
	)

	// Event assertions
	assertEventEmitted(
		events,
		'learner:config:updated',
		(payload) => payload.changedFields?.includes('name'),
	)
	assertEventEmitted(
		events,
		'learner:config:updated',
		(payload) => payload.changedFields?.includes('instructions'),
	)
	assertEventEmitted(events, 'learner:prompts:regenerated')

	// Immutability assertion (only id is immutable now)
	assertTrue(!!immutabilityError, 'Immutability violation threw error for id')
	assertContains(immutabilityError!.message, 'immutable', 'Error message mentions immutability')

	logger.logSection('Action 5: Model swap (should succeed — no longer immutable)')

	const modelUpdateResult = await learner.update({
		model: openrouter(MODEL), // same model instance, but verifies no error
	})
	assertTrue(
		modelUpdateResult.changedFields.includes('model'),
		'Model change recorded in changedFields',
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
