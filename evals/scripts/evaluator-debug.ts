/**
 * Minimal eval to debug what the evaluator LLM is doing.
 * Injects 1 dev batch + 2 non-dev batches, then watches evaluator raw output.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Brain } from '../../src/brain/class'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const model = openrouter(process.env.MODEL ?? 'google/gemini-2.0-flash-001')

const datasetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'datasets')
const raw = JSON.parse(readFileSync(join(datasetsDir, 'digital-twin-daily.json'), 'utf-8'))
const allEvents = raw.events as Array<{ id: string; domain: string; content: string }>

const devItems = allEvents.filter((e) => e.domain === 'software-development').slice(0, 5)
const cookingItems = allEvents.filter((e) => e.domain === 'cooking-food').slice(0, 2)
const fitnessItems = allEvents.filter((e) => e.domain === 'fitness').slice(0, 2)

async function main() {
	console.log('=== Evaluator Debug ===\n')

	const brain = new Brain({
		prompt: 'You are a digital twin of a software developer. You receive data from all aspects of their life.',
		model,
		store: new MemoryBrainStore(),
		autoSetup: false,
		learners: [{
			id: 'dev-learner',
			name: 'Developer Knowledge',
			description: 'Tracks software development',
			type: 'text',
			instructions: 'Track this developer\'s coding philosophy, architecture preferences, tooling choices, and technical opinions.',
		}],
		learning: {
			store: () => new MemoryStore(),
			understand: { thresholds: { maxObservations: 3, minImportance: 0.2 } },
		},
		internalLearners: {
			globalUnderstanding: false,
			globalQueryUnderstanding: false,
			injectionGaps: true,
			queryGaps: false,
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 1,
			autoEvaluate: true,
		},
	})

	await brain.initialize()
	console.log('Brain initialized. Learners:', brain.getLearners().map(l => l.id))

	// Inject dev data so learner has some knowledge
	console.log('\n--- Injecting dev data ---')
	await brain.inject(devItems.map(e => e.content))
	console.log('Dev data injected.')

	// Inject cooking data — should be dismissed → triggers evaluator
	console.log('\n--- Injecting cooking data (should be dismissed) ---')
	await brain.inject(cookingItems.map(e => e.content))
	console.log('Cooking injected.')

	// Wait for evaluator to finish
	console.log('\n--- Waiting 30s for evaluator ---')
	await new Promise(r => setTimeout(r, 30000))

	// Inject fitness data
	console.log('\n--- Injecting fitness data (should be dismissed) ---')
	await brain.inject(fitnessItems.map(e => e.content))
	console.log('Fitness injected.')

	// Wait again
	console.log('\n--- Waiting 30s for evaluator ---')
	await new Promise(r => setTimeout(r, 30000))

	console.log('\n--- Final state ---')
	console.log('Learners:', brain.getLearners().map(l => `${l.id} (${l.name})`))

	await brain.dispose()
}

main().catch(e => { console.error(e); process.exit(1) })
