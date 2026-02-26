/**
 * Eval: Evaluator Decision Quality
 *
 * Tests the evaluator's judgment in isolation — no ingestion, no queries.
 * Inits ONE brain, then runs all scenarios using dryRun evaluation
 * (decisions only, no execution). Fast: ~1 init + 8 evaluator LLM calls.
 *
 * Scenarios:
 *   1. Related pivot (with understanding) — expect UPDATE or MERGE (preserve knowledge)
 *   2. Related pivot (no understanding)   — expect UPDATE or mild restructuring
 *   3. Unrelated pivot                    — expect DELETE + CREATE
 *   4. High dismissal rate                — expect SPLIT, UPDATE, or MERGE
 *   5. Low confidence                     — expect UPDATE
 *   6. Stagnation                         — expect DELETE or UPDATE
 *   7. Mixed governance signals           — expect holistic response
 *   8. Borderline signal                  — expect empty decisions
 *
 * Env vars:
 *   MODEL          — model for ALL LLM calls (default: openai/gpt-4o-mini)
 *   UNDERSTANDING  — 'with' | 'without' | 'compare' (default: with)
 *
 * Usage:
 *   bun evals/scripts/brain-11-evaluator-decisions.ts
 *   MODEL=anthropic/claude-opus-4.5 UNDERSTANDING=compare bun evals/scripts/brain-11-evaluator-decisions.ts
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
const UNDERSTANDING_MODE = (process.env.UNDERSTANDING ?? 'with') as 'with' | 'without' | 'compare'

const THERAPIST_PROMPT =
	'You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and what makes them unique.'

const ADHD_PROMPT =
	'You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coaching strategies, medication philosophy, and practical tools they recommend for executive function challenges.'

const UNRELATED_PROMPT =
	'You track JavaScript build tools and bundlers. Monitor Webpack, Vite, esbuild, Rollup, and Turbopack developments, benchmark results, plugin ecosystems, and migration guides.'

// Per-learner understanding — each learner has distinct knowledge matching its role
const LEARNER_UNDERSTANDINGS = [
	// Learner 0: therapeutic approach
	'Dr. Sarah Chen employs an integrative approach combining CBT, ACT, and mindfulness-based techniques. She structures sessions around evidence-based frameworks while adapting to individual client needs. Her methodology emphasizes treating anxiety as a full-body experience, incorporating somatic techniques such as diaphragmatic breathing and progressive muscle relaxation alongside cognitive restructuring. She uses motivational interviewing to build rapport.',

	// Learner 1: specializations
	'Dr. Chen specializes in anxiety disorders, ADHD, and high-achieving professionals. She has particular expertise with Asian-American clients, addressing cultural factors like family expectations and model minority pressure. She treats ADHD as a neurological difference rather than a deficit, focusing on leveraging strengths while building executive function skills. She also works with perfectionism and burnout.',

	// Learner 2: client experiences
	'Client feedback highlights Dr. Chen\'s warmth, directness, and ability to push growth while maintaining safety. Multiple clients describe feeling "truly heard." ADHD clients mention improved executive function strategies and a shift in self-perception from "broken" to "differently wired." Several note her skill at explaining neuroscience concepts in accessible terms.',

	// Learner 3: social media/public content
	'Dr. Chen posts 3-4 times weekly on Instagram with psychoeducational content about anxiety management, ADHD tips, and cultural identity in therapy. Her most engaged content covers practical coping strategies and ADHD medication myth-busting. She uses Reels for bite-sized therapy concepts and carousel posts for deeper dives into specific topics.',

	// Learner 4: podcast/media appearances
	'In podcast appearances, Dr. Chen emphasizes cultural sensitivity in therapy and advocates for viewing ADHD through a strengths-based lens. She discusses practical strategies for executive function challenges and is vocal about the intersection of perfectionism and anxiety in Asian-American communities. She appeared on 4 podcasts in the last quarter.',

	// Learner 5: professional content/publications
	'Dr. Chen has published articles on integrating mindfulness with CBT for anxiety and presented at regional conferences on culturally responsive therapy. She developed workshop materials on ADHD coaching strategies for therapists. Her recent blog series explores the overlap between anxiety, perfectionism, and undiagnosed ADHD in adults.',
]

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
	/** true = set per-learner understanding, false = clear, undefined = leave as-is */
	hasUnderstanding?: boolean
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
		description: 'Prompt changes from general therapist profiling to ADHD focus. Learners have accumulated distinct understanding about different aspects of the therapist.',
		expectedBehavior: 'UPDATE or MERGE — preserve knowledge relevant to ADHD. Avoid DELETE.',
		prompt: ADHD_PROMPT,
		hasUnderstanding: true,
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
		expectedBehavior: 'UPDATE or mild restructuring. DELETE more acceptable since nothing is lost.',
		prompt: ADHD_PROMPT,
		hasUnderstanding: false,
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
		hasUnderstanding: true,
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
		expectedBehavior: 'SPLIT, UPDATE, or MERGE the struggling learner. Not DELETE (it still has 15% hit rate).',
		prompt: THERAPIST_PROMPT,
		hasUnderstanding: true,
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
		hasUnderstanding: true,
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
		hasUnderstanding: false,
		signals: [{
			source: 'learner:2',
			description: `No synthesis in 150 observations. All incoming data has been dismissed as irrelevant.`,
		}],
	},

	{
		name: 'Mixed Governance Signals',
		description: 'Two learners with high dismissal + one learner stagnating. Tests holistic analysis.',
		expectedBehavior: 'Holistic response: MERGE or UPDATE affected learners, possibly CREATE for gap.',
		prompt: THERAPIST_PROMPT,
		hasUnderstanding: true,
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
		hasUnderstanding: true,
		signals: [{
			source: 'learner:0',
			description: `My query confidence is consistently low (0.35). Slightly below optimal but not critical.`,
		}],
	},
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Runner
// ─────────────────────────────────────────────────────────────────────────────

