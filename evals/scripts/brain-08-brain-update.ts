/**
 * Eval: Brain Update
 * Tests brain.update() for modifying brain configuration and prompt
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

	const initialPrompt = 'You help developers learn TypeScript best practices.'

	// Create brain
	const brain = new Brain({
		prompt: initialPrompt,
		model: openrouter(MODEL),
		config: {
			evolution: {
				enabled: true,
				evaluatorSignalThreshold: 5,
				autoEvaluate: true,
			},
		},
	})

	await brain.initialize()

	// Subscribe to events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
		logger.logEvent({ type: event.type, payload: event.payload })
	})

	logger.logSection('Before State')

	const beforeState = {
		prompt: brain.prompt,
		evolutionEnabled: brain.config.evolution?.enabled,
		evaluatorSignalThreshold: brain.config.evolution?.evaluatorSignalThreshold,
		learnersCount: brain.learners.size,
	}

	logger.logState('Brain Before Update', beforeState)

	logger.logSection('Action 1: Update Brain Prompt')

	const newPrompt = 'You help developers learn TypeScript, React, and Node.js best practices.'

	await brain.update({
		prompt: newPrompt,
	})

	// Wait for signal to potentially trigger evaluation
	await new Promise((resolve) => setTimeout(resolve, 1000))

	logger.logSection('After Prompt Update')

	const afterPromptState = {
		prompt: brain.prompt,
		promptChanged: brain.prompt !== initialPrompt,
	}

	logger.logState('Brain After Prompt Update', afterPromptState)

	logger.logSection('Action 2: Update Evolution Config')

	await brain.update({
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 10, // Changed from 5 to 10
			autoEvaluate: false, // Changed from true to false
		},
	})

	logger.logSection('After Config Update')

	const afterConfigState = {
		prompt: brain.prompt,
		evolutionEnabled: brain.config.evolution?.enabled,
		evaluatorSignalThreshold: brain.config.evolution?.evaluatorSignalThreshold,
		autoEvaluate: brain.config.evolution?.autoEvaluate,
	}

	logger.logState('Brain After Config Update', afterConfigState)

	logger.logSection('Assertions')

	// Prompt update assertions
	assertEqual(brain.prompt, newPrompt, 'Prompt was updated')
	assertEqual(brain.config.prompt, newPrompt, 'Config prompt was updated')

	// Config update assertions
	assertEqual(
		brain.config.evolution?.evaluatorSignalThreshold,
		10,
		'Evaluator signal threshold was updated',
	)
	assertEqual(brain.config.evolution?.autoEvaluate, false, 'Auto-evaluate was disabled')

	// Event assertions for prompt update
	assertEventEmitted(
		events,
		'brain:config:updated',
		(payload) => payload.updates.prompt === newPrompt,
	)

	// Authoritative signal should have been emitted for prompt change
	assertEventEmitted(
		events,
		'brain:signal:received',
		(payload) =>
			payload.source === 'brain' && payload.description.includes('SYSTEM DIRECTIVE'),
	)

	// Event assertions for config update
	assertEventEmitted(
		events,
		'brain:config:updated',
		(payload) => payload.updates.evolution?.evaluatorSignalThreshold === 10,
	)

	logger.logSuccess('All assertions passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
