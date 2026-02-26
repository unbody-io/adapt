/**
 * Eval: Learner Learn & Understand
 * Tests learner.learn() → batching → understanding growth
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
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

	// Create brain and learner
	const brain = new Brain({
		prompt: 'Test brain for learning',
		model: openrouter(MODEL),
	})

	await brain.initialize()

	const learner = await brain.createLearnerFromConfig({
		id: 'typescript-learner',
		name: 'TypeScript Learner',
		description: 'Tracks TypeScript best practices',
		instructions: 'You track TypeScript patterns, idioms, and best practices.',
		type: 'text' as const,
		governance: {
			strategy: 'continuous' as const, // Synthesizes after each observation
		},
		thresholds: {
			minImportance: 0.3, // Low threshold to accept most observations
			maxObservations: 10,
		},
	})

	// Subscribe to events
	learner.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeUnderstanding = await learner.getUnderstanding()
	const beforeBuffer = learner.getBufferState()

	logger.logState('Before Learning', {
		understanding: beforeUnderstanding || '(empty)',
		understandingLength: beforeUnderstanding ? beforeUnderstanding.length : 0,
		bufferCount: beforeBuffer.count,
	})

	logger.logSection('Action 1: Ingest text (below synthesis threshold)')

	await learner.learn([
		'TypeScript interfaces are preferred over type aliases for object shapes because they can be extended and merged.',
	])

	const afterIngest1Buffer = learner.getBufferState()

	logger.logState('After First Ingest', {
		bufferCount: afterIngest1Buffer.count,
		understanding: (await learner.getUnderstanding()) || '(empty)',
	})

	logger.logMetric('Buffer observations', beforeBuffer.count, afterIngest1Buffer.count)

	logger.logSection('Action 2: Ingest more text (still below threshold)')

	await learner.learn([
		'Use readonly modifiers for properties that should not be mutated after initialization.',
	])

	const afterIngest2Buffer = learner.getBufferState()

	logger.logState('After Second Ingest', {
		bufferCount: afterIngest2Buffer.count,
		understanding: (await learner.getUnderstanding()) || '(empty)',
	})

	logger.logMetric('Buffer observations', afterIngest1Buffer.count, afterIngest2Buffer.count)

	logger.logSection('Action 3: Ingest text (triggers synthesis)')

	await learner.learn([
		'Prefer const assertions for literal types to maintain type precision without explicit annotations.',
	])

	// Wait a bit for async synthesis to complete
	await new Promise((resolve) => setTimeout(resolve, 2000))

	const afterSynthesisBuffer = learner.getBufferState()
	const afterSynthesisUnderstanding = await learner.getUnderstanding()

	logger.logState('After Synthesis', {
		bufferCount: afterSynthesisBuffer.count,
		understanding: afterSynthesisUnderstanding || '(empty)',
		understandingLength: afterSynthesisUnderstanding ? afterSynthesisUnderstanding.length : 0,
	})

	logger.logMetric('Buffer observations', afterIngest2Buffer.count, afterSynthesisBuffer.count)
	logger.logMetric(
		'Understanding length',
		beforeUnderstanding ? beforeUnderstanding.length : 0,
		afterSynthesisUnderstanding ? afterSynthesisUnderstanding.length : 0,
	)

	logger.logSection('Assertions')

	// With continuous strategy, buffer is cleared after each synthesis
	assertEqual(afterSynthesisBuffer.count, 0, 'Buffer cleared after synthesis')

	// Understanding assertions - should grow with each learn
	assertTrue(!!afterSynthesisUnderstanding, 'Understanding was generated')
	assertGreaterThan(
		afterSynthesisUnderstanding!.length,
		0,
		'Understanding has content after synthesis',
	)

	// Event assertions - verify observe and synthesize cycles
	assertEventEmitted(events, 'learner:observe:started')
	assertEventEmitted(events, 'learner:synthesize:started')
	assertEventEmitted(events, 'learner:synthesized')

	// Verify multiple observe events (one per learn call)
	const observeStartedEvents = events.filter((e) => e.type === 'learner:observe:started')
	assertEqual(observeStartedEvents.length, 3, 'Three observe cycles triggered')

	// Verify multiple synthesize events (continuous strategy synthesizes after each observe)
	const synthesizedEvents = events.filter((e) => e.type === 'learner:synthesized')
	assertEqual(synthesizedEvents.length, 3, 'Three synthesis cycles completed')

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
