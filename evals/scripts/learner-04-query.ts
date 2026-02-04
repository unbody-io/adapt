/**
 * Eval: Learner Query
 * Tests learner.ask() → context retrieval → response synthesis
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
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

	// Create brain and learner
	const brain = new Brain({
		prompt: 'Test brain for queries',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		name: 'TypeScript Learner',
		description: 'Tracks TypeScript best practices',
		instructions: 'You track TypeScript patterns, idioms, and best practices.',
		thresholds: {
			minImportance: 0.6,
			maxObservations: 10,
		},
	})

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	// Pre-populate understanding so queries have context
	await learner.setUnderstanding(`TypeScript Best Practices:

1. Use interfaces for object shapes - they are more flexible and can be extended
2. Apply readonly modifiers to prevent unintended mutations
3. Leverage const assertions for literal types to maintain type precision
4. Prefer type inference over explicit annotations when types are obvious
5. Use discriminated unions for type-safe state machines`)

	logger.logSection('Before State')

	const beforeUnderstanding = learner.getUnderstanding()

	logger.logState('Learner State', {
		hasUnderstanding: !!beforeUnderstanding,
		understandingLength: beforeUnderstanding?.length || 0,
		understanding: beforeUnderstanding?.substring(0, 200) + '...',
	})

	logger.logSection('Action 1: Query with relevant question')

	const query1 = 'What TypeScript features help prevent mutations?'

	const response1 = await learner.ask(query1)

	logger.logState('Query 1 Response', {
		query: query1,
		response: response1,
		responseLength: response1.length,
	})

	logger.logSection('Action 2: Query with another question')

	const query2 = 'How should I handle type-safe state in TypeScript?'

	const response2 = await learner.ask(query2)

	logger.logState('Query 2 Response', {
		query: query2,
		response: response2,
		responseLength: response2.length,
	})

	logger.logSection('Action 3: Query with irrelevant question')

	const query3 = 'What is the capital of France?'

	const response3 = await learner.ask(query3)

	logger.logState('Query 3 Response (irrelevant)', {
		query: query3,
		response: response3,
		responseLength: response3.length,
	})

	logger.logSection('Assertions')

	// Response assertions
	assertDefined(response1, 'Query 1 returned a response')
	assertGreaterThan(response1.length, 10, 'Query 1 response has content')
	assertTrue(
		response1.toLowerCase().includes('readonly') ||
			response1.toLowerCase().includes('mutation') ||
			response1.toLowerCase().includes('immutable'),
		'Query 1 response is relevant to mutations',
	)

	assertDefined(response2, 'Query 2 returned a response')
	assertGreaterThan(response2.length, 10, 'Query 2 response has content')
	assertTrue(
		response2.toLowerCase().includes('union') || response2.toLowerCase().includes('state'),
		'Query 2 response is relevant to state',
	)

	assertDefined(response3, 'Query 3 returned a response')
	// Irrelevant query should return a short dismissal or empty response
	assertTrue(
		response3.length < 100 || response3.includes('not') || response3.includes('cannot'),
		'Query 3 response acknowledges irrelevance',
	)

	// Event assertions - verify query events were emitted
	const queryEvents = events.filter((e) => e.type === 'learner:query:started')
	assertGreaterThan(queryEvents.length, 0, 'Query events were emitted')

	assertEventEmitted(events, 'learner:query:started')
	assertEventEmitted(events, 'learner:query:completed')

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
