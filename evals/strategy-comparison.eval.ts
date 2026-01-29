/**
 * Strategy Comparison Eval
 *
 * Tests the same data with 3 learners using different strategies:
 * - continuous: Understanding grows without limits
 * - cumulative: Summarizes when exceeding token limits, carries forward
 * - decay: Older stuff fades, recent stays detailed
 *
 * Run with: OPENROUTER_API_KEY=xxx bun evals/strategy-comparison.eval.ts
 *
 * Optional env vars:
 *   MODEL=anthropic/claude-haiku-4 (default)
 *   VERBOSE=true (show tool call details)
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { Strategy, LearnerObserver, LearnerEndEvent } from '../src/learners'
import { TextLearner, STRATEGIES } from '../src/learners'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'anthropic/claude-haiku-4'
const VERBOSE = process.env.VERBOSE === 'true'

console.log(`\n🧪 Strategy Comparison Eval`)
console.log(`Model: ${MODEL}`)
console.log(`Strategies: ${STRATEGIES.join(', ')}\n`)

// ─────────────────────────────────────────────────────────────────────────────
// Test Data - Developer activity (same as text-learner.eval.ts)
// ─────────────────────────────────────────────────────────────────────────────

const testData = [
	// Week 1: Establishing baseline
	[
		{ type: 'git_commit', message: 'feat: add user authentication flow', files: ['src/auth/login.ts'] },
		{ type: 'git_commit', message: 'refactor: extract validation logic into pure functions', files: ['src/utils/validators.ts'] },
		{ type: 'ide_setting_change', setting: 'editor.formatOnSave', value: true },
		{ type: 'package_install', package: 'zod', reason: 'Schema validation' },
		{ type: 'code_review_given', pr: 'PR #234', comment: 'Consider using a discriminated union here' },
	],
	// Week 2: Deepening patterns
	[
		{ type: 'git_commit', message: 'chore: migrate from Jest to Vitest', files: ['vitest.config.ts'] },
		{ type: 'package_install', package: 'vitest', reason: 'Test runner replacement' },
		{ type: 'git_commit', message: 'feat: add Result type for explicit error handling', files: ['src/types/result.ts'] },
		{ type: 'code_review_given', pr: 'PR #245', comment: "Let's avoid try/catch here and use the Result type" },
		{ type: 'git_commit', message: 'feat: implement pipe utility for function composition', files: ['src/utils/pipe.ts'] },
		{ type: 'browser_bookmark', url: 'https://fsharpforfunandprofit.com/posts/recipe-part2/', title: 'Railway Oriented Programming' },
	],
	// Week 3: Evolution
	[
		{ type: 'git_commit', message: 'feat: add dependency injection container', files: ['src/di/container.ts'] },
		{ type: 'code_review_received', from: 'senior_dev', comment: 'Consider if we need some OOP for stateful services like connection pools.' },
		{ type: 'git_commit', message: 'feat: add connection pool using class with private state', files: ['src/db/connection-pool.ts'] },
		{ type: 'git_commit', message: 'docs: add ADR for hybrid FP/OOP approach', files: ['docs/adr/003-hybrid-paradigm.md'] },
		{ type: 'package_install', package: 'fp-ts', reason: 'Functional programming utilities' },
	],
	// Week 4: Pragmatic shifts
	[
		{ type: 'meeting_notes', title: 'Performance Review', notes: 'FP approach causing issues with bundle size.' },
		{ type: 'slack_message', content: 'fp-ts adds 50kb to bundle. Writing our own minimal utilities instead.' },
		{ type: 'git_commit', message: 'refactor: replace fp-ts with minimal custom utilities', files: ['src/utils/either.ts'] },
		{ type: 'package_uninstall', package: 'fp-ts', reason: 'Bundle size concerns' },
		{ type: 'git_commit', message: 'feat: add biome for linting and formatting', files: ['biome.json'] },
		{ type: 'package_install', package: '@biomejs/biome', reason: 'Faster linting, replaces ESLint + Prettier' },
	],
]

// ─────────────────────────────────────────────────────────────────────────────
// Observer Factory
// ─────────────────────────────────────────────────────────────────────────────

interface Stats {
	tokens: number
	duration: number
	operations: number
}

function createObserver(id: string): { observer: LearnerObserver; stats: Stats } {
	const stats: Stats = { tokens: 0, duration: 0, operations: 0 }

	const observer: LearnerObserver = {
		onStart: (event) => {
			console.log(`  [${id}] ${event.operation} start`)
		},
		onStep: (event) => {
			if (event.usage) {
				stats.tokens += event.usage.totalTokens
			}
			if (VERBOSE && event.toolCalls) {
				const tools = event.toolCalls.map((tc) => tc.toolName).join(', ')
				console.log(`    Step ${event.stepNumber}: ${tools}`)
			}
		},
		onEnd: (event) => {
			stats.duration += event.durationMs
			stats.operations++
			const status = event.success ? '✓' : '✗'
			console.log(`  [${id}] ${event.operation} ${status} (${event.durationMs}ms, ${event.usage?.totalTokens ?? 0} tokens)`)
			if (event.entry) {
				console.log(`    → ${event.entry.significance}: ${event.entry.summary}`)
			}
		},
	}

	return { observer, stats }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LearnerResult {
	strategy: Strategy
	understandingSnapshots: string[]
	evolutionEntries: Array<{ summary: string; significance: string }>
	finalUnderstanding: string
	stats: Stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Eval
// ─────────────────────────────────────────────────────────────────────────────

async function runEval() {
	const results: LearnerResult[] = []

	// Create one learner per strategy
	for (const strategy of STRATEGIES) {
		console.log(`\n${'═'.repeat(70)}`)
		console.log(`STRATEGY: ${strategy}`)
		console.log(`${'═'.repeat(70)}`)

		const { observer, stats } = createObserver(strategy)
		const evolutionEntries: Array<{ summary: string; significance: string }> = []
		const understandingSnapshots: string[] = []

		// Track evolution entries
		const trackingObserver: LearnerObserver = {
			...observer,
			onEnd: (event: LearnerEndEvent) => {
				observer.onEnd?.(event)
				if (event.entry) {
					evolutionEntries.push({
						summary: event.entry.summary,
						significance: event.entry.significance,
					})
				}
			},
		}

		const learner = new TextLearner({
			model: openrouter(MODEL),
			instructions: "Understand this developer's coding style, technical preferences, tooling choices, and architectural philosophy",
			maintenance: {
				strategy,
				maxTokens: 1500, // Low limit to trigger cumulative and decay maintenance
			},
			observer: trackingObserver,
		})

		// Process each batch
		for (let i = 0; i < testData.length; i++) {
			console.log(`\n─── Batch ${i + 1}/${testData.length} (${testData[i].length} events) ───`)

			try {
				const result = await learner.ingest(testData[i])
				console.log(`  Relevance: ${result.relevance.toFixed(2)}`)

				// Take snapshot of understanding
				const understanding = learner.getUnderstanding()
				understandingSnapshots.push(understanding)

				// Show understanding length
				console.log(`  Understanding: ${understanding.length} chars`)
			} catch (error) {
				console.error(`  ❌ Error:`, error instanceof Error ? error.message : error)
			}
		}

		results.push({
			strategy,
			understandingSnapshots,
			evolutionEntries,
			finalUnderstanding: learner.getUnderstanding(),
			stats,
		})
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Report
	// ─────────────────────────────────────────────────────────────────────────
	console.log(`\n${'═'.repeat(70)}`)
	console.log('COMPARISON REPORT')
	console.log(`${'═'.repeat(70)}`)

	// Stats comparison
	console.log('\n📊 Statistics:')
	console.log('─'.repeat(50))
	console.log('Strategy          | Tokens    | Duration  | Operations')
	console.log('─'.repeat(50))
	for (const r of results) {
		const strategy = r.strategy.padEnd(17)
		const tokens = r.stats.tokens.toLocaleString().padStart(9)
		const duration = `${(r.stats.duration / 1000).toFixed(1)}s`.padStart(9)
		const ops = r.stats.operations.toString().padStart(10)
		console.log(`${strategy} | ${tokens} | ${duration} | ${ops}`)
	}

	// Understanding length evolution
	console.log('\n📈 Understanding Length Evolution (chars):')
	console.log('─'.repeat(50))
	console.log('Strategy          | Batch 1 | Batch 2 | Batch 3 | Batch 4')
	console.log('─'.repeat(50))
	for (const r of results) {
		const strategy = r.strategy.padEnd(17)
		const lengths = r.understandingSnapshots.map((s) => s.length.toString().padStart(7)).join(' |')
		console.log(`${strategy} | ${lengths}`)
	}

	// Evolution entries
	console.log('\n📜 Evolution Entries:')
	for (const r of results) {
		console.log(`\n[${r.strategy}]`)
		for (const entry of r.evolutionEntries) {
			const icon = entry.significance === 'critical' ? '🔴' : entry.significance === 'notable' ? '🟡' : '⚪'
			console.log(`  ${icon} ${entry.significance}: ${entry.summary}`)
		}
	}

	// Final understanding comparison
	console.log('\n📝 Final Understanding:')
	for (const r of results) {
		console.log(`\n${'─'.repeat(50)}`)
		console.log(`[${r.strategy}] (${r.finalUnderstanding.length} chars)`)
		console.log('─'.repeat(50))
		console.log(r.finalUnderstanding || '(empty)')
	}

	console.log('\n✅ Eval complete\n')
}

runEval().catch((err) => {
	console.error('\n❌ Eval failed:', err)
	process.exit(1)
})
