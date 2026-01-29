/**
 * TextLearner Evaluation Script - Rich Data Edition
 *
 * Run with: OPENROUTER_API_KEY=xxx bun evals/text-learner.eval.ts
 *
 * Tests the TextLearner with realistic, high-volume data simulating
 * a developer's activity stream over time.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { TextLearner } from '../src/learners/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'anthropic/claude-3.5-sonnet'

console.log(`\n🧠 TextLearner Eval - Rich Data Edition`)
console.log(`Model: ${MODEL}\n`)

// ─────────────────────────────────────────────────────────────────────────────
// Rich Test Data - Simulating a developer's activity over several weeks
// ─────────────────────────────────────────────────────────────────────────────

// Week 1: Early signals - establishing baseline
const week1Activity = [
	{
		type: 'git_commit',
		timestamp: '2024-01-08T09:23:00Z',
		message: 'feat: add user authentication flow',
		files: ['src/auth/login.ts', 'src/auth/register.ts'],
		additions: 245,
		deletions: 12,
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-08T11:45:00Z',
		message: 'refactor: extract validation logic into pure functions',
		files: ['src/utils/validators.ts'],
		additions: 89,
		deletions: 67,
	},
	{
		type: 'ide_setting_change',
		timestamp: '2024-01-08T14:00:00Z',
		setting: 'editor.formatOnSave',
		value: true,
	},
	{
		type: 'ide_setting_change',
		timestamp: '2024-01-08T14:01:00Z',
		setting: 'editor.tabSize',
		value: 2,
	},
	{
		type: 'package_install',
		timestamp: '2024-01-09T10:00:00Z',
		package: 'zod',
		version: '^3.22.0',
		reason: 'Schema validation',
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-09T14:30:00Z',
		pr: 'PR #234',
		comment:
			'Consider using a discriminated union here instead of optional fields',
		sentiment: 'suggestion',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-10T09:15:00Z',
		message: 'feat: implement data transformation pipeline using map/filter',
		files: ['src/services/transform.ts'],
		additions: 156,
		deletions: 0,
	},
	{
		type: 'documentation_read',
		timestamp: '2024-01-10T11:00:00Z',
		url: 'https://effect.website/docs',
		duration_seconds: 1800,
		topic: 'Effect-TS library',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-10T16:00:00Z',
		message: 'test: add unit tests for validators using vitest',
		files: ['src/utils/__tests__/validators.test.ts'],
		additions: 234,
		deletions: 0,
	},
	{
		type: 'terminal_command',
		timestamp: '2024-01-11T09:00:00Z',
		command: 'bun test --watch',
		context: 'Running tests in watch mode',
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-11T11:00:00Z',
		pr: 'PR #237',
		comment:
			'This class has too many responsibilities. Can we split it into smaller, focused modules?',
		sentiment: 'concern',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-12T10:30:00Z',
		message: 'refactor: replace class with factory function pattern',
		files: ['src/services/user-service.ts'],
		additions: 78,
		deletions: 112,
	},
]

// Week 2: Deepening patterns + some noise
const week2Activity = [
	{
		type: 'slack_message',
		timestamp: '2024-01-15T09:00:00Z',
		channel: '#engineering',
		content: "Anyone tried Bun's test runner? Thinking of switching from Jest",
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-15T10:00:00Z',
		message: 'chore: migrate from Jest to Vitest',
		files: ['vitest.config.ts', 'package.json'],
		additions: 45,
		deletions: 89,
	},
	{
		type: 'package_install',
		timestamp: '2024-01-15T10:05:00Z',
		package: 'vitest',
		version: '^1.2.0',
		reason: 'Test runner replacement',
	},
	{
		type: 'package_uninstall',
		timestamp: '2024-01-15T10:06:00Z',
		package: 'jest',
		reason: 'Replaced by vitest',
	},
	{
		type: 'meeting_notes',
		timestamp: '2024-01-15T14:00:00Z',
		title: 'Architecture Review',
		notes: 'Discussed moving to hexagonal architecture. Team agreed to try ports and adapters pattern.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-16T09:30:00Z',
		message: 'feat: add Result type for explicit error handling',
		files: ['src/types/result.ts', 'src/utils/result.ts'],
		additions: 89,
		deletions: 0,
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-16T11:00:00Z',
		pr: 'PR #245',
		comment:
			"Let's avoid try/catch here and use the Result type we just added",
		sentiment: 'suggestion',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-16T14:00:00Z',
		message: 'refactor: convert auth service to use Result instead of throwing',
		files: ['src/auth/auth-service.ts'],
		additions: 67,
		deletions: 45,
	},
	{
		type: 'browser_bookmark',
		timestamp: '2024-01-16T16:00:00Z',
		url: 'https://fsharpforfunandprofit.com/posts/recipe-part2/',
		title: 'Railway Oriented Programming',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-17T09:00:00Z',
		message: 'feat: implement pipe utility for function composition',
		files: ['src/utils/pipe.ts'],
		additions: 34,
		deletions: 0,
	},
	{
		type: 'code_snippet_saved',
		timestamp: '2024-01-17T10:30:00Z',
		title: 'Pipe implementation',
		language: 'typescript',
		code: 'const pipe = <T>(...fns: Array<(x: T) => T>) => (x: T) => fns.reduce((v, f) => f(v), x)',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-17T15:00:00Z',
		message:
			'refactor: use pipe for data transformation instead of nested calls',
		files: ['src/services/transform.ts'],
		additions: 23,
		deletions: 31,
	},
	{
		type: 'lunch_order',
		timestamp: '2024-01-17T12:30:00Z',
		restaurant: 'Chipotle',
		order: 'Burrito bowl with chicken',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-18T10:00:00Z',
		message: 'feat: add branded types for domain modeling',
		files: ['src/types/branded.ts', 'src/domain/user-id.ts'],
		additions: 56,
		deletions: 0,
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-18T14:00:00Z',
		pr: 'PR #251',
		comment:
			'Nice use of branded types! This makes the API much safer. Consider adding a parse function too.',
		sentiment: 'positive',
	},
	{
		type: 'documentation_read',
		timestamp: '2024-01-19T09:00:00Z',
		url: 'https://docs.effect.website/docs/data-types/either',
		duration_seconds: 2400,
		topic: 'Either type in Effect-TS',
	},
]

// Week 3: Evolution and some contradictions
const week3Activity = [
	{
		type: 'git_commit',
		timestamp: '2024-01-22T09:00:00Z',
		message: 'feat: add dependency injection container',
		files: ['src/di/container.ts', 'src/di/types.ts'],
		additions: 178,
		deletions: 0,
	},
	{
		type: 'slack_message',
		timestamp: '2024-01-22T10:00:00Z',
		channel: '#engineering',
		content:
			'Tried inversify but found it too heavy. Rolling our own simple DI based on factory functions.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-22T14:00:00Z',
		message: 'refactor: wire services through DI container',
		files: [
			'src/services/user-service.ts',
			'src/services/auth-service.ts',
			'src/main.ts',
		],
		additions: 89,
		deletions: 45,
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-23T09:30:00Z',
		message: 'test: add integration tests with mocked dependencies',
		files: ['src/__tests__/integration/auth.test.ts'],
		additions: 156,
		deletions: 0,
	},
	{
		type: 'code_review_received',
		timestamp: '2024-01-23T11:00:00Z',
		pr: 'PR #260',
		from: 'senior_dev',
		comment:
			'The functional approach is clean but consider if we need some OOP for stateful services like connection pools.',
		sentiment: 'neutral',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-23T15:00:00Z',
		message: 'feat: add connection pool using class with private state',
		files: ['src/db/connection-pool.ts'],
		additions: 134,
		deletions: 0,
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-24T09:00:00Z',
		message: 'docs: add ADR for hybrid FP/OOP approach',
		files: ['docs/adr/003-hybrid-paradigm.md'],
		additions: 89,
		deletions: 0,
	},
	{
		type: 'ide_extension_install',
		timestamp: '2024-01-24T10:00:00Z',
		extension: 'Error Lens',
		reason: 'Inline error display',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-24T14:00:00Z',
		message:
			'refactor: extract pure business logic from connection pool class',
		files: ['src/db/connection-pool.ts', 'src/db/pool-logic.ts'],
		additions: 67,
		deletions: 34,
	},
	{
		type: 'package_install',
		timestamp: '2024-01-25T09:00:00Z',
		package: 'fp-ts',
		version: '^2.16.0',
		reason: 'Functional programming utilities',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-25T11:00:00Z',
		message: 'refactor: migrate Result type to fp-ts Either',
		files: [
			'src/types/result.ts',
			'src/auth/auth-service.ts',
			'src/services/user-service.ts',
		],
		additions: 45,
		deletions: 89,
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-25T14:00:00Z',
		pr: 'PR #267',
		comment:
			'The TaskEither usage here is elegant. Makes the async error handling much cleaner than try/catch.',
		sentiment: 'positive',
	},
	{
		type: 'calendar_event',
		timestamp: '2024-01-25T15:00:00Z',
		title: 'Dentist appointment',
		duration_minutes: 60,
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-26T09:00:00Z',
		message: 'feat: add logging middleware using reader monad pattern',
		files: ['src/middleware/logging.ts'],
		additions: 78,
		deletions: 0,
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-26T14:00:00Z',
		message: 'test: achieve 90% coverage on auth module',
		files: ['src/auth/__tests__/*.ts'],
		additions: 345,
		deletions: 23,
	},
]

// Week 4: Shift in some areas
const week4Activity = [
	{
		type: 'meeting_notes',
		timestamp: '2024-01-29T10:00:00Z',
		title: 'Performance Review',
		notes: 'FP approach causing issues with bundle size. Team discussing alternatives.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-29T14:00:00Z',
		message: 'perf: analyze bundle size impact of fp-ts',
		files: ['scripts/analyze-bundle.ts'],
		additions: 45,
		deletions: 0,
	},
	{
		type: 'slack_message',
		timestamp: '2024-01-29T16:00:00Z',
		channel: '#engineering',
		content:
			'fp-ts adds 50kb to bundle. Considering writing our own minimal utilities instead.',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-30T09:00:00Z',
		message: 'refactor: replace fp-ts with minimal custom utilities',
		files: [
			'src/utils/either.ts',
			'src/utils/task-either.ts',
			'package.json',
		],
		additions: 89,
		deletions: 156,
	},
	{
		type: 'package_uninstall',
		timestamp: '2024-01-30T09:05:00Z',
		package: 'fp-ts',
		reason: 'Bundle size concerns, using custom implementation',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-30T14:00:00Z',
		message: 'feat: add tree-shaking friendly pipe and flow utilities',
		files: ['src/utils/compose.ts'],
		additions: 56,
		deletions: 0,
	},
	{
		type: 'code_review_given',
		timestamp: '2024-01-31T10:00:00Z',
		pr: 'PR #275',
		comment:
			"Good balance between FP ergonomics and bundle size. Let's document these utilities.",
		sentiment: 'positive',
	},
	{
		type: 'git_commit',
		timestamp: '2024-01-31T11:00:00Z',
		message: 'docs: add examples for custom FP utilities',
		files: ['docs/utils/fp-guide.md'],
		additions: 234,
		deletions: 0,
	},
	{
		type: 'ide_setting_change',
		timestamp: '2024-01-31T14:00:00Z',
		setting: 'editor.inlineSuggest.enabled',
		value: true,
	},
	{
		type: 'ide_setting_change',
		timestamp: '2024-01-31T14:01:00Z',
		setting: 'github.copilot.enable',
		value: { '*': true },
	},
	{
		type: 'git_commit',
		timestamp: '2024-02-01T09:00:00Z',
		message: 'feat: add comprehensive error types with discriminated unions',
		files: ['src/types/errors.ts'],
		additions: 123,
		deletions: 0,
	},
	{
		type: 'git_commit',
		timestamp: '2024-02-01T14:00:00Z',
		message: 'refactor: standardize error handling across all services',
		files: [
			'src/services/*.ts',
			'src/auth/*.ts',
		],
		additions: 189,
		deletions: 234,
	},
	{
		type: 'code_review_given',
		timestamp: '2024-02-02T10:00:00Z',
		pr: 'PR #280',
		comment:
			'The error type hierarchy is excellent. Using exhaustive switch checks will catch issues at compile time.',
		sentiment: 'positive',
	},
	{
		type: 'git_commit',
		timestamp: '2024-02-02T15:00:00Z',
		message: 'feat: add biome for linting and formatting, remove eslint',
		files: ['biome.json', 'package.json', '.eslintrc.js'],
		additions: 45,
		deletions: 234,
	},
	{
		type: 'package_install',
		timestamp: '2024-02-02T15:05:00Z',
		package: '@biomejs/biome',
		version: '^1.5.0',
		reason: 'Faster linting, replaces ESLint + Prettier',
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function createObserver(verbose = false) {
	let totalTokens = 0
	let totalDuration = 0
	let operationCount = 0

	return {
		observer: {
			onStart: (event: { operation: string; input: unknown }) => {
				const inputStr = JSON.stringify(event.input)
				console.log(`\n┌─ ${event.operation.toUpperCase()} START`)
				console.log(
					`│  Input: ${inputStr.length > 100 ? `${inputStr.slice(0, 100)}... (${inputStr.length} chars)` : inputStr}`,
				)
			},
			onStep: (event: {
				stepNumber: number
				toolCalls?: Array<{ toolName: string; input?: unknown }>
				usage?: { totalTokens: number }
				finishReason: string
			}) => {
				const tools = event.toolCalls?.map((tc) => tc.toolName).join(', ')
				const tokens = event.usage ? `(${event.usage.totalTokens} tokens)` : ''
				console.log(
					`│  Step ${event.stepNumber}: ${tools || 'no tools'} ${tokens}`,
				)
				if (verbose && event.toolCalls) {
					for (const tc of event.toolCalls) {
						console.log(`│    └─ ${tc.toolName}: ${JSON.stringify(tc.input).slice(0, 80)}...`)
					}
				}
			},
			onEnd: (event: {
				operation: string
				totalSteps: number
				usage?: { totalTokens: number }
				durationMs: number
				success: boolean
			}) => {
				console.log(`│  Duration: ${event.durationMs}ms, Steps: ${event.totalSteps}`)
				if (event.usage) {
					console.log(`│  Tokens: ${event.usage.totalTokens}`)
					totalTokens += event.usage.totalTokens
				}
				totalDuration += event.durationMs
				operationCount++
				console.log(
					`└─ ${event.operation.toUpperCase()} ${event.success ? 'SUCCESS' : 'FAILED'}`,
				)
			},
		},
		getStats: () => ({ totalTokens, totalDuration, operationCount }),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Eval
// ─────────────────────────────────────────────────────────────────────────────

async function runEval() {
	const { observer, getStats } = createObserver(true)

	const learner = new TextLearner({
		model: openrouter(MODEL),
		instructions:
			'Understand this developer\'s coding style, technical preferences, tooling choices, and architectural philosophy',
		observer,
	})

	// ─────────────────────────────────────────────────────────────────────────
	// Process Week 1
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('WEEK 1: Establishing baseline patterns')
	console.log(`Processing ${week1Activity.length} events`)
	console.log('═'.repeat(70))

	const result1 = await learner.ingest(week1Activity)
	console.log(`\nRelevance: ${result1.relevance}`)
	console.log(`\n📝 Understanding after Week 1:`)
	console.log('─'.repeat(50))
	console.log(learner.getUnderstanding())

	// ─────────────────────────────────────────────────────────────────────────
	// Process Week 2
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('WEEK 2: Deepening patterns + noise')
	console.log(`Processing ${week2Activity.length} events`)
	console.log('═'.repeat(70))

	const result2 = await learner.ingest(week2Activity)
	console.log(`\nRelevance: ${result2.relevance}`)
	console.log(`\n📝 Understanding after Week 2:`)
	console.log('─'.repeat(50))
	console.log(learner.getUnderstanding())

	// ─────────────────────────────────────────────────────────────────────────
	// Process Week 3
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('WEEK 3: Evolution and nuance')
	console.log(`Processing ${week3Activity.length} events`)
	console.log('═'.repeat(70))

	const result3 = await learner.ingest(week3Activity)
	console.log(`\nRelevance: ${result3.relevance}`)
	console.log(`\n📝 Understanding after Week 3:`)
	console.log('─'.repeat(50))
	console.log(learner.getUnderstanding())

	// ─────────────────────────────────────────────────────────────────────────
	// Process Week 4
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('WEEK 4: Shifts and pragmatism')
	console.log(`Processing ${week4Activity.length} events`)
	console.log('═'.repeat(70))

	const result4 = await learner.ingest(week4Activity)
	console.log(`\nRelevance: ${result4.relevance}`)
	console.log(`\n📝 Understanding after Week 4:`)
	console.log('─'.repeat(50))
	console.log(learner.getUnderstanding())

	// ─────────────────────────────────────────────────────────────────────────
	// Queries
	// ─────────────────────────────────────────────────────────────────────────
	console.log('\n' + '═'.repeat(70))
	console.log('QUERIES')
	console.log('═'.repeat(70))

	const queries = [
		'What is my overall coding philosophy?',
		'How do I handle errors in my code?',
		'What testing practices do I follow?',
		'Do I prefer OOP or functional programming? Has this changed over time?',
		'What tools and libraries do I prefer?',
		'How do I approach code architecture?',
		'What are my formatting and linting preferences?',
		'What is my favorite programming language?', // Should have low confidence
	]

	for (const query of queries) {
		console.log(`\n${'─'.repeat(50)}`)
		console.log(`Q: ${query}`)
		console.log('─'.repeat(50))

		const result = await learner.ask(query)
		console.log(`\nRelevant: ${result.relevant} | Confidence: ${result.confidence}`)
		console.log(`\nInsight: ${result.insight}`)
		if (result.gaps.length > 0) {
			console.log(`\nGaps: ${result.gaps.join('; ')}`)
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Final Stats
	// ─────────────────────────────────────────────────────────────────────────
	const stats = getStats()
	const totalEvents =
		week1Activity.length +
		week2Activity.length +
		week3Activity.length +
		week4Activity.length

	console.log('\n' + '═'.repeat(70))
	console.log('FINAL STATISTICS')
	console.log('═'.repeat(70))
	console.log(`\nData processed: ${totalEvents} events across 4 weeks`)
	console.log(`Queries answered: ${queries.length}`)
	console.log(`Total operations: ${stats.operationCount}`)
	console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`)
	console.log(`Total duration: ${(stats.totalDuration / 1000).toFixed(1)}s`)
	console.log(`Avg tokens/operation: ${Math.round(stats.totalTokens / stats.operationCount)}`)

	console.log('\nGovernance:')
	const gov = learner.getGovernance()
	console.log(`  Status: ${gov.status}`)
	console.log(`  Activation: ${gov.activation.toFixed(3)}`)
	console.log(`  Retrieval count: ${gov.retrievalCount}`)

	console.log('\n✅ Eval complete\n')
}

runEval().catch((err) => {
	console.error('\n❌ Eval failed:', err)
	process.exit(1)
})
