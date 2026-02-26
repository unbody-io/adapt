/**
 * Eval: Update Decomposition (adjust + update paths)
 *
 * Tests that brain.updateLearner() correctly decomposes guidance into:
 * - behavioral: directive → learner.adjust() (instructions/prompts evolution)
 * - mechanical: specific field values → learner.update() (name, description, thresholds)
 *
 * Scenarios:
 * 1. Pure behavioral — only instructions should change
 * 2. Pure mechanical — name/description/thresholds change
 * 3. Mixed — both paths fire
 * 4. Basic tier: adjustLearner (no evolution needed)
 */

import { Brain } from '../../src/brain/class'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertDefined,
	assertEventEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function main() {
	console.log('Brain Update Decomposition Eval\n')

	const events: Array<{ type: string; payload?: unknown }> = []

	// ── Setup ───────────────────────────────────────────────────────────────

	logger.logSection('Setup: Create Brain + Manual Learner')

	const brain = new Brain({
		prompt: 'Test brain for update decomposition',
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 20,
			autoEvaluate: false,
		},
	})

	await brain.initialize()

	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload })
	})

	// Create a known learner manually for controlled testing
	const learner = await brain.createLearnerFromConfig({
		id: 'ts-patterns',
		name: 'TypeScript Patterns',
		description: 'Tracks TypeScript coding patterns',
		instructions: 'Track TypeScript patterns including generics, utility types, and type narrowing.',
		type: 'text' as const,
		governance: { strategy: 'continuous' as const },
		thresholds: { minImportance: 0.3, maxObservations: 10 },
	})

	const before = {
		name: learner.name,
		description: learner.description,
		instructions: learner.instructions,
		thresholds: learner.getUnderstandThresholds(),
	}

	logger.logState('Learner before updates', before)

	// ── Scenario 1: Pure Behavioral ─────────────────────────────────────────

	logger.logSection('Scenario 1: Pure Behavioral Guidance')

	events.length = 0

	const behavioral = await brain.updateLearner(
		'ts-patterns',
		'Focus more on error handling patterns and less on utility types. Pay special attention to Result types and exhaustive matching.',
	)

	assertEqual(behavioral.id, 'ts-patterns', 'Learner ID preserved')

	// Instructions should have changed (adjust was called)
	assertTrue(
		behavioral.instructions !== before.instructions,
		'Instructions changed after behavioral guidance',
	)

	const newInstructionsLower = behavioral.instructions.toLowerCase()
	assertTrue(
		newInstructionsLower.includes('error') ||
		newInstructionsLower.includes('result') ||
		newInstructionsLower.includes('handling') ||
		newInstructionsLower.includes('exhaustive'),
		'Instructions reflect behavioral guidance (error handling / result types / exhaustive)',
	)

	logger.logState('After behavioral update', {
		instructionsPreview: behavioral.instructions.substring(0, 200),
	})

	assertEventEmitted(events, 'evolution:action:executed', (p) => p.action === 'update')

	// ── Scenario 2: Pure Mechanical ─────────────────────────────────────────

	logger.logSection('Scenario 2: Pure Mechanical Guidance')

	events.length = 0
	const beforeMechanical = {
		name: behavioral.name,
		thresholds: behavioral.getUnderstandThresholds(),
	}

	const mechanical = await brain.updateLearner(
		'ts-patterns',
		'Rename this learner to "Error Handling Patterns" and set the importance threshold to 0.6 since we want more selective observations.',
	)

	// Check mechanical changes applied
	// Name might change
	logger.logState('After mechanical update', {
		name: mechanical.name,
		description: mechanical.description,
		thresholds: mechanical.getUnderstandThresholds(),
	})

	// At least one mechanical change should have happened
	const nameChanged = mechanical.name !== beforeMechanical.name
	const thresholdsChanged = JSON.stringify(mechanical.getUnderstandThresholds()) !== JSON.stringify(beforeMechanical.thresholds)
	assertTrue(
		nameChanged || thresholdsChanged,
		'At least one mechanical field changed (name or thresholds)',
	)

	assertEventEmitted(events, 'evolution:action:executed', (p) => p.action === 'update')

	// ── Scenario 3: Mixed Guidance ──────────────────────────────────────────

	logger.logSection('Scenario 3: Mixed Guidance (behavioral + mechanical)')

	events.length = 0
	const beforeMixed = {
		instructions: mechanical.instructions,
		thresholds: mechanical.getUnderstandThresholds(),
	}

	const mixed = await brain.updateLearner(
		'ts-patterns',
		'Broaden scope to include runtime error handling beyond just types. Also increase maxObservations to 20 since we have high data volume.',
	)

	logger.logState('After mixed update', {
		instructionsPreview: mixed.instructions.substring(0, 200),
		thresholds: mixed.getUnderstandThresholds(),
	})

	// At least instructions or thresholds should have changed
	const instructionsChanged = mixed.instructions !== beforeMixed.instructions
	const thresholdsChangedMixed = JSON.stringify(mixed.getUnderstandThresholds()) !== JSON.stringify(beforeMixed.thresholds)
	assertTrue(
		instructionsChanged || thresholdsChangedMixed,
		'At least one field changed in mixed guidance',
	)

	assertEventEmitted(events, 'evolution:action:executed', (p) => p.action === 'update')

	// ── Scenario 4: Basic Tier adjustLearner ────────────────────────────────

	logger.logSection('Scenario 4: Basic Tier adjustLearner (no evolution)')

	events.length = 0
	const beforeAdjust = mixed.instructions

	const adjusted = await brain.adjustLearner(
		'ts-patterns',
		'Also start tracking defensive programming patterns like input validation and guard clauses.',
	)

	assertTrue(
		adjusted.instructions !== beforeAdjust,
		'adjustLearner changed instructions',
	)

	const adjustedLower = adjusted.instructions.toLowerCase()
	assertTrue(
		adjustedLower.includes('defensive') ||
		adjustedLower.includes('validation') ||
		adjustedLower.includes('guard'),
		'adjustLearner instructions reflect the directive',
	)

	// Verify learner still in brain store
	const learnerRecord = await brain.store.learners.get('ts-patterns')
	assertDefined(learnerRecord, 'Learner entry exists after adjust')

	logger.logState('After adjustLearner', {
		instructionsPreview: adjusted.instructions.substring(0, 200),
	})

	// ── Summary ─────────────────────────────────────────────────────────────

	logger.logSection('Summary')

	logger.logState('Instruction evolution chain', {
		'1_original': before.instructions.substring(0, 100) + '...',
		'2_after_behavioral': behavioral.instructions.substring(0, 100) + '...',
		'3_after_mixed': mixed.instructions.substring(0, 100) + '...',
		'4_after_adjust': adjusted.instructions.substring(0, 100) + '...',
	})

	logger.logSuccess('All update decomposition scenarios passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
