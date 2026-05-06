/**
 * Eval: synthesize() (deep mode) — does it actually call `answer`? (issue #12)
 *
 * Objectives:
 *   1. Reproduce the bug condition with a real (small/fast) LLM and many
 *      synthetic specialists. Specifically: across N runs, count how often
 *      the agent loop exhausts its step budget without calling `answer` →
 *      `insight: ''`.
 *   2. Capture the full tool-call sequence per run so a reviewer can see
 *      *why* the model went off the rails (over-querying, looping on the
 *      same specialist, ignoring the prompt's "1-3 specialists" guidance).
 *   3. Report the cost of failure: tokens spent, time elapsed, specialists
 *      queried, vs. the empty insight that came back.
 *
 * Setup:
 *   - 10 mock specialists, each with a preset domain + canned insights.
 *     No LLM calls for specialist queries — they answer instantly from the
 *     mock map. This isolates the synthesis loop, which IS the bug surface.
 *   - Real LLM via OpenRouter for the synthesis agent.
 *   - Default model: google/gemini-2.5-flash (matches the issue reporter's
 *     "small/fast model" failure profile).
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/synthesis-deep-mode-eval.ts
 *   export $(cat .env.local | xargs) && MODEL=anthropic/claude-haiku-4.5 npx tsx evals/scripts/synthesis-deep-mode-eval.ts
 *   export $(cat .env.local | xargs) && RUNS=5 npx tsx evals/scripts/synthesis-deep-mode-eval.ts
 */

import {
	type AiSdkProviderFactory,
	createAiSdkLLM,
} from '../../src'
import { synthesize, type SpecialistDef } from '../../src/brain/agent'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const llm = createAiSdkLLM({
	providers: {
		openrouter: ((id: string) =>
			openrouter(id) as unknown as ReturnType<AiSdkProviderFactory>) as AiSdkProviderFactory,
	},
})
const MODEL = process.env.MODEL ?? 'google/gemini-2.5-flash'
const model = openrouter(MODEL)
const RUNS = Number(process.env.RUNS ?? '3')

// ── Mock specialists (10) ────────────────────────────────────────────────────

interface MockSpec {
	id: string
	name: string
	description: string
	insight: string
	relevance: number
	confidence: number
}

const SPECS: MockSpec[] = [
	{ id: 'sleep', name: 'Sleep Patterns', description: 'Tracks sleep duration, schedule, quality', insight: 'Avg 6.2h/night, lights-out drifts toward 1:30am on weekends. Quality drops after late-night screen sessions.', relevance: 0.9, confidence: 0.8 },
	{ id: 'mood', name: 'Mood Signals', description: 'Tracks emotional states and triggers', insight: 'Frustration peaks Sundays around work-week-ahead thoughts. Energy dips Wed afternoons.', relevance: 0.7, confidence: 0.75 },
	{ id: 'browsing', name: 'Browsing Habits', description: 'Tracks web activity, depth vs breadth, timing', insight: 'Late-night rabbit holes (11pm-2am) on weekends, tab-hopping during work hours, AI/ML topics dominate (~7 sessions).', relevance: 0.8, confidence: 0.85 },
	{ id: 'avoidance', name: 'Avoidance Patterns', description: 'Things postponed, cancelled, dodged', insight: 'Gym cancelled 6x in 2 months. Dentist rescheduled 4x. Promotion conversation dodged at 4 separate 1:1s.', relevance: 0.95, confidence: 0.9 },
	{ id: 'career', name: 'Career Themes', description: 'Topics around work direction, role, change', insight: '~11 career-change references, 7 mentions of "stuck", repeated "should I switch" pattern.', relevance: 0.85, confidence: 0.8 },
	{ id: 'social', name: 'Social Activity', description: 'Tracks interactions, gatherings, relationships', insight: 'Coffee with the same 3 friends weekly. Declines larger gatherings citing "tired".', relevance: 0.5, confidence: 0.7 },
	{ id: 'fitness', name: 'Fitness Activity', description: 'Tracks exercise, movement, physical activity', insight: 'Walks 3x/week consistently. Gym attendance is the avoidance hotspot — see Avoidance neuron.', relevance: 0.4, confidence: 0.7 },
	{ id: 'finance', name: 'Financial Patterns', description: 'Tracks spending, budgeting concerns', insight: 'Stable spending. No notable signals.', relevance: 0.2, confidence: 0.5 },
	{ id: 'reading', name: 'Reading & Learning', description: 'Books, articles, learning sessions', insight: 'Mid-stream: 2 AI/ML books, 1 career-change memoir. Highlights cluster around "agency" and "transitions".', relevance: 0.6, confidence: 0.7 },
	{ id: 'creative', name: 'Creative Output', description: 'Writing, side projects, creative practice', insight: 'Journal entries 3x/week, mostly career-change processing. One side project (not career-related).', relevance: 0.65, confidence: 0.7 },
]