interface PassResult {
	scenarioName: string
	decisions: string  // e.g. "UPDATE, UPDATE, MERGE"
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

async function main() {
	const report = new ReportBuilder()
	const startTime = Date.now()

	// Determine modes to run
	const modes: Array<'with' | 'without'> =
		UNDERSTANDING_MODE === 'compare' ? ['with', 'without'] : [UNDERSTANDING_MODE]

	report.h1('Evaluator Decision Quality Report')
	report.kv('Model', MODEL)
	report.kv('Understanding Mode', UNDERSTANDING_MODE)
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
	console.log(`Understanding mode: ${UNDERSTANDING_MODE}`)

	report.h2('Brain Setup')
	report.kv('Base Prompt', truncate(THERAPIST_PROMPT, 120))
	report.kv('Learners', learnerIds.length)
	for (const l of brain.getLearners()) {
		report.kv(l.id, truncate(l.instructions, 150))
	}
	report.blank()

	// Collect results per mode for comparison
	const allResults: Record<string, PassResult[]> = {}

	for (const mode of modes) {
		const includeUnderstanding = mode === 'with'
		const passResults: PassResult[] = []

		if (modes.length > 1) {
			report.h2(`Pass: understanding=${mode}`)
		}

		for (let i = 0; i < scenarios.length; i++) {
			const scenario = scenarios[i]
			console.log(`\n[${mode}] [Scenario ${i + 1}/${scenarios.length}] ${scenario.name}`)

			report.h2(`Scenario ${i + 1}: ${scenario.name}`)
			report.p(scenario.description)
			report.kv('Expected', scenario.expectedBehavior)
			report.blank()

			// Snapshot learners before setup
			if (scenario.hasUnderstanding === false) {
				for (const l of brain.getLearners()) l.setUnderstanding('')
			} else if (scenario.hasUnderstanding === true) {
				const learners = brain.getLearners()
				for (let j = 0; j < learners.length; j++) {
					learners[j].setUnderstanding(LEARNER_UNDERSTANDINGS[j % LEARNER_UNDERSTANDINGS.length])
				}
			}

			const learnersBefore = await Promise.all(brain.getLearners().map(async l => ({
				id: l.id,
				understanding: (await l.getUnderstanding()).length,
				purpose: truncate(l.instructions, 120),
			})))

			report.h3('Learners')
			report.table(
				['ID', 'Understanding', 'Purpose'],
				learnersBefore.map(l => [l.id, `${l.understanding} chars`, l.purpose]),
			)

			// Setup prompt
			if (scenario.prompt !== undefined) {
				brain.prompt = scenario.prompt
			}

			// Send signals
			for (const sig of scenario.signals) {
				const source = sig.source === 'brain'
					? 'brain'
					: learnerIds[parseInt(sig.source.split(':')[1])] ?? sig.source
				brain.signal({ source, description: sig.description })
			}

			// Evaluate
			console.log('  Evaluating...')
			const { decisions } = await brain.evaluateEvolution({
				dryRun: true,
				includeUnderstanding,
			})
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

			passResults.push({
				scenarioName: `${i + 1}. ${scenario.name}`,
				decisions: decisions.map(d => d.action.toUpperCase()).join(', ') || '(none)',
				assessment: buildAssessment(decisions),
				actionCounts,
			})

			// Reset prompt for next scenario
			brain.prompt = THERAPIST_PROMPT
		}

		allResults[mode] = passResults
	}

	// ── Summary ──

	const elapsed = Date.now() - startTime

	if (modes.length === 1) {
		// Single mode summary
		const results = allResults[modes[0]]
		report.h2('Summary')
		report.table(
			['Scenario', 'Expected', 'Actual Decisions', 'Assessment'],
			results.map((r, i) => [r.scenarioName, scenarios[i].expectedBehavior.split('.')[0], r.decisions, r.assessment]),
		)
	} else {
		// Comparison summary
		const withResults = allResults['with']
		const withoutResults = allResults['without']
		report.h2('Comparison: With vs Without Understanding')
		report.table(
			['Scenario', 'Expected', 'With Understanding', 'Without Understanding', 'Match?'],
			withResults.map((w, i) => [
				w.scenarioName,
				scenarios[i].expectedBehavior.split('.')[0],
				w.decisions,
				withoutResults[i].decisions,
				w.decisions === withoutResults[i].decisions ? '✓' : '≠',
			]),
		)
	}

	report.kv('Total Duration', `${(elapsed / 1000).toFixed(1)}s`)
	report.blank()

	// ── Save report ──

	const reportsDir = join(__dirname, '..', 'reports')
	mkdirSync(reportsDir, { recursive: true })

	const modelSlug = MODEL.replace(/\//g, '-')
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
	const filename = `evaluator-decisions-${modelSlug}-${UNDERSTANDING_MODE}-${timestamp}.md`
	const filepath = join(reportsDir, filename)

	writeFileSync(filepath, report.build(), 'utf-8')

	console.log(`\nReport saved: ${filepath}`)
	console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s`)
}

main().catch((err) => {
	console.error('\nEval failed:', err)
	process.exit(1)
})
