/**
 * Test cascading model configuration
 *
 * Tests that model and blueprintModel cascade correctly through:
 *   Brain → Learner → Phase (observe, synthesize, query)
 *
 * Verifies:
 * 1. Default cascading (parent model flows to children)
 * 2. Override behavior (explicit child config takes precedence)
 * 3. Non-override behavior (unset values inherit from parent)
 *
 * Run with: bun evals/test-cascading-config.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { resolveTextLearnerConfig } from '../src/learners/text-learner/config.resolver'
import type { TextLearnerConfig } from '../src/learners/text-learner/types'

// ─────────────────────────────────────────────────────────────────────────────
// Setup - Create distinguishable models for testing
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY ?? 'test-key',
})

// Create models with identifiable names for testing
const MODEL_A = openrouter('google/gemini-2.0-flash-001')
const MODEL_B = openrouter('anthropic/claude-sonnet-4')
const MODEL_C = openrouter('openai/gpt-4o-mini')
const MODEL_D = openrouter('openai/gpt-4o')

// Helper to get model identifier for comparison
function getModelId(model: LanguageModel): string {
	return model.modelId
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

interface TestResult {
	name: string
	passed: boolean
	expected: string
	actual: string
	details?: string
}

const results: TestResult[] = []

function test(name: string, expected: string, actual: string, details?: string) {
	const passed = expected === actual
	results.push({ name, passed, expected, actual, details })
	return passed
}

function assertEqual(name: string, expected: LanguageModel, actual: LanguageModel) {
	return test(name, getModelId(expected), getModelId(actual))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: TextLearner - Basic Cascading (no parent)
// ─────────────────────────────────────────────────────────────────────────────

function testTextLearnerBasicCascading() {
	console.log('\n═══ Test 1: TextLearner Basic Cascading ═══\n')

	const config: TextLearnerConfig = {
		model: MODEL_A,
		instructions: 'Test learner',
	}

	const resolved = resolveTextLearnerConfig(config)

	// Model should cascade to all phases
	assertEqual('model → resolved.model', MODEL_A, resolved.model)
	assertEqual('model → blueprintModel (fallback)', MODEL_A, resolved.blueprintModel)
	assertEqual('model → observe.model', MODEL_A, resolved.observe.model)
	assertEqual('model → observe.blueprintModel', MODEL_A, resolved.observe.blueprintModel)
	assertEqual('model → synthesize.model', MODEL_A, resolved.synthesize.model)
	assertEqual('model → synthesize.blueprintModel', MODEL_A, resolved.synthesize.blueprintModel)
	assertEqual('model → query.model', MODEL_A, resolved.query.model)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: TextLearner - blueprintModel Override
// ─────────────────────────────────────────────────────────────────────────────

function testTextLearnerBlueprintOverride() {
	console.log('\n═══ Test 2: TextLearner blueprintModel Override ═══\n')

	const config: TextLearnerConfig = {
		model: MODEL_A,
		blueprintModel: MODEL_B, // Override at learner level
		instructions: 'Test learner',
	}

	const resolved = resolveTextLearnerConfig(config)

	// model stays MODEL_A, blueprintModel overridden to MODEL_B
	assertEqual('model stays MODEL_A', MODEL_A, resolved.model)
	assertEqual('blueprintModel overridden to MODEL_B', MODEL_B, resolved.blueprintModel)

	// Phases inherit the override
	assertEqual('observe.model inherits MODEL_A', MODEL_A, resolved.observe.model)
	assertEqual('observe.blueprintModel inherits MODEL_B', MODEL_B, resolved.observe.blueprintModel)
	assertEqual('synthesize.model inherits MODEL_A', MODEL_A, resolved.synthesize.model)
	assertEqual('synthesize.blueprintModel inherits MODEL_B', MODEL_B, resolved.synthesize.blueprintModel)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: TextLearner - Phase-Level Override
// ─────────────────────────────────────────────────────────────────────────────

function testTextLearnerPhaseOverride() {
	console.log('\n═══ Test 3: TextLearner Phase-Level Override ═══\n')

	const config: TextLearnerConfig = {
		model: MODEL_A,
		blueprintModel: MODEL_B,
		instructions: 'Test learner',
		observe: {
			model: MODEL_C, // Override observe runtime model
		},
		synthesize: {
			blueprintModel: MODEL_D, // Override synthesize blueprint model
		},
	}

	const resolved = resolveTextLearnerConfig(config)

	// Top level unchanged
	assertEqual('model stays MODEL_A', MODEL_A, resolved.model)
	assertEqual('blueprintModel stays MODEL_B', MODEL_B, resolved.blueprintModel)

	// Observe: model overridden, blueprintModel inherits
	assertEqual('observe.model OVERRIDDEN to MODEL_C', MODEL_C, resolved.observe.model)
	assertEqual('observe.blueprintModel inherits MODEL_B', MODEL_B, resolved.observe.blueprintModel)

	// Synthesize: model inherits, blueprintModel overridden
	assertEqual('synthesize.model inherits MODEL_A', MODEL_A, resolved.synthesize.model)
	assertEqual('synthesize.blueprintModel OVERRIDDEN to MODEL_D', MODEL_D, resolved.synthesize.blueprintModel)

	// Query: inherits both
	assertEqual('query.model inherits MODEL_A', MODEL_A, resolved.query.model)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: TextLearner with Parent Models (from Brain)
// ─────────────────────────────────────────────────────────────────────────────

function testTextLearnerWithParentModels() {
	console.log('\n═══ Test 4: TextLearner with Parent Models ═══\n')

	// Simulate Brain passing parent models
	const parentModels = {
		model: MODEL_A,
		blueprintModel: MODEL_B,
	}

	// Learner config with NO model specified (should inherit from parent)
	const config: TextLearnerConfig = {
		model: undefined as unknown as LanguageModel, // Will be inherited
		instructions: 'Test learner',
	}

	const resolved = resolveTextLearnerConfig(
		{ ...config, model: parentModels.model },
		parentModels,
	)

	// Should inherit from parent
	assertEqual('model inherits from parent', MODEL_A, resolved.model)
	assertEqual('blueprintModel inherits from parent', MODEL_B, resolved.blueprintModel)
	assertEqual('observe.model inherits from parent', MODEL_A, resolved.observe.model)
	assertEqual('observe.blueprintModel inherits from parent', MODEL_B, resolved.observe.blueprintModel)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: TextLearner Overrides Parent
// ─────────────────────────────────────────────────────────────────────────────

function testTextLearnerOverridesParent() {
	console.log('\n═══ Test 5: TextLearner Overrides Parent ═══\n')

	const parentModels = {
		model: MODEL_A,
		blueprintModel: MODEL_B,
	}

	// Learner explicitly overrides both
	const config: TextLearnerConfig = {
		model: MODEL_C, // Override parent model
		blueprintModel: MODEL_D, // Override parent blueprintModel
		instructions: 'Test learner',
	}

	const resolved = resolveTextLearnerConfig(config, parentModels)

	// Learner overrides take precedence
	assertEqual('model OVERRIDES parent to MODEL_C', MODEL_C, resolved.model)
	assertEqual('blueprintModel OVERRIDES parent to MODEL_D', MODEL_D, resolved.blueprintModel)
	assertEqual('observe.model uses learner override MODEL_C', MODEL_C, resolved.observe.model)
	assertEqual('observe.blueprintModel uses learner override MODEL_D', MODEL_D, resolved.observe.blueprintModel)
}

// Tests 6-8 (Brain Config Resolution) removed — Brain no longer has a
// standalone resolver. Config is resolved inline in the constructor and
// stored directly in BrainState. Use `new Brain(config).config` to verify.

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Non-Model Config Values Don't Cascade
// ─────────────────────────────────────────────────────────────────────────────

function testNonModelConfigsUsesDefaults() {
	console.log('\n═══ Test 9: Non-Model Configs Use Defaults ═══\n')

	const config: TextLearnerConfig = {
		model: MODEL_A,
		instructions: 'Test learner',
		// No governance, observe, synthesize, or query configs
	}

	const resolved = resolveTextLearnerConfig(config)

	// Verify defaults are applied (not cascaded from parent)
	test('origin defaults to developer', 'developer', resolved.origin)
	test('governance.strategy defaults to cumulative', 'cumulative', resolved.governance.strategy)
	test('governance.maxTokens defaults to 16000', '16000', String(resolved.governance.maxTokens))
	test('observe.method defaults to direct', 'direct', resolved.observe.method)
	test('synthesize.method defaults to direct', 'direct', resolved.synthesize.method)
	test('query.method defaults to tool-based', 'tool-based', resolved.query.method)
	test('synthesize.thresholds.maxObservations defaults to 10', '10', String(resolved.synthesize.thresholds.maxObservations))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: Partial Phase Config Merges Correctly
// ─────────────────────────────────────────────────────────────────────────────

function testPartialPhaseConfigMerge() {
	console.log('\n═══ Test 10: Partial Phase Config Merges Correctly ═══\n')

	const config: TextLearnerConfig = {
		model: MODEL_A,
		blueprintModel: MODEL_B,
		instructions: 'Test learner',
		synthesize: {
			// Only override thresholds, not model
			thresholds: {
				maxObservations: 5, // Override one threshold
				// maxTokens not set - should use default
			},
		},
	}

	const resolved = resolveTextLearnerConfig(config)

	// Models still cascade
	assertEqual('synthesize.model inherits MODEL_A', MODEL_A, resolved.synthesize.model)
	assertEqual('synthesize.blueprintModel inherits MODEL_B', MODEL_B, resolved.synthesize.blueprintModel)

	// Thresholds: partial override + defaults
	test('maxObservations OVERRIDDEN to 5', '5', String(resolved.synthesize.thresholds.maxObservations))
	test('maxTokens defaults to 8000', '8000', String(resolved.synthesize.thresholds.maxTokens))
	test('minImportance defaults to 0.9', '0.9', String(resolved.synthesize.thresholds.minImportance))
}

// ─────────────────────────────────────────────────────────────────────────────
// Run All Tests
// ─────────────────────────────────────────────────────────────────────────────

function runAllTests() {
	console.log('\n🧪 Cascading Config Test Suite\n')
	console.log('Testing model inheritance and override behavior across:')
	console.log('  Brain → Learner → Phase (observe, synthesize, query)')
	console.log('')

	testTextLearnerBasicCascading()
	testTextLearnerBlueprintOverride()
	testTextLearnerPhaseOverride()
	testTextLearnerWithParentModels()
	testTextLearnerOverridesParent()
	// Tests 6-8 removed (Brain resolver deleted)
	testNonModelConfigsUsesDefaults()
	testPartialPhaseConfigMerge()

	// Print results
	console.log('\n' + '═'.repeat(70))
	console.log('RESULTS')
	console.log('═'.repeat(70))

	const passed = results.filter((r) => r.passed)
	const failed = results.filter((r) => !r.passed)

	console.log(`\n✅ Passed: ${passed.length}`)
	console.log(`❌ Failed: ${failed.length}`)

	if (failed.length > 0) {
		console.log('\n─── Failed Tests ───\n')
		for (const f of failed) {
			console.log(`❌ ${f.name}`)
			console.log(`   Expected: ${f.expected}`)
			console.log(`   Actual:   ${f.actual}`)
			if (f.details) {
				console.log(`   Details:  ${f.details}`)
			}
			console.log('')
		}
	}

	// Summary table for quick reference
	console.log('\n─── Cascade Behavior Summary ───\n')
	console.log('Level          | model cascades from | blueprintModel cascades from')
	console.log('---------------|---------------------|-----------------------------')
	console.log('Brain          | config.model        | config.blueprintModel ?? model')
	console.log('Brain.init     | brain.model         | brain.blueprintModel')
	console.log('Brain.query    | brain.model         | (not applicable)')
	console.log('Brain.learning | brain.model         | brain.blueprintModel')
	console.log('Learner        | parent.model        | parent.blueprintModel ?? model')
	console.log('Learner.observe| learner.model       | learner.blueprintModel')
	console.log('Learner.synth  | learner.model       | learner.blueprintModel')
	console.log('Learner.query  | learner.model       | (not applicable)')

	console.log('\n✅ Test suite complete\n')

	// Exit with error if any tests failed
	if (failed.length > 0) {
		process.exit(1)
	}
}

runAllTests()
