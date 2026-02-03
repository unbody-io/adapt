/**
 * Eval: Brain Initialization
 * Tests brain initialization with prompt → learner decomposition
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertEventEmitted,
	assertDefined,
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

	const brainPrompt = `You are an AI system that helps developers learn and apply software engineering best practices.

You should track:
- TypeScript patterns and type safety techniques
- React component design and state management
- API design and RESTful principles
- Testing strategies and methodologies`

	logger.logState('Brain Prompt', { prompt: brainPrompt })

	logger.logSection('Before State')

	logger.logState('Pre-initialization', {
		learnersCount: 0,
	})

	logger.logSection('Action: Initialize Brain')

	const brain = new Brain({
		prompt: brainPrompt,
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 5,
			autoEvaluate: true,
		},
	})

	// Subscribe to events before initialization
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	await brain.initialize()

	logger.logSection('After State')

	const learners = Array.from(brain.learners.values())

	const afterState = {
		learnersCount: learners.length,
		learners: learners.map((l) => ({
			id: l.id,
			name: l.name,
			description: l.description,
			instructionsPreview: l.instructions.substring(0, 100) + '...',
			activation: l.getGovernance().activation,
			status: l.getGovernance().status,
		})),
	}

	logger.logState('Brain Initialized', afterState)

	logger.logMetric('Learners created', 0, learners.length)

	logger.logSection('Assertions')

	// Brain state assertions
	assertEqual(brain.prompt, brainPrompt, 'Brain prompt set correctly')

	// Learner decomposition assertions
	assertGreaterThan(learners.length, 0, 'At least one learner was created')
	assertTrue(
		learners.length >= 2 && learners.length <= 6,
		`Reasonable number of learners created (${learners.length})`,
	)

	// Verify each learner has valid config
	for (const learner of learners) {
		assertDefined(learner.id, `Learner ${learner.name} has ID`)
		assertDefined(learner.name, `Learner ${learner.id} has name`)
		assertDefined(learner.description, `Learner ${learner.name} has description`)
		assertDefined(learner.instructions, `Learner ${learner.name} has instructions`)
		assertGreaterThan(
			learner.instructions.length,
			20,
			`Learner ${learner.name} has meaningful instructions`,
		)
		// Newly created learners start dormant with activation 0 (earn activation through learning)
		assertEqual(learner.getGovernance().status, 'dormant', `Learner ${learner.name} starts dormant`)
		assertEqual(learner.getGovernance().activation, 0, `Learner ${learner.name} activation starts at 0`)
	}

	// Verify learners cover different aspects of the brain prompt
	const allInstructions = learners.map((l) => l.instructions.toLowerCase()).join(' ')
	assertTrue(
		allInstructions.includes('typescript') || allInstructions.includes('type'),
		'At least one learner covers TypeScript',
	)
	assertTrue(
		allInstructions.includes('react') || allInstructions.includes('component'),
		'At least one learner covers React',
	)

	// Event assertions
	assertEventEmitted(events, 'brain:init:started')
	assertEventEmitted(events, 'brain:init:completed')
	assertEventEmitted(events, 'brain:learner:added')

	// Verify learner creation events
	const learnerAddedEvents = events.filter((e) => e.type === 'brain:learner:added')
	assertEqual(
		learnerAddedEvents.length,
		learners.length,
		'One learner:added event per learner',
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
