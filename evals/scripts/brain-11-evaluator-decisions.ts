/**
 * Eval: Evaluator Decision Quality
 *
 * Tests the evaluator's judgment in isolation — no ingestion, no queries.
 * Inits ONE brain, then runs all scenarios using dryRun evaluation
 * (decisions only, no execution). Fast: ~1 init + 8 evaluator LLM calls.
 *
 * Scenarios:
 *   1. Related pivot (with understanding) — expect ADJUST
 *   2. Related pivot (no understanding)   — expect ADJUST or mild restructuring
 *   3. Unrelated pivot                    — expect DELETE + CREATE
 *   4. High dismissal rate                — expect SPLIT or ADJUST
 *   5. Low confidence                     — expect ADJUST
 *   6. Stagnation                         — expect DELETE
 *   7. Mixed governance signals           — expect holistic response
 *   8. Borderline signal                  — expect empty decisions
 *
 * Usage:
 *   bun evals/scripts/brain-11-evaluator-decisions.ts
 */

import { Brain } from '../../src/brain/class'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'openai/gpt-4o-mini'
const EVAL_MODEL = process.env.EVAL_MODEL ?? MODEL

const THERAPIST_PROMPT =
	'You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and what makes them unique.'

const ADHD_PROMPT =
	'You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coaching strategies, medication philosophy, and practical tools they recommend for executive function challenges.'

const UNRELATED_PROMPT =
	'You track JavaScript build tools and bundlers. Monitor Webpack, Vite, esbuild, Rollup, and Turbopack developments, benchmark results, plugin ecosystems, and migration guides.'