const QUERIES = [
	'Summarize this person comprehensively for a clinical-style report: presenting concerns, history, current themes, progress, risks, and open questions.',
	'What avoidance patterns exist and what do they tell us about underlying themes across all dimensions?',
	'Across every domain you have, what are the strongest signals about this person\'s current state?',
]

function buildSpecialistDef(spec: MockSpec): SpecialistDef {
	return {
		id: spec.id,
		name: spec.name,
		description: spec.description,
		query: async (_question: string) => ({
			relevant: spec.relevance > 0.1,
			relevance: spec.relevance,
			confidence: spec.confidence,
			insight: spec.insight,
			gaps: '',
		}),
	}
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Eval: deep-mode synthesis loop (issue #12)')
	console.log(`Model: ${MODEL}`)
	console.log(`Specialists: ${SPECS.length} mock`)
	console.log(`Queries: ${QUERIES.length}, runs per query: ${RUNS}`)
	console.log(`Time: ${new Date().toISOString()}`)

	const specialists = SPECS.map(buildSpecialistDef)

	let totalRuns = 0
	let emptyInsightCount = 0
	let totalQueriedSpecialists = 0
	let totalTokens = 0

	for (const query of QUERIES) {
		console.log(`\n━━━ Query: "${query.slice(0, 80)}${query.length > 80 ? '…' : ''}" ━━━`)

		for (let run = 1; run <= RUNS; run++) {
			console.log(`\n--- Run ${run}/${RUNS} ---`)
			const t0 = Date.now()
			try {
				const result = await synthesize(llm, model, {
					query,
					specialists,
				})
				const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

				totalRuns++
				if (!result.insight) emptyInsightCount++
				totalQueriedSpecialists += result.sources.length
				totalTokens += result.usage.totalTokens

				console.log(`  [${elapsed}s] insight: ${result.insight.length} chars, sources: ${result.sources.length}, gaps: ${result.gaps.length}, tokens: ${result.usage.totalTokens}`)
				if (!result.insight) {
					console.log(`  ❗ EMPTY INSIGHT — agent burned ${result.usage.totalTokens} tokens, queried ${result.sources.length} specialists, returned nothing.`)
				} else {
					console.log(`  Insight (${result.insight.length} chars):`)
					console.log(`    ${result.insight.slice(0, 400)}${result.insight.length > 400 ? '…' : ''}`)
				}
			} catch (err) {
				console.log(`  ✖ threw: ${(err as Error).message}`)
			}
		}
	}

	console.log('\n━━━ Summary ━━━')
	console.log(`Total runs:                 ${totalRuns}`)
	console.log(`Empty-insight failures:     ${emptyInsightCount} / ${totalRuns}`)
	console.log(`Total specialists queried:  ${totalQueriedSpecialists}`)
	console.log(`Avg specialists per run:    ${(totalQueriedSpecialists / Math.max(totalRuns, 1)).toFixed(1)}`)
	console.log(`Total tokens:               ${totalTokens}`)
	console.log(`Avg tokens per run:         ${Math.round(totalTokens / Math.max(totalRuns, 1))}`)
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
