/**
 * Eval: Instruction Fidelity
 *
 * Tests how well instructions survive the identity pipeline and how
 * adjust directives change the compiled system prompts.
 *
 * Part 1: Various instruction styles → dump generated prompts
 * Part 2: Adjust directives → dump before/after prompts
 *
 * No Brain, no inject, no accept/reject. Pure prompt generation eval.
 * Read the output and judge whether the prompts reflect the instructions/directives.
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/learner-instruction-fidelity-eval.ts
 */

import { TextLearner } from '../../src/learners/text-learner/class'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Initial Instruction Scenarios
// ─────────────────────────────────────────────────────────────────────────────

const initScenarios = [
	{
		name: 'Simple one-liner',
		instructions: 'Track mentions of TypeScript features.',
	},
	{
		name: 'Specific constraints',
		instructions: 'Track ONLY mentions of CSS Grid and Flexbox layout. Ignore all other CSS properties, JavaScript, and HTML.',
	},
	{
		name: 'Format directive',
		instructions: 'Track cooking techniques. Present each observation as: TECHNIQUE: [name] | METHOD: [description] | DIFFICULTY: [easy/medium/hard]',
	},
	{
		name: 'Complex multi-part',
		instructions: `You track this therapist's approach to ADHD clients.

Watch for:
- Assessment methods they use
- Their stance on medication vs behavioral approaches
- Practical tools they recommend for executive function
- How they handle comorbid conditions (anxiety, depression)

Track answers to:
- What is their primary assessment framework?
- Do they favor medication, behavioral therapy, or combined?
- What specific executive function tools do they recommend?`,
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: Adjustment Scenarios
// ─────────────────────────────────────────────────────────────────────────────

const BASE_INSTRUCTIONS = 'Track knowledge about software architecture: microservices, monoliths, event-driven, CQRS, DDD, migration patterns. Focus on patterns, trade-offs, and when to use each.'

const adjustScenarios = [
	// ── Conversational / natural directives ──────────────────────────────

	{
		name: 'Additive — "also track X"',
		directive: 'Also track DevOps and deployment patterns — CI/CD pipelines, container orchestration, infrastructure as code.',
	},
	{
		name: 'Subtractive — "stop caring about Y"',
		directive: 'Lets not care about monoliths or migration patterns anymore. We\'ve moved past that.',
	},
	{
		name: 'Replacement — "only focus on Z"',
		directive: 'We need to be more focused. Only learn about microservices communication patterns from now on — service mesh, API gateways, message brokers, gRPC.',
	},
	{
		name: 'Conditional — "track X but only when Y"',
		directive: 'Track database patterns, but only when they relate to microservices. We don\'t care about general database design.',
	},

	// ── Behavioral / how-style directives ────────────────────────────────

	{
		name: 'More granular observation',
		directive: 'Be more granular. Track specific tool names, version numbers, and concrete configuration examples rather than abstract patterns.',
	},
	{
		name: 'Focus understanding on trade-offs',
		directive: 'Focus your understanding on trade-offs and decision criteria rather than descriptions. For each pattern, track: when to use it, when NOT to use it, and what it costs.',
	},
	{
		name: 'Comparative understanding style',
		directive: 'Organize understanding by comparing patterns head-to-head. Structure knowledge as "X vs Y" comparisons rather than describing each pattern in isolation.',
	},
	{
		name: 'Increase focus — performance lens',
		directive: 'Pay extra attention to performance implications. Track how each pattern affects latency, throughput, and resource usage.',
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeLearner(instructions: string) {
	return new TextLearner({
		id: 'test',
		name: 'Test Learner',
		description: 'Test',
		instructions,
		model,
		store: new MemoryStore(),
	})
}

interface PromptSnapshot {
	instructions: string
	observeIdentity: string
	observeDomain: string | null
	observeSystemPrompt: string
	understandIdentity: string
	understandSkills: string
	understandSystemPrompt: string
}

function getPromptSnapshot(learner: TextLearner): PromptSnapshot {
	const s = (learner as unknown as { state: Record<string, unknown> }).state
	const obsId = s.observe_identity as { identity: string; domain?: string } | null
	const undId = s.understand_identity as { identity: string; skills?: Array<{ skill: string; description: string }> } | null
	return {
		instructions: s.instructions as string,
		observeIdentity: obsId?.identity ?? '(none)',
		observeDomain: obsId?.domain ?? null,
		observeSystemPrompt: (s.observe_prompt as string) ?? '(none)',
		understandIdentity: undId?.identity ?? '(none)',
		understandSkills: undId?.skills?.map(sk => `${sk.skill}: ${sk.description}`).join('\n    ') ?? '(none)',
		understandSystemPrompt: (s.understand_prompt as string) ?? '(none)',
	}
}

function dumpSnapshot(snap: PromptSnapshot, log: (s: string) => void, indent = '  ') {
	log(`${indent}Instructions: ${snap.instructions}`)
	log(`${indent}Observer Identity: ${snap.observeIdentity}`)
	log(`${indent}Observer Domain: ${snap.observeDomain ?? '(cross-domain)'}`)
	log(`${indent}Observer System Prompt (${snap.observeSystemPrompt.length} chars):`)
	log(snap.observeSystemPrompt.split('\n').map(l => `${indent}  ${l}`).join('\n'))
	log(`${indent}Understand Identity: ${snap.understandIdentity}`)
	log(`${indent}Understand Skills:`)
	log(`${indent}  ${snap.understandSkills}`)
	log(`${indent}Understand System Prompt (${snap.understandSystemPrompt.length} chars):`)
	log(snap.understandSystemPrompt.split('\n').map(l => `${indent}  ${l}`).join('\n'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const lines: string[] = []
	const log = (s: string) => { console.log(s); lines.push(s) }

	log(`=== Instruction Fidelity Eval ===`)
	log(`Model: ${MODEL}`)
	log(`Date: ${new Date().toISOString()}\n`)

	// ─── PART 1: Initial Instruction Styles ─────────────────────────────

	logger.logSection('PART 1: Initial Instruction Styles')

	for (let i = 0; i < initScenarios.length; i++) {
		const s = initScenarios[i]
		logger.logSection(`  Scenario ${i + 1}: ${s.name}`)

		const learner = makeLearner(s.instructions)

		try {
			await learner.init()
			const snap = getPromptSnapshot(learner)
			dumpSnapshot(snap, log)
		} catch (err) {
			log(`  INIT FAILED: ${err instanceof Error ? err.message : String(err)}`)
		}

		await learner.dispose()
		log('')
	}

	// ─── PART 2: Adjustment Scenarios ────────────────────────────────────

	logger.logSection('PART 2: Adjustment Scenarios')

	for (let i = 0; i < adjustScenarios.length; i++) {
		const s = adjustScenarios[i]
		logger.logSection(`  Adjust ${i + 1}: ${s.name}`)

		const learner = makeLearner(BASE_INSTRUCTIONS)

		try {
			await learner.init()

			log(`  --- BEFORE ---`)
			const before = getPromptSnapshot(learner)
			dumpSnapshot(before, log)

			log(`\n  --- DIRECTIVE ---`)
			log(`  "${s.directive}"`)

			await learner.adjust(s.directive)

			log(`\n  --- AFTER ---`)
			const after = getPromptSnapshot(learner)
			dumpSnapshot(after, log)

			// Quick diff summary
			log(`\n  --- DIFF SUMMARY ---`)
			if (before.instructions !== after.instructions) {
				log(`  Instructions: CHANGED`)
			} else {
				log(`  Instructions: unchanged`)
			}
			if (before.observeIdentity !== after.observeIdentity) {
				log(`  Observer Identity: CHANGED`)
			} else {
				log(`  Observer Identity: unchanged`)
			}
			if (before.observeDomain !== after.observeDomain) {
				log(`  Observer Domain: ${before.observeDomain} → ${after.observeDomain}`)
			} else {
				log(`  Observer Domain: unchanged`)
			}
			if (before.understandIdentity !== after.understandIdentity) {
				log(`  Understand Identity: CHANGED`)
			} else {
				log(`  Understand Identity: unchanged`)
			}
			log(`  Observe prompt: ${before.observeSystemPrompt.length} → ${after.observeSystemPrompt.length} chars`)
			log(`  Understand prompt: ${before.understandSystemPrompt.length} → ${after.understandSystemPrompt.length} chars`)
		} catch (err) {
			log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`)
		}

		await learner.dispose()
		log('')
	}

	// ─── Summary ─────────────────────────────────────────────────────────

	logger.logSection('Summary')
	log(`  Part 1: ${initScenarios.length} initial instruction scenarios`)
	log(`  Part 2: ${adjustScenarios.length} adjustment scenarios`)
	log(`  Review the generated prompts above`)

	// ─── Save Report ─────────────────────────────────────────────────────

	const reportsDir = join(__dirname, '..', 'reports')
	mkdirSync(reportsDir, { recursive: true })
	const modelSlug = MODEL.replace(/\//g, '-')
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
	const filepath = join(reportsDir, `instruction-fidelity-${modelSlug}-${timestamp}.txt`)
	writeFileSync(filepath, lines.join('\n'), 'utf-8')

	logger.logSuccess(`Report saved: ${filepath}`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