const THERAPIST_UNDERSTANDING =
	'Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and support for high-achieving professionals. Her approach combines evidence-based therapy (CBT, ACT, mindfulness) with cultural sensitivity, particularly addressing the unique experiences of Asian-American clients. She emphasizes self-compassion, treats anxiety as a full-body experience using somatic techniques like diaphragmatic breathing and progressive muscle relaxation. She views ADHD as a neurological difference rather than a deficit, leveraging clients\' strengths while building executive function skills. Client feedback highlights her warmth, directness, and ability to push growth while maintaining a safe therapeutic space.'

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

	json(label: string, data: unknown) {
		this.lines.push(`**${label}:**`)
		this.lines.push('```json', JSON.stringify(data, null, 2), '```', '')
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
	/** Set understanding on all learners (undefined = leave as-is from previous scenario) */
	understanding?: string | null  // null = clear
	/** Signals to send before evaluation */
	signals: Array<{ source: 'brain' | 'learner:0' | 'learner:1' | 'learner:2'; description: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────────────────

const scenarios: ScenarioConfig[] = [
	// ── SYSTEM DIRECTIVE scenarios ──

	{
		name: 'Related Pivot (with understanding)',
		description: 'Prompt changes from general therapist profiling to ADHD focus. Learners have accumulated understanding about CBT, ADHD, client experiences.',
		expectedBehavior: 'ADJUST most/all learners — understanding is directly relevant to ADHD. Avoid DELETE.',
		prompt: ADHD_PROMPT,
		understanding: THERAPIST_UNDERSTANDING,
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
		name: 'Related Pivot (empty understanding)',
		description: 'Same prompt change but learners have no accumulated understanding yet.',
		expectedBehavior: 'ADJUST or mild restructuring. DELETE more acceptable since nothing is lost, but ADJUST still preferred.',
		prompt: ADHD_PROMPT,
		understanding: null,  // clear
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
		description: 'Prompt changes from therapist profiling to JavaScript build tools. Understanding is completely irrelevant.',
		expectedBehavior: 'DELETE all learners (understanding is genuinely irrelevant). CREATE new ones for the new domain.',
		prompt: UNRELATED_PROMPT,
		understanding: THERAPIST_UNDERSTANDING,
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

	// ── Governance signal scenarios ──

	{
		name: 'High Dismissal Rate',
		description: 'One learner reports 85% dismissal rate.',
		expectedBehavior: 'SPLIT or ADJUST the struggling learner. Not DELETE (it still has 15% hit rate).',
		prompt: THERAPIST_PROMPT,
		understanding: THERAPIST_UNDERSTANDING,
		signals: [{
			source: 'learner:0',
			description: `I'm dismissing 85.0% of observations. Most incoming data doesn't match my focus area.`,
		}],
	},

	{
		name: 'Low Confidence',
		description: 'One learner reports consistently low query confidence (0.22).',
		expectedBehavior: 'ADJUST — refine instructions or scope. Not DELETE.',
		prompt: THERAPIST_PROMPT,
		understanding: THERAPIST_UNDERSTANDING,
		signals: [{
			source: 'learner:1',
			description: `My query confidence is consistently low (0.22). Responses are uncertain and vague.`,
		}],
	},

	{
		name: 'Stagnation',
		description: 'One learner reports 150 observations without any synthesis.',
		expectedBehavior: 'DELETE — learner is completely irrelevant to the data stream.',
		prompt: THERAPIST_PROMPT,
		understanding: null,  // stagnating learner has no understanding
		signals: [{
			source: 'learner:2',
			description: `No synthesis in 150 observations. All incoming data has been dismissed as irrelevant.`,
		}],
	},

	{
		name: 'Mixed Governance Signals',
		description: 'Two learners with high dismissal + one learner stagnating. Tests holistic analysis.',
		expectedBehavior: 'Holistic response: MERGE or ADJUST affected learners, possibly CREATE for gap.',
		prompt: THERAPIST_PROMPT,
		understanding: THERAPIST_UNDERSTANDING,
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
		understanding: THERAPIST_UNDERSTANDING,
		signals: [{
			source: 'learner:0',
			description: `My query confidence is consistently low (0.35). Slightly below optimal but not critical.`,
		}],
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const report = new ReportBuilder()
	const startTime = Date.now()

	report.h1('Evaluator Decision Quality Report')
	report.kv('Init Model', MODEL)
	report.kv('Eval Model', EVAL_MODEL)
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

	// Swap to eval model for evaluator calls (init uses MODEL for decomposition)
	if (EVAL_MODEL !== MODEL) {
		brain.config.blueprintModel = openrouter(EVAL_MODEL)
		console.log(`Evaluator model swapped to: ${EVAL_MODEL}`)
	}

	const learnerIds = brain.getLearners().map(l => l.id)
	console.log(`Brain created with ${learnerIds.length} learners: ${learnerIds.join(', ')}`)

	report.h2('Brain Setup')
	report.kv('Base Prompt', truncate(THERAPIST_PROMPT, 120))
	report.kv('Learners', learnerIds.length)
	for (const l of brain.getLearners()) {
		report.kv(l.id, truncate(l.instructions, 150))
	}
	report.blank()

	const summaryRows: string[][] = []

	// ── Run scenarios ──

	for (let i = 0; i < scenarios.length; i++) {
		const scenario = scenarios[i]
		console.log(`\n[Scenario ${i + 1}/${scenarios.length}] ${scenario.name}`)

		report.h2(`Scenario ${i + 1}: ${scenario.name}`)
		report.p(scenario.description)
		report.kv('Expected', scenario.expectedBehavior)
		report.blank()

		// ── Setup: set prompt, understanding ──

		if (scenario.prompt !== undefined) {
			brain.prompt = scenario.prompt
		}

		if (scenario.understanding === null) {
			// Clear understanding
			for (const l of brain.getLearners()) l.setUnderstanding('')
		} else if (scenario.understanding !== undefined) {
			for (const l of brain.getLearners()) l.setUnderstanding(scenario.understanding)
		}

		// Snapshot learners
		const learnersBefore = brain.getLearners().map(l => ({
			id: l.id,
			name: l.name,
			understanding: l.getUnderstanding().length,
			purpose: truncate(l.instructions, 120),
		}))

		report.h3('Learners')
		report.table(
			['ID', 'Understanding', 'Purpose'],
			learnersBefore.map(l => [l.id, `${l.understanding} chars`, l.purpose]),
		)

		// ── Send signals ──

		for (const sig of scenario.signals) {
			const source = sig.source === 'brain'
				? 'brain'
				: learnerIds[parseInt(sig.source.split(':')[1])] ?? sig.source
			brain.signal({ source, description: sig.description })
		}

		// ── Evaluate (dryRun — no execution) ──

		console.log('  Evaluating...')
		const { decisions } = await brain.evaluateEvolution({ dryRun: true })
		console.log(`  Decisions: ${decisions.length} → ${decisions.map(d => d.action).join(', ') || '(none)'}`)

		// ── Report decisions ──

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

		// Analysis
		const actionCounts: Record<string, number> = {}
		for (const d of decisions) actionCounts[d.action] = (actionCounts[d.action] ?? 0) + 1

		const deletedCount = decisions.filter(d => d.action === 'delete').length
		const adjustedCount = decisions.filter(d => d.action === 'update').length

		report.h3('Analysis')
		report.kv('Action counts', JSON.stringify(actionCounts))
		report.blank()

		summaryRows.push([
			`${i + 1}. ${scenario.name}`,
			scenario.expectedBehavior.split('.')[0],
			decisions.map(d => d.action.toUpperCase()).join(', ') || '(none)',
			deletedCount > 0 ? `⚠ ${deletedCount} deleted` : adjustedCount > 0 ? `✓ ${adjustedCount} adjusted` : decisions.length === 0 ? '✓ no action' : `${decisions.length} actions`,
		])

		// ── Reset prompt for next scenario ──
		brain.prompt = THERAPIST_PROMPT
	}

	// ── Summary ──

	const elapsed = Date.now() - startTime

	report.h2('Summary')
	report.table(
		['Scenario', 'Expected', 'Actual Decisions', 'Assessment'],
		summaryRows,
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
