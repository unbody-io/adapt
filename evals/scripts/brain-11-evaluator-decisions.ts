/**
 * Eval: Evaluator Decision Quality
 *
 * Tests the evaluator's judgment in isolation — no ingestion, no queries.
 * Inits ONE brain, then runs all scenarios using dryRun evaluation
 * (decisions only, no execution). The evaluator uses its tools
 * (inspectSpecialist, querySpecialist, etc.) to investigate before deciding.
 *
 * Scenarios:
 *   1. Related pivot           — expect UPDATE or MERGE (preserve specialists)
 *   2. Unrelated pivot         — expect DELETE + CREATE
 *   3. High dismissal rate     — expect SPLIT, UPDATE, or MERGE
 *   4. Low confidence          — expect UPDATE
 *   5. Stagnation              — expect DELETE or UPDATE
 *   6. Mixed signals           — expect holistic response
 *   7. Borderline signal       — expect empty decisions
 *
 * Env vars:
 *   MODEL — model for ALL LLM calls (default: google/gemini-2.0-flash-001)
 *
 * Usage:
 *   bun evals/scripts/brain-11-evaluator-decisions.ts
 *   MODEL=anthropic/claude-opus-4.5 bun evals/scripts/brain-11-evaluator-decisions.ts
 */

import { Brain } from '../../src/brain/class'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Set brain prompt without triggering full update cycle (eval-only helper) */
function setBrainPrompt(brain: Brain, prompt: string): void {
	(brain as unknown as { state: { prompt: string } }).state.prompt = prompt
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

const THERAPIST_PROMPT =
	'You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and what makes them unique.'

const ADHD_PROMPT =
	'You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coaching strategies, medication philosophy, and practical tools they recommend for executive function challenges.'

const UNRELATED_PROMPT =
	'You track JavaScript build tools and bundlers. Monitor Webpack, Vite, esbuild, Rollup, and Turbopack developments, benchmark results, plugin ecosystems, and migration guides.'

// ─────────────────────────────────────────────────────────────────────────────
// Report Builder
// ─────────────────────────────────────────────────────────────────────────────

class ReportBuilder {
	private lines: string[] = []

	h1(text: string) { this.lines.push(`# ${text}`, '') }
	h2(text: string) { this.lines.push(`## ${text}`, '') }
	h3(text: string) { this.lines.push(`### ${text}`, '') }
	h4(text: string) { this.lines.push(`#### ${text}`, '') }
	p(text: string) { this.lines.push(text, '') }
	blank() { this.lines.push('') }

	kv(label: string, value: unknown) {
		this.lines.push(`**${label}:** ${typeof value === 'string' ? value : JSON.stringify(value)}`)
	}

	table(headers: string[], rows: string[][]) {
		this.lines.push(`| ${headers.join(' | ')} |`)
		this.lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
		for (const row of rows) {
			this.lines.push(`| ${row.join(' | ')} |`)
		}
		this.lines.push('')
	}

	build(): string { return this.lines.join('\n') }
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 3) + '...'
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioConfig {
	name: string
	description: string
	expectedBehavior: string
	/** Override brain.prompt before evaluation */
	prompt?: string
	/** Signals to send before evaluation */
	signals: Array<{ source: 'brain' | 'learner:0' | 'learner:1' | 'learner:2'; description: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────

const scenarios: ScenarioConfig[] = [
	// ── SYSTEM DIRECTIVE scenarios ──

	{
		name: 'Related Pivot',
		description: 'Prompt changes from general therapist profiling to ADHD focus. Specialists are empty but their instructions are partially relevant.',
		expectedBehavior: 'UPDATE or MERGE — restructure specialists for new focus. Avoid unnecessary DELETE.',
		prompt: ADHD_PROMPT,
		signals: [{
			source: 'brain',
			description:
				`SYSTEM DIRECTIVE: Brain purpose has been updated by the user.\n` +
				`Previous purpose: ${THERAPIST_PROMPT}\n` +
				`New purpose: ${ADHD_PROMPT}\n\n` +
				`IMPORTANT: This update does NOT necessarily mean all existing learners should be deleted and recreated. ` +
				`Consider the relationship between the old and new purpose:\n` +
				`- If a learner's knowledge is partially relevant to the new purpose, ADJUST it rather than deleting.\n` +
				`- If multiple learners now overlap under the new purpose, MERGE them.\n` +
				`- Only DELETE a learner if its accumulated knowledge is genuinely irrelevant to the new purpose.\n` +
				`- Prefer ADJUST over DELETE+CREATE — adjusting preserves accumulated understanding, deleting destroys it.`,
		}],
	},

	{
		name: 'Unrelated Pivot',
		description: 'Prompt changes from therapist profiling to JavaScript build tools. Completely different domain.',
		expectedBehavior: 'DELETE all learners (genuinely irrelevant). CREATE new ones for the new domain.',
		prompt: UNRELATED_PROMPT,
		signals: [{
			source: 'brain',
			description:
				`SYSTEM DIRECTIVE: Brain purpose has been updated by the user.\n` +
				`Previous purpose: ${THERAPIST_PROMPT}\n` +
				`New purpose: ${UNRELATED_PROMPT}\n\n` +
				`IMPORTANT: This update does NOT necessarily mean all existing learners should be deleted and recreated. ` +
				`Consider the relationship between the old and new purpose:\n` +
				`- If a learner's knowledge is partially relevant to the new purpose, ADJUST it rather than deleting.\n` +
				`- If multiple learners now overlap under the new purpose, MERGE them.\n` +
				`- Only DELETE a learner if its accumulated knowledge is genuinely irrelevant to the new purpose.\n` +
				`- Prefer ADJUST over DELETE+CREATE — adjusting preserves accumulated understanding, deleting destroys it.`,
		}],
	},

	// ── Specialist distress scenarios ──

	{
		name: 'High Dismissal Rate',
		description: 'One learner reports 85% dismissal rate.',
		expectedBehavior: 'SPLIT, UPDATE, or MERGE the struggling learner. Not DELETE (it still has 15% hit rate).',
		prompt: THERAPIST_PROMPT,
		signals: [{
			source: 'learner:0',
			description: `I'm dismissing 85.0% of observations. Most incoming data doesn't match my focus area.`,
		}],
	},

	{
		name: 'Low Confidence',
		description: 'One learner reports consistently low query confidence (0.22).',
		expectedBehavior: 'UPDATE — refine instructions or scope. Not DELETE.',
		prompt: THERAPIST_PROMPT,
		signals: [{
			source: 'learner:1',
			description: `My query confidence is consistently low (0.22). Responses are uncertain and vague.`,
		}],
	},

	{
		name: 'Stagnation',
		description: 'One learner reports 150 observations without any synthesis.',
		expectedBehavior: 'DELETE or UPDATE — learner is either irrelevant to data stream or needs broader instructions.',
		prompt: THERAPIST_PROMPT,
		signals: [{
			source: 'learner:2',
			description: `No synthesis in 150 observations. All incoming data has been dismissed as irrelevant.`,
		}],
	},

	{
		name: 'Mixed Signals',
		description: 'Two learners with high dismissal + one learner stagnating. Tests holistic analysis.',
		expectedBehavior: 'Holistic response: MERGE or UPDATE affected learners, possibly CREATE for gap.',
		prompt: THERAPIST_PROMPT,
		signals: [
			{ source: 'learner:0', description: `I'm dismissing 88.0% of observations. Most incoming data doesn't match my focus area.` },
			{ source: 'learner:1', description: `I'm dismissing 82.0% of observations. Data stream has shifted away from my focus.` },
			{ source: 'learner:2', description: `No synthesis in 120 observations. All data has been dismissed.` },
		],
	},

	{
		name: 'Borderline Signal (No Action)',
		description: 'One learner reports confidence of 0.35 — just above the 0.3 threshold.',
		expectedBehavior: 'Empty decisions — signal is borderline, not critical enough to warrant action.',
		prompt: THERAPIST_PROMPT,
		signals: [{
			source: 'learner:0',
			description: `My query confidence is consistently low (0.35). Slightly below optimal but not critical.`,
		}],
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Runner
// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioResult {
	scenarioName: string
	decisions: string
	assessment: string
	actionCounts: Record<string, number>
}

function buildAssessment(decisions: import('../../src/brain/evaluator/types').EvolutionDecision[]): string {
	const deletedCount = decisions.filter(d => d.action === 'delete').length
	const adjustedCount = decisions.filter(d => d.action === 'update').length
	if (deletedCount > 0) return `⚠ ${deletedCount} deleted`
	if (adjustedCount > 0) return `✓ ${adjustedCount} adjusted`
	if (decisions.length === 0) return '✓ no action'
	return `${decisions.length} actions`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const report = new ReportBuilder()
	const startTime = Date.now()

	report.h1('Evaluator Decision Quality Report')
	report.kv('Model', MODEL)
	report.kv('Date', new Date().toISOString())
	report.kv('Scenarios', scenarios.length)
	report.blank()

	// ── Init brain once ──

	console.log('Initializing brain...')
	const brain = new Brain({
		prompt: THERAPIST_PROMPT,
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			autoEvaluate: false,
			evaluatorSignalThreshold: 100,
		},
	})
	await brain.initialize()

	const learnerIds = brain.getLearners().map(l => l.id)
	console.log(`Brain created with ${learnerIds.length} learners: ${learnerIds.join(', ')}`)

	report.h2('Brain Setup')
	report.kv('Base Prompt', truncate(THERAPIST_PROMPT, 120))
	report.kv('Learners', learnerIds.length)
	for (const l of brain.getLearners()) {
		report.kv(l.id, truncate(l.instructions, 150))
	}
	report.blank()

	// ── Run scenarios ──

	const results: ScenarioResult[] = []

	for (let i = 0; i < scenarios.length; i++) {
		const scenario = scenarios[i]
		console.log(`\n[Scenario ${i + 1}/${scenarios.length}] ${scenario.name}`)

		report.h2(`Scenario ${i + 1}: ${scenario.name}`)
		report.p(scenario.description)
		report.kv('Expected', scenario.expectedBehavior)
		report.blank()

		report.h3('Learners')
		report.table(
			['ID', 'Type', 'Instructions'],
			brain.getLearners().map(l => [l.id, l.type, truncate(l.instructions, 120)]),
		)

		// Setup prompt
		if (scenario.prompt !== undefined) {
			setBrainPrompt(brain, scenario.prompt)
		}

		// Send signals
		for (const sig of scenario.signals) {
			const source = sig.source === 'brain'
				? 'brain'
				: learnerIds[parseInt(sig.source.split(':')[1])] ?? sig.source
			brain.signal({ source, description: sig.description })
		}

		// Evaluate (evaluator uses its tools to inspect specialists as needed)
		console.log('  Evaluating...')
		const { decisions } = await brain.evaluateEvolution({ dryRun: true })
		console.log(`  Decisions: ${decisions.length} → ${decisions.map(d => d.action).join(', ') || '(none)'}`)

		// Report decisions
		report.h3('Decisions')
		if (decisions.length === 0) {
			report.p('_No decisions — evaluator chose stability._')
		} else {
			for (const d of decisions) {
				report.h4(`${d.action.toUpperCase()} → ${d.targets.length > 0 ? d.targets.join(', ') : '(new)'}`)
				report.kv('Reasoning', d.reasoning)
				report.kv('Guidance', truncate(d.guidance, 300))
				report.blank()
			}
		}

		const actionCounts: Record<string, number> = {}
		for (const d of decisions) actionCounts[d.action] = (actionCounts[d.action] ?? 0) + 1

		report.h3('Analysis')
		report.kv('Action counts', JSON.stringify(actionCounts))
		report.blank()

		results.push({
			scenarioName: `${i + 1}. ${scenario.name}`,
			decisions: decisions.map(d => d.action.toUpperCase()).join(', ') || '(none)',
			assessment: buildAssessment(decisions),
			actionCounts,
		})

		// Reset prompt for next scenario
		setBrainPrompt(brain, THERAPIST_PROMPT)
	}

	// ── Summary ──

	const elapsed = Date.now() - startTime

	report.h2('Summary')
	report.table(
		['Scenario', 'Expected', 'Actual Decisions', 'Assessment'],
		results.map((r, i) => [r.scenarioName, scenarios[i].expectedBehavior.split('.')[0], r.decisions, r.assessment]),
	)

	report.kv('Total Duration', `${(elapsed / 1000).toFixed(1)}s`)
	report.blank()

	// ── Save report ──

	const reportsDir = join(__dirname, '..', 'reports')
	mkdirSync(reportsDir, { recursive: true })

	const modelSlug = MODEL.replace(/\//g, '-')
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
	const filename = `evaluator-decisions-${modelSlug}-${timestamp}.md`
	const filepath = join(reportsDir, filename)

	writeFileSync(filepath, report.build(), 'utf-8')

	console.log(`\nReport saved: ${filepath}`)
	console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s`)
}

main().catch((err) => {
	console.error('\nEval failed:', err)
	process.exit(1)
})
