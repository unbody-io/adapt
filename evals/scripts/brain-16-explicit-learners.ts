/**
 * Eval: Explicit Learners + Autopilot Config
 *
 * Tests the learner initialization modes:
 * 1. autoSetup: false + explicit learners → no LLM, only explicit learners created
 * 2. autoSetup: false + no learners → brain initializes with zero learners
 * 3. autopilot: true (default) + explicit learners → explicit + LLM-generated
 * 4. Explicit learners → inject + ask works
 * 5. Explicit learners survive persist → restore
 */

import { Brain } from '../../src/brain/class'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import {
	assertEqual,
	assertTrue,
	assertGreaterThan,
	assertDefined,
	assertEventEmitted,
	assertEventNotEmitted,
} from '../helpers/assertions'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function main() {
	console.log('Brain Explicit Learners + Autopilot Eval\n')

	const events: Array<{ type: string; payload?: unknown }> = []

	// ── Scenario 1: autoSetup: false + explicit learners ────────────────────

	logger.logSection('Scenario 1: autoSetup: false + explicit learners (no LLM)')

	events.length = 0

	const brain1 = new Brain({
		prompt: 'Track software engineering practices',
		model: openrouter(MODEL),
		autoSetup: false,
		learners: [
			{
				id: 'ts-patterns',
				name: 'TypeScript Patterns',
				type: 'text' as const,
				description: 'Tracks TypeScript coding patterns',
				instructions: 'Track TypeScript patterns including generics, utility types, and type narrowing.',
				governance: { strategy: 'continuous' as const },
			},
			{
				id: 'tools-catalog',
				name: 'Tools Catalog',
				type: 'list' as const,
				description: 'Catalog of tools and frameworks used',
				instructions: 'Track tools, frameworks, and libraries used in the project.',
			},
		],
	})

	brain1.on((event) => {
		events.push({ type: event.type, payload: event.payload })
	})

	await brain1.initialize()

	const learners1 = brain1.getLearners()
	assertEqual(learners1.length, 2, 'Exactly 2 learners created (explicit only)')

	// Verify specific IDs
	assertDefined(brain1.getLearner('ts-patterns'), 'ts-patterns learner exists')
	assertDefined(brain1.getLearner('tools-catalog'), 'tools-catalog learner exists')

	// Verify types
	assertEqual(brain1.getLearner('ts-patterns')!.type, 'text', 'ts-patterns is text type')
	assertEqual(brain1.getLearner('tools-catalog')!.type, 'list', 'tools-catalog is list type')

	// No LLM decomposition event should have been emitted
	assertEventNotEmitted(events, 'brain:init:config:generating')
	assertEventNotEmitted(events, 'brain:init:config:generated')

	// But init:completed should still fire
	assertEventEmitted(events, 'brain:init:completed')

	logger.logState('Scenario 1 learners', learners1.map((l) => ({
		id: l.id, name: l.name, type: l.type,
	})))

	await brain1.dispose()

	// ── Scenario 2: autoSetup: false + no learners ──────────────────────────

	logger.logSection('Scenario 2: autoSetup: false + no explicit learners')

	events.length = 0

	const brain2 = new Brain({
		prompt: 'Track software engineering practices',
		model: openrouter(MODEL),
		autoSetup: false,
	})

	brain2.on((event) => {
		events.push({ type: event.type, payload: event.payload })
	})

	await brain2.initialize()

	const learners2 = brain2.getLearners()
	assertEqual(learners2.length, 0, 'Zero learners (autopilot off, none provided)')

	assertEventNotEmitted(events, 'brain:init:config:generating')
	assertEventEmitted(events, 'brain:init:completed')

	await brain2.dispose()

	// ── Scenario 3: autopilot: true (default) + explicit learners ───────────

	logger.logSection('Scenario 3: autopilot: true + explicit learners (LLM + explicit)')

	events.length = 0

	const brain3 = new Brain({
		prompt: `Track software engineering practices:
- TypeScript type safety patterns
- Tools and frameworks used (as a list/catalog)`,
		model: openrouter(MODEL),
		learners: [
			{
				id: 'custom-security',
				name: 'Security Practices',
				type: 'text' as const,
				description: 'Tracks security-related coding practices',
				instructions: 'Track security practices including auth, encryption, input validation.',
				governance: { strategy: 'continuous' as const },
			},
		],
	})

	brain3.on((event) => {
		events.push({ type: event.type, payload: event.payload })
	})

	await brain3.initialize()

	const learners3 = brain3.getLearners()

	// Should have the explicit learner PLUS LLM-generated ones
	assertDefined(brain3.getLearner('custom-security'), 'Explicit custom-security learner exists')
	assertGreaterThan(learners3.length, 1, 'More than 1 learner (explicit + LLM-generated)')

	// LLM decomposition events SHOULD have been emitted
	assertEventEmitted(events, 'brain:init:config:generating')
	assertEventEmitted(events, 'brain:init:config:generated')

	logger.logState('Scenario 3 learners', learners3.map((l) => ({
		id: l.id, name: l.name, type: l.type,
	})))

	await brain3.dispose()

	// ── Scenario 4: Explicit learners → inject + ask ────────────────────────

	logger.logSection('Scenario 4: Inject + Ask with explicit learners')

	const brain4 = new Brain({
		prompt: 'Track software engineering practices',
		model: openrouter(MODEL),
		autoSetup: false,
		learners: [
			{
				id: 'ts-patterns',
				name: 'TypeScript Patterns',
				type: 'text' as const,
				description: 'Tracks TypeScript coding patterns',
				instructions: 'Track TypeScript patterns including generics, utility types, and type narrowing.',
				governance: { strategy: 'continuous' as const },
			},
			{
				id: 'tools-catalog',
				name: 'Tools Catalog',
				type: 'list' as const,
				description: 'Catalog of tools and frameworks used',
				instructions: 'Track tools, frameworks, and libraries used in the project.',
			},
		],
	})

	await brain4.initialize()

	const injectResult = await brain4.inject([
		'We use TypeScript strict mode with no-any rules.',
		'Our API uses Hono framework for routing.',
		'PostgreSQL 15 via Drizzle ORM.',
	])

	assertDefined(injectResult.id, 'Inject returned an ID')
	assertGreaterThan(injectResult.batches.length, 0, 'At least 1 batch')

	const askResult = await brain4.ask('What TypeScript practices are used?')
	assertDefined(askResult.insight, 'Ask returned insight')
	assertGreaterThan(askResult.insight.length, 10, 'Insight is non-trivial')

	logger.logState('Ask result', {
		insightPreview: askResult.insight.substring(0, 200),
		sourceCount: askResult.sources.length,
	})

	// ── Scenario 5: Persist → Restore with explicit learners ────────────────

	logger.logSection('Scenario 5: Persist → Restore with explicit learners')

	const brainStore = new MemoryBrainStore()
	const learnerStores = new Map<string, MemoryStore>()

	const brain5a = new Brain({
		prompt: 'Track TypeScript practices',
		model: openrouter(MODEL),
		autoSetup: false,
		store: brainStore,
		learners: [
			{
				id: 'ts-patterns',
				name: 'TypeScript Patterns',
				type: 'text' as const,
				description: 'Tracks TS patterns',
				instructions: 'Track TypeScript patterns.',
				governance: { strategy: 'continuous' as const },
			},
		],
		learning: {
			store: (learnerId: string) => {
				const s = new MemoryStore()
				learnerStores.set(learnerId, s)
				return s
			},
		},
	})

	await brain5a.initialize()
	assertEqual(brain5a.getLearners().length, 1, 'Brain 5a has 1 learner')

	// Inject some data so there's state to verify
	await brain5a.inject(['TypeScript discriminated unions are powerful.'])

	// Create second brain from same store (restore path)
	const brain5b = new Brain({
		prompt: 'will be overwritten by restore',
		model: openrouter(MODEL),
		autoSetup: false,
		store: brainStore,
		learning: {
			store: (learnerId: string) => {
				const existing = learnerStores.get(learnerId)
				if (existing) return existing
				const s = new MemoryStore()
				learnerStores.set(learnerId, s)
				return s
			},
		},
	})

	await brain5b.initialize()

	const restored = brain5b.getLearners()
	assertEqual(restored.length, 1, 'Restored brain has 1 learner')
	assertEqual(restored[0].id, 'ts-patterns', 'Restored learner has correct ID')
	assertEqual(brain5b.prompt, 'Track TypeScript practices', 'Prompt restored correctly')

	await brain5b.dispose()
	await brain4.dispose()

	// ── Summary ─────────────────────────────────────────────────────────────

	logger.logSuccess('All explicit learners + autopilot scenarios passed!')
	process.exit(0)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
