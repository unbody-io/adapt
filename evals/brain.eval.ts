/**
 * Brain Evaluation Script
 *
 * Tests the full Brain flow:
 * 1. Create Brain with natural language prompt
 * 2. Auto-generate learners via LLM decomposition
 * 3. Inject data (routes to all learners)
 * 4. Ask questions (queries all learners, synthesizes response)
 *
 * Run with: OPENROUTER_API_KEY=xxx bun evals/brain.eval.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Brain } from '../src/brain/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

console.log(`\n🧠 Brain Eval - Full Flow`)
console.log(`Model: ${MODEL}\n`)

// ─────────────────────────────────────────────────────────────────────────────
// Test Data - Simulating developer activity
// ─────────────────────────────────────────────────────────────────────────────

const developerActivity = [
	// Week 1: Early signals
	{
		type: 'ai_conversation',
		timestamp: '2024-01-02T09:00:00Z',
		context: 'Starting new project',
		user_message: "I'm starting a new API project. Should I use NestJS or plain Express?",
		user_followup: "I'll go with plain Express. NestJS feels over-engineered for what I need.",
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-02T10:30:00Z',
		message: 'chore: init project with minimal express setup',
		files: ['src/index.ts', 'package.json'],
	},
	{
		type: 'ai_conversation',
		timestamp: '2024-01-02T14:00:00Z',
		context: 'Project structure',
		user_message: 'What folder structure do you recommend?',
		user_followup: "I'll start flat and extract when patterns emerge. Premature structure is as bad as premature optimization.",
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-03T11:00:00Z',
		pr: 'PR #12 - Add logging middleware',
		comment: 'This abstracts too early. We only have 3 routes. Extract when we have 10+ routes.',
		sentiment: 'reject',
	},
	{
		type: 'ai_conversation',
		timestamp: '2024-01-03T14:30:00Z',
		context: 'Error handling',
		user_message: 'How should I handle errors in Express routes?',
		user_followup: "I'll use explicit returns. throw feels like goto. If a function can fail, I want it in the return type.",
	},
	// Week 2: Deepening patterns
	{
		type: 'git_commit',
		timestamp: '2024-01-08T09:00:00Z',
		message: 'refactor: extract validation into pure functions',
		files: ['src/utils/validators.ts'],
	},
	{
		type: 'package_install',
		timestamp: '2024-01-08T10:00:00Z',
		package: 'zod',
		reason: 'Schema validation',
	},
	{
		type: 'ai_conversation',
		timestamp: '2024-01-09T11:00:00Z',
		context: 'Testing approach',
		user_message: 'Should I mock database calls in unit tests?',
		user_followup: 'I prefer testing real behavior. Mocks often test implementation, not behavior. Integration tests with test DB.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-10T09:00:00Z',
		message: 'feat: add Result type for explicit error handling',
		files: ['src/types/result.ts'],
	},
	{
		type: 'documentation_read',
		timestamp: '2024-01-10T14:00:00Z',
		url: 'https://fsharpforfunandprofit.com/posts/recipe-part2/',
		title: 'Railway Oriented Programming',
		duration_minutes: 30,
	},
	// Week 3: Evolution
	{
		type: 'code_review_given',
		timestamp: '2024-01-15T10:00:00Z',
		pr: 'PR #25 - Add DI container',
		comment: 'Too heavy. Factory functions work fine for our scale. Revisit if we hit 20+ services.',
		sentiment: 'reject',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-16T09:00:00Z',
		message: 'feat: implement pipe utility for function composition',
		files: ['src/utils/pipe.ts'],
	},
	{
		type: 'ai_conversation',
		timestamp: '2024-01-17T11:00:00Z',
		context: 'TypeScript strictness',
		user_message: 'Should I enable strict null checks?',
		user_followup: 'Absolutely. Strict everything. The compiler catching bugs is better than runtime errors.',
	},
	// Week 4: Learning new things
	{
		type: 'documentation_read',
		timestamp: '2024-01-22T09:00:00Z',
		url: 'https://effect.website/docs',
		title: 'Effect-TS documentation',
		duration_minutes: 60,
	},
	{
		type: 'ai_conversation',
		timestamp: '2024-01-23T14:00:00Z',
		context: 'Learning Effect-TS',
		user_message: "I'm curious about Effect-TS. Is it worth learning?",
		user_followup: 'The concepts look interesting but heavy for my current projects. I might use specific patterns like Either.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-24T10:00:00Z',
		message: 'docs: add ADR for functional patterns adoption',
		files: ['docs/adr/002-functional-patterns.md'],
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Test Queries
// ─────────────────────────────────────────────────────────────────────────────

const queries = [
	'What is my coding philosophy?',
	'How do I approach error handling?',
	'What are my testing preferences?',
	'Do I prefer OOP or functional programming?',
	'What is my stance on premature abstraction?',
	'What tools and libraries do I prefer?',
	'What am I currently learning or interested in?',
]

// ─────────────────────────────────────────────────────────────────────────────
// Run Eval
// ─────────────────────────────────────────────────────────────────────────────

async function runEval() {
	const startTime = Date.now()

	// ─────────────────────────────────────────────────────────────────────────
	// Step 1: Create Brain with natural language prompt
	// ─────────────────────────────────────────────────────────────────────────
	console.log('═'.repeat(70))
	console.log('STEP 1: Create Brain')
	console.log('═'.repeat(70))

	const brainPrompt = `
		Track my coding patterns, development philosophy, and learning interests.

		I'll be feeding you my conversations with AI coding assistants,
		git commits, code reviews, and technical reading activity.

		I want to understand:
		- My coding philosophy and core beliefs about software
		- My style preferences and patterns
		- What topics I'm actively learning
	`

	console.log('\nBrain prompt:')
	console.log(brainPrompt)

	const brain = new Brain({
		prompt: brainPrompt,
		model: openrouter(MODEL),
	})

	console.log('\n✅ Brain created (not yet initialized)')

	// ─────────────────────────────────────────────────────────────────────────
	// Step 2: Initialize (triggers learner generation)
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('STEP 2: Initialize Brain (auto-generate learners)')
	console.log('═'.repeat(70))

	const initStart = Date.now()
	await brain.initialize()
	const initDuration = Date.now() - initStart

	const learners = brain.getLearners()
	console.log(`\n✅ Brain initialized in ${(initDuration / 1000).toFixed(1)}s`)
	console.log(`\nAuto-generated ${learners.length} learners:`)

	for (const learner of learners) {
		console.log(`\n  [${learner.id}]`)
		console.log(`  Instructions: ${learner.instructions.slice(0, 100)}...`)
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Step 3: Inject data
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('STEP 3: Inject data')
	console.log('═'.repeat(70))

	console.log(`\nInjecting ${developerActivity.length} events...`)

	const injectStart = Date.now()
	const injectResult = await brain.inject(developerActivity)
	const injectDuration = Date.now() - injectStart

	console.log(`\n✅ Data injected in ${(injectDuration / 1000).toFixed(1)}s`)
	console.log(`\nInject ID: ${injectResult.id}`)
	console.log(`Batches processed: ${injectResult.batches.length}`)

	// Show relevance summary per learner (averaged across batches and chunks)
	console.log('\nRelevance by learner:')
	const learnerRelevances = new Map<string, number[]>()
	for (const batch of injectResult.batches) {
		for (const r of batch.results) {
			const relevances = learnerRelevances.get(r.learnerId) ?? []
			for (const chunk of r.chunks) {
				relevances.push(chunk.relevance)
			}
			learnerRelevances.set(r.learnerId, relevances)
		}
	}
	for (const [learnerId, relevances] of learnerRelevances) {
		const avgRelevance = relevances.reduce((a, b) => a + b, 0) / relevances.length
		console.log(`  ${learnerId}: ${avgRelevance.toFixed(2)} (${relevances.length} chunks)`)
	}

	// Force synthesis on all learners to build understanding
	console.log('\n' + '─'.repeat(70))
	console.log('Forcing synthesis on all learners...')
	console.log('─'.repeat(70))

	for (const learner of learners) {
		const result = await learner.learn([], { forceSynthesize: true })
		console.log(`  [${learner.id}] → ${result.status}`)
	}

	// Show understanding from each learner
	console.log('\n' + '─'.repeat(70))
	console.log('Understanding snapshots:')
	console.log('─'.repeat(70))
	for (const learner of learners) {
		const understanding = await learner.getUnderstanding()
		console.log(`\n[${learner.id}] (${understanding.length} chars)`)
		console.log(understanding.slice(0, 500) + (understanding.length > 500 ? '...' : ''))
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Step 4: Ask questions
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('STEP 4: Ask questions (synthesized responses)')
	console.log('═'.repeat(70))

	for (const query of queries) {
		console.log(`\n${'─'.repeat(70)}`)
		console.log(`Q: ${query}`)
		console.log('─'.repeat(70))

		const askStart = Date.now()
		const result = await brain.ask(query)
		const askDuration = Date.now() - askStart

		console.log(`\n📝 Synthesized Answer (${(askDuration / 1000).toFixed(1)}s):`)
		console.log(result.insight)

		if (result.sources.length > 0) {
			console.log('\n📚 Sources:')
			for (const source of result.sources) {
				console.log(`  [${source.learnerId}] confidence=${source.confidence.toFixed(2)}`)
				console.log(`    ${source.insight.slice(0, 100)}...`)
			}
		}

		if (result.gaps.length > 0) {
			console.log('\n⚠️ Gaps:', result.gaps.join('; '))
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Final Stats
	// ─────────────────────────────────────────────────────────────────────────
	const totalDuration = Date.now() - startTime

	console.log('\n' + '═'.repeat(70))
	console.log('FINAL STATISTICS')
	console.log('═'.repeat(70))

	console.log(`\nTotal duration: ${(totalDuration / 1000).toFixed(1)}s`)
	console.log(`  - Initialization: ${(initDuration / 1000).toFixed(1)}s`)
	console.log(`  - Data injection: ${(injectDuration / 1000).toFixed(1)}s`)
	console.log(`Learners generated: ${learners.length}`)
	console.log(`Events processed: ${developerActivity.length}`)
	console.log(`Queries answered: ${queries.length}`)

	console.log('\nLearner Health:')
	for (const learner of learners) {
		const gov = learner.getHealth()
		console.log(`  [${learner.id}] status=${gov.status}, activation=${gov.activation.toFixed(3)}`)
	}

	console.log('\n✅ Brain eval complete\n')
}

runEval().catch((err) => {
	console.error('\n❌ Eval failed:', err)
	process.exit(1)
})
