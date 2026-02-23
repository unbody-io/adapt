/**
 * Eval: Brain Update Diagnostic
 *
 * A raw-data diagnostic eval — no assertions. Produces a detailed markdown
 * report that a human or AI can read to evaluate brain.update() behavior.
 *
 * Uses the therapist-profile dataset (120 events: blog posts, testimonials,
 * social media, podcast appearances, FAQs, and professional content for
 * Dr. Sarah Chen, a clinical psychologist).
 *
 * Ingests 10 events per turn with realistic pauses between turns.
 * Tracks learner governance signals throughout the run.
 *
 * Timeline:
 *   Checkpoint 0 — Init brain, snapshot baseline
 *   Phase 1      — Ingest events 1-30 (3 turns × 10), snapshot + queries
 *   Phase 2      — Ingest events 31-50 (2 turns × 10), snapshot + queries
 *   UPDATE 1     — brain.update({ prompt }) — domain shift
 *   Phase 3      — Ingest events 51-100 (5 turns × 10), snapshot + queries (×5 for confidence signals)
 *   Phase 4      — Signal analysis checkpoint
 *   UPDATE 2     — brain.update({ learning.thresholds, model }) — mechanical cascade
 *   Phase 5      — Ingest events 101-140 (4 turns × 10), snapshot + queries
 *   UPDATE 3     — brain.update({ evolution }) — brain-only
 *   Phase 6      — Ingest events 141-150 (1 turn × 10), final snapshot + queries
 *   Final        — Full summary, signal recap
 *
 * Usage:
 *   bun evals/scripts/brain-10-update-diagnostic.ts
 *   bun evals/scripts/brain-10-update-diagnostic.ts --batch-size 60
 */

import { Brain } from '../../src/brain/class'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'openai/gpt-4o-mini'

const QUERIES = [
	'What is Dr. Chen\'s therapeutic approach?',
	'What makes Dr. Chen unique compared to other therapists?',
	'Does Dr. Chen work with anxiety?',
	'What do her clients say about her?',
]

const POST_UPDATE_QUERIES = [
	'What is Dr. Chen\'s experience with ADHD?',
	'What ADHD management strategies does she recommend?',
	'How does she approach ADHD assessment and coaching?',
	'What do ADHD clients say about working with her?',
	'How does she combine therapy and ADHD coaching?',
]

const EVENTS_PER_TURN = 10
const SLEEP_BETWEEN_TURNS_MS = 1500

const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--batch-size') ?? '0', 10) || undefined

// ─────────────────────────────────────────────────────────────────────────────
// Dataset
// ─────────────────────────────────────────────────────────────────────────────

interface TherapistEvent {
	id: string
	type: string
	date?: string
	[key: string]: unknown
}

interface Dataset {
	metadata: { name: string; description: string; queries: string[]; learners: Array<{ id: string; name: string; purpose: string }> }
	events: TherapistEvent[]
}

function loadDataset(): Dataset {
	const path = join(__dirname, '..', 'datasets', 'therapist-profile.json')
	return JSON.parse(readFileSync(path, 'utf-8'))
}

function eventToText(event: TherapistEvent): string {
	const parts: string[] = [`[${event.type}]${event.date ? ` ${event.date}` : ''}`]
	if (event.title) parts.push(`Title: ${event.title}`)
	if (event.source && typeof event.source === 'string') parts.push(`Source: ${event.source}`)
	if (event.platform) parts.push(`Platform: ${event.platform}`)
	if (event.show) parts.push(`Show: ${event.show}`)
	if (event.episode) parts.push(`Episode: ${event.episode}`)
	if (event.service) parts.push(`Service: ${event.service}`)
	if (event.question) parts.push(`Q: ${event.question}`)
	if (event.answer) parts.push(`A: ${event.answer}`)
	if (event.excerpt) parts.push(`Excerpt: ${event.excerpt}`)
	if (event.content) parts.push(`${event.content}`)
	if (event.transcript_excerpt) parts.push(`${event.transcript_excerpt}`)
	if (event.description && typeof event.description === 'string') parts.push(`${event.description}`)
	if (event.rating) parts.push(`Rating: ${event.rating}/5`)
	if (event.modality) parts.push(`Modality: ${event.modality}`)
	return parts.join('\n')
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 3) + '...'
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

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
	hr() { this.lines.push('---', '') }
	blank() { this.lines.push('') }

	kv(label: string, value: unknown) {
		this.lines.push(`**${label}:** ${typeof value === 'string' ? value : JSON.stringify(value)}`)
	}

	code(content: string, lang = '') {
		this.lines.push('```' + lang, content, '```', '')
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

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Helpers
// ─────────────────────────────────────────────────────────────────────────────

function snapshotBrainConfig(brain: Brain) {
	const c = brain.config
	return {
		prompt: truncate(brain.prompt, 120),
		model: (c.model as any)?.modelId ?? String(c.model),
		blueprintModel: (c.blueprintModel as any)?.modelId ?? String(c.blueprintModel),
		initModel: (c.init.model as any)?.modelId ?? String(c.init.model),
		queryModel: (c.query.model as any)?.modelId ?? String(c.query.model),
		batchSize: c.ingest.batchSize,
		evolution: { ...c.evolution },
	}
}

function snapshotLearner(learner: ReturnType<Brain['getLearners']>[0]) {
	return {
		id: learner.id,
		name: learner.name,
		instructions: truncate(learner.instructions, 200),
		description: learner.description ?? '(none)',
		understandingLength: learner.getUnderstanding().length,
		understandingPreview: truncate(learner.getUnderstanding(), 300),
		bufferState: learner.getBufferState(),
		thresholds: learner.getUnderstandThresholds(),
		governance: learner.getGovernance(),
		queryMethod: learner.getQueryMethodName(),
		governance: {
			activation: learner.getHealth().activation,
			status: learner.getHealth().status,
			signalThresholds: learner.getHealth().signalThresholds,
		},
		observePromptPreview: truncate(learner.getObserveSystemPrompt() ?? '(null)', 300),
		understandPromptPreview: truncate(learner.getUnderstandSystemPrompt() ?? '(null)', 300),
	}
}

function snapshotAllLearners(brain: Brain) {
	return brain.getLearners().map(snapshotLearner)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const dataset = loadDataset()
	const allEvents = BATCH_SIZE ? dataset.events.slice(0, BATCH_SIZE) : dataset.events
	const report = new ReportBuilder()
	const collectedEvents: Array<{ type: string; payload?: any }> = []
	const learnerSignals: Array<{ type: string; payload: any; eventIndex: number }> = []
	const startTime = Date.now()

	report.h1('Brain Update Diagnostic Report')
	report.kv('Model', MODEL)
	report.kv('Dataset', `${dataset.metadata.name} (${allEvents.length} events)`)
	const firstDate = allEvents.find(e => e.date)?.date ?? '(no date)'
	const lastDate = [...allEvents].reverse().find(e => e.date)?.date ?? '(no date)'
	report.kv('Time Range', `${firstDate} → ${lastDate}`)
	report.kv('Events Per Turn', EVENTS_PER_TURN)
	report.kv('Sleep Between Turns', `${SLEEP_BETWEEN_TURNS_MS}ms`)
	report.kv('Date', new Date().toISOString())
	report.blank()

	// ═══════════════════════════════════════════════════════════════════════
	// Checkpoint 0: Initialize Brain
	// ═══════════════════════════════════════════════════════════════════════

	report.h2('Checkpoint 0: Brain Initialization')

	const INITIAL_PROMPT = 'You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and what makes them unique.'

	report.kv('Initial Prompt', INITIAL_PROMPT)
	report.blank()

	const brain = new Brain({
		prompt: INITIAL_PROMPT,
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 10,
			autoEvaluate: false, // manual control for deterministic eval
		},
	})

	await brain.initialize()

	brain.on((event) => {
		collectedEvents.push({ type: event.type, payload: event.payload })

		// Track all signals — brain:signal:received fires for both
		// brain-level SYSTEM DIRECTIVE signals and learner governance signals
		if (event.type === 'brain:signal:received') {
			learnerSignals.push({
				type: event.type,
				payload: event.payload,
				eventIndex: collectedEvents.length - 1,
			})
		}
	})

	report.h3('Brain Config After Init')
	report.json('Config', snapshotBrainConfig(brain))

	report.h3('Generated Learners')
	const initLearners = snapshotAllLearners(brain)
	for (const l of initLearners) {
		report.h4(`Learner: ${l.name} (${l.id})`)
		report.json('State', l)
	}

	console.log(`[Init] Brain created with ${brain.learners.size} learners`)

	// ═══════════════════════════════════════════════════════════════════════
	// Helper: Ingest events in turns of EVENTS_PER_TURN with sleeps
	// ═══════════════════════════════════════════════════════════════════════

	async function ingestBatch(label: string, events: TherapistEvent[]) {
		report.h3(`Ingest: ${label} (${events.length} events)`)
		const batchFirstDate = events.find(e => e.date)?.date ?? '(no date)'
		const batchLastDate = [...events].reverse().find(e => e.date)?.date ?? '(no date)'
		report.kv('Date Range', `${batchFirstDate} → ${batchLastDate}`)

		const typeCounts: Record<string, number> = {}
		for (const e of events) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1
		report.json('Event Type Distribution', typeCounts)

		// Split into turns of EVENTS_PER_TURN
		const turns: TherapistEvent[][] = []
		for (let i = 0; i < events.length; i += EVENTS_PER_TURN) {
			turns.push(events.slice(i, i + EVENTS_PER_TURN))
		}

		const turnRows: string[][] = []

		for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
			const turn = turns[turnIdx]
			const texts = turn.map(eventToText)

			// Inject the whole turn as a batch
			const result = await brain.inject(texts)

			// Summarize per-learner status for this turn
			const batchResult = result.batches[0]
			const statuses = batchResult?.results.map(r => ({
				learner: r.learnerId,
				status: r.result.status,
			})) ?? []

			const eventIds = turn.map(e => e.id).join(', ')
			const eventTypes = turn.map(e => e.type)
			const typeSummary = Object.entries(
				eventTypes.reduce((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {} as Record<string, number>)
			).map(([t, c]) => `${t}×${c}`).join(', ')

			turnRows.push([
				`Turn ${turnIdx + 1}`,
				`${turn[0].id}–${turn[turn.length - 1].id}`,
				typeSummary,
				statuses.map(s => `${s.learner}:${s.status}`).join(', '),
			])

			process.stdout.write(`\r  [${label}] Turn ${turnIdx + 1}/${turns.length} (${turn.length} events)`)

			// Sleep between turns (not after the last one)
			if (turnIdx < turns.length - 1) {
				await sleep(SLEEP_BETWEEN_TURNS_MS)
			}
		}
		console.log('')

		report.table(
			['Turn', 'Events', 'Types', 'Learner Results'],
			turnRows,
		)

		// Check for signals emitted during this batch
		const signalsDuringBatch = learnerSignals.filter(s =>
			s.payload?.source !== 'brain' // exclude brain-level SYSTEM DIRECTIVE signals
		)
		if (signalsDuringBatch.length > 0) {
			report.h4('Learner Signals During Batch')
			for (const s of signalsDuringBatch) {
				report.p(`- **${s.type}** from \`${s.payload?.source}\`: ${truncate(s.payload?.description ?? '', 200)}`)
				if (s.payload?.metrics) {
					report.json('Signal Metrics', s.payload.metrics)
				}
			}
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Helper: Take a full snapshot
	// ═══════════════════════════════════════════════════════════════════════

	function snapshot(label: string) {
		report.h3(`Snapshot: ${label}`)
		report.json('Brain Config', snapshotBrainConfig(brain))
		report.kv('Learner Count', brain.learners.size)
		report.blank()

		for (const learner of brain.getLearners()) {
			const snap = snapshotLearner(learner)
			report.h4(`${snap.name} (${snap.id})`)
			report.kv('Understanding Length', snap.understandingLength)
			report.kv('Buffer', `${snap.bufferState.count} items, avg importance ${snap.bufferState.avgImportance.toFixed(2)}`)
			report.kv('Thresholds', JSON.stringify(snap.thresholds))
			report.kv('Governance', `activation=${snap.health.activation.toFixed(2)}, status=${snap.health.status}`)
			report.p(`**Understanding Preview:**`)
			report.code(snap.understandingPreview)
			report.p(`**Observe Prompt Preview:**`)
			report.code(snap.observePromptPreview)
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Helper: Run queries and log results
	// ═══════════════════════════════════════════════════════════════════════

	async function runQueries(label: string, queries: string[]) {
		report.h3(`Queries: ${label}`)

		for (const q of queries) {
			const result = await brain.ask(q)
			report.h4(`Q: ${q}`)
			report.kv('Insight', result.insight)
			report.kv('Source Count', result.sources.length)

			if (result.sources.length > 0) {
				report.table(
					['Learner', 'Confidence', 'Insight Preview'],
					result.sources.map(s => [
						s.learnerId,
						s.confidence.toFixed(2),
						truncate(s.insight, 120),
					]),
				)
			}

			if (result.gaps.length > 0) {
				report.kv('Gaps', result.gaps.join('; '))
			}
			report.blank()

			// Small pause between queries for realism
			await sleep(500)
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Helper: Log a brain.update() call with full before/after
	// ═══════════════════════════════════════════════════════════════════════

	async function logUpdate(label: string, updates: Parameters<typeof brain.update>[0]) {
		report.h2(`UPDATE: ${label}`)
		report.json('Requested Updates', {
			// Serialize non-model fields for readability
			...updates,
			model: updates.model ? (updates.model as any)?.modelId ?? '(LanguageModel)' : undefined,
			blueprintModel: updates.blueprintModel ? (updates.blueprintModel as any)?.modelId ?? '(LanguageModel)' : undefined,
		})

		report.h3('Before')
		report.json('Brain Config', snapshotBrainConfig(brain))
		const beforeLearners = snapshotAllLearners(brain)
		report.json('Learner Summary', beforeLearners.map(l => ({
			id: l.id, name: l.name, understandingLength: l.understandingLength,
			understandingPreview: truncate(l.understandingPreview, 150),
			thresholds: l.thresholds, queryMethod: l.queryMethod,
		})))

		const sectionEventsStart = collectedEvents.length
		const signalsBeforeCount = learnerSignals.length

		let result: Awaited<ReturnType<typeof brain.update>> | undefined
		let updateError: string | undefined

		try {
			result = await brain.update(updates)
		} catch (err) {
			updateError = String(err)
		}

		const sectionEventsEnd = collectedEvents.length
		const updateEvents = collectedEvents.slice(sectionEventsStart, sectionEventsEnd)
		const signalsDuringUpdate = learnerSignals.slice(signalsBeforeCount)

		report.h3('After')

		if (updateError) {
			report.p(`**ERROR:** ${updateError}`)
			report.p('_(Update threw — prompt/config may be partially applied, evolution may have failed)_')
		}

		if (result) {
			report.json('Update Result', {
				changedFields: result.changedFields,
				learnerResults: result.learnerResults,
				hasEvolutionResults: !!result.evolutionResults,
				evolutionResults: result.evolutionResults ? {
					decisionCount: result.evolutionResults.decisions.length,
					decisions: result.evolutionResults.decisions.map(d => ({
						action: d.action,
						targets: d.targets,
						reasoning: truncate(d.reasoning, 100),
						guidance: truncate(d.guidance, 100),
					})),
					created: result.evolutionResults.created,
					updated: result.evolutionResults.updated,
					deleted: result.evolutionResults.deleted,
					merged: result.evolutionResults.merged,
					split: result.evolutionResults.split,
				} : undefined,
			})
		}

		report.json('Brain Config', snapshotBrainConfig(brain))

		const afterLearners = snapshotAllLearners(brain)
		report.json('Learner Summary', afterLearners.map(l => ({
			id: l.id, name: l.name, understandingLength: l.understandingLength,
			understandingPreview: truncate(l.understandingPreview, 150),
			thresholds: l.thresholds, queryMethod: l.queryMethod,
		})))

		// Log events emitted during update
		if (updateEvents.length > 0) {
			report.h3('Events Emitted During Update')
			const eventTypeCounts: Record<string, number> = {}
			for (const e of updateEvents) eventTypeCounts[e.type] = (eventTypeCounts[e.type] ?? 0) + 1
			report.json('Event Type Counts', eventTypeCounts)
		} else {
			report.p('_No events emitted during update._')
		}

		// Signals during update
		if (signalsDuringUpdate.length > 0) {
			report.h3('Signals During Update')
			for (const s of signalsDuringUpdate) {
				report.p(`- **${s.type}** from \`${s.payload?.source}\`: ${truncate(s.payload?.description ?? '', 200)}`)
			}
		}

		// Diff: learner set changes
		const beforeIds = new Set(beforeLearners.map(l => l.id))
		const afterIds = new Set(afterLearners.map(l => l.id))
		const added = afterLearners.filter(l => !beforeIds.has(l.id))
		const removed = beforeLearners.filter(l => !afterIds.has(l.id))

		if (added.length > 0 || removed.length > 0) {
			report.h3('Learner Set Changes')
			if (removed.length > 0) report.json('Removed', removed.map(l => ({ id: l.id, name: l.name })))
			if (added.length > 0) {
				report.json('Added', added.map(l => ({ id: l.id, name: l.name, instructions: l.instructions })))
			}
		}

		console.log(`[Update] ${label}: ${result ? result.changedFields.join(', ') : 'ERROR: ' + updateError}`)
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Helper: Signal analysis checkpoint
	// ═══════════════════════════════════════════════════════════════════════

	function signalCheckpoint(label: string) {
		report.h2(`Signal Checkpoint: ${label}`)

		// Compute observation stats from collected events
		const observeStats: Record<string, { observed: number; dismissed: number; errors: number; synthesized: number }> = {}
		for (const e of collectedEvents) {
			const learnerId = (e.payload as any)?.learnerId
			if (!learnerId) continue
			if (!observeStats[learnerId]) observeStats[learnerId] = { observed: 0, dismissed: 0, errors: 0, synthesized: 0 }
			if (e.type === 'learner:observed') observeStats[learnerId].observed++
			if (e.type === 'learner:observe:dismissed') observeStats[learnerId].dismissed++
			if (e.type === 'learner:observe:error') observeStats[learnerId].errors++
			if (e.type === 'learner:synthesized') observeStats[learnerId].synthesized++
		}

		// Governance state per learner
		report.h3('Learner Governance States')
		for (const learner of brain.getLearners()) {
			const gov = learner.getHealth()
			const stats = observeStats[learner.id] ?? { observed: 0, dismissed: 0, errors: 0, synthesized: 0 }
			// Total observations = observed + dismissed + errors + synthesized
			// (synthesized means an observation was made AND triggered synthesis)
			const totalObs = stats.observed + stats.dismissed + stats.errors + stats.synthesized
			const dismissalRate = totalObs > 0 ? stats.dismissed / totalObs : 0

			report.h4(`${learner.name} (${learner.id})`)
			report.json('Governance', {
				activation: gov.activation,
				status: gov.status,
				retrievalCount: gov.retrievalCount,
				successRate: gov.successRate,
				signalThresholds: gov.signalThresholds,
			})
			report.json('Observation Stats (from events)', {
				totalObservations: totalObs,
				observed: stats.observed,
				dismissed: stats.dismissed,
				errors: stats.errors,
				synthesized: stats.synthesized,
				dismissalRate: `${(dismissalRate * 100).toFixed(1)}%`,
				dismissalThreshold: `${(gov.signalThresholds.maxDismissalRate * 100)}%`,
			})
		}

		// All signals collected so far
		const governanceSignals = learnerSignals.filter(s => s.payload?.source !== 'brain')
		report.h3(`Governance Signals Collected So Far (${governanceSignals.length})`)

		if (governanceSignals.length === 0) {
			report.p('_No governance signals emitted yet._')

			// Explain why based on computed stats
			report.h4('Why No Signals?')
			for (const learner of brain.getLearners()) {
				const gov = learner.getHealth()
				const stats = observeStats[learner.id] ?? { observed: 0, dismissed: 0, errors: 0, synthesized: 0 }
				const totalObs = stats.observed + stats.dismissed + stats.errors + stats.synthesized
				const dismissalRate = totalObs > 0 ? stats.dismissed / totalObs : 0
				const reasons: string[] = []

				if (totalObs <= 10) {
					reasons.push(`Only ${totalObs} observations (need >10 for dismissal rate signal)`)
				} else if (dismissalRate <= gov.signalThresholds.maxDismissalRate) {
					reasons.push(`Dismissal rate ${(dismissalRate * 100).toFixed(1)}% ≤ threshold ${(gov.signalThresholds.maxDismissalRate * 100)}% — learner is healthy`)
				} else {
					reasons.push(`Dismissal rate ${(dismissalRate * 100).toFixed(1)}% > threshold ${(gov.signalThresholds.maxDismissalRate * 100)}% — signal SHOULD have fired`)
				}

				if (gov.retrievalCount < 5) {
					reasons.push(`Only ${gov.retrievalCount} queries (need ≥5 for confidence signal)`)
				} else {
					reasons.push(`${gov.retrievalCount} queries — confidence checks active`)
				}

				report.p(`- **${learner.id}**: ${reasons.join('; ')}`)
			}
		} else {
			for (const s of governanceSignals) {
				report.p(`- **${s.payload?.source}**: ${s.payload?.description}`)
				if (s.payload?.metrics) {
					report.json('Metrics', s.payload.metrics)
				}
			}
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Execute Timeline
	// ═══════════════════════════════════════════════════════════════════════

	// Split events into phase groups (120 events total)
	const phaseGroups = [
		allEvents.slice(0, 30),    // Phase 1: first 30 events
		allEvents.slice(30, 50),   // Phase 2: events 31-50
		allEvents.slice(50, 90),   // Phase 3: events 51-90 (post prompt change — 40 events for signal testing)
		allEvents.slice(90, 110),  // Phase 5: events 91-110 (post cascade)
		allEvents.slice(110),      // Phase 6: events 111+ (final)
	].filter(b => b.length > 0)

	// ── Phase 1 ──
	report.h2('Phase 1: Initial Ingestion (First 30 events)')

	if (phaseGroups[0]) {
		await ingestBatch('Phase 1', phaseGroups[0])
		snapshot('After Phase 1')
		await runQueries('After Phase 1', QUERIES.slice(0, 2))
	}

	// ── Phase 2 ──
	report.h2('Phase 2: Continued Ingestion (Events 31-50)')

	if (phaseGroups[1]) {
		await ingestBatch('Phase 2', phaseGroups[1])
		snapshot('After Phase 2')
		await runQueries('After Phase 2', QUERIES)
	}

	// ── UPDATE 1: Prompt change (signal-driven) ──

	await logUpdate('Prompt Change → Focus on ADHD', {
		prompt: 'You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coaching strategies, medication philosophy, and practical tools they recommend for executive function challenges.',
	})

	// ── Phase 3: Heavy ingestion post-prompt-change (for governance signals) ──
	report.h2('Phase 3: Post-Prompt-Change Ingestion (extended for signal testing)')

	if (phaseGroups[2]) {
		await ingestBatch('Phase 3', phaseGroups[2])
		snapshot('After Phase 3')
		// Run 5 queries — enough to trigger confidence signals if they're low
		await runQueries('After Phase 3', POST_UPDATE_QUERIES)
	}

	// ── Phase 4: Signal Analysis ──
	signalCheckpoint('After Phase 3 Ingestion + Queries')

	// ── UPDATE 2: Mechanical cascade (model + thresholds) ──

	await logUpdate('Model + Threshold Cascade', {
		model: openrouter(MODEL),
		learning: {
			synthesize: {
				thresholds: {
					minImportance: 0.3,
				},
			},
		},
	})

	// ── Phase 5 ──
	report.h2('Phase 5: Post-Cascade Ingestion')

	if (phaseGroups[3]) {
		await ingestBatch('Phase 5', phaseGroups[3])
		snapshot('After Phase 5')
		await runQueries('After Phase 5', POST_UPDATE_QUERIES.slice(0, 3))
	}

	// ── Signal checkpoint after more data ──
	signalCheckpoint('After Phase 5')

	// ── UPDATE 3: Brain-only (evolution config) ──

	await logUpdate('Evolution Config (Brain-only)', {
		evolution: {
			evaluatorSignalThreshold: 20,
			autoEvaluate: true,
		},
	})

	// ── Phase 6 ──
	report.h2('Phase 6: Final Ingestion')

	if (phaseGroups[4]) {
		await ingestBatch('Phase 6', phaseGroups[4])
		snapshot('After Phase 6 (Final)')
		await runQueries('Final Queries', QUERIES)
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Final Summary
	// ═══════════════════════════════════════════════════════════════════════

	report.h2('Final Summary')

	const elapsed = Date.now() - startTime
	report.kv('Total Duration', `${(elapsed / 1000).toFixed(1)}s`)
	report.kv('Total Events Ingested', allEvents.length)
	report.kv('Total Brain Events Collected', collectedEvents.length)
	report.kv('Final Learner Count', brain.learners.size)
	report.blank()

	// Event type distribution
	const allEventTypes: Record<string, number> = {}
	for (const e of collectedEvents) allEventTypes[e.type] = (allEventTypes[e.type] ?? 0) + 1
	report.json('All Brain Events by Type', allEventTypes)

	// Signal recap
	report.h3('Signal Recap')
	const allGovSignals = learnerSignals.filter(s => s.payload?.source !== 'brain')
	const brainSignals = learnerSignals.filter(s => s.payload?.source === 'brain')
	report.kv('Total Governance Signals (from learners)', allGovSignals.length)
	report.kv('Total System Signals (from brain)', brainSignals.length)

	if (allGovSignals.length > 0) {
		report.h4('All Governance Signals')
		for (const s of allGovSignals) {
			report.p(`- **${s.payload?.source}**: ${s.payload?.description}`)
			if (s.payload?.metrics) {
				report.code(JSON.stringify(s.payload.metrics, null, 2), 'json')
			}
		}
	}

	if (brainSignals.length > 0) {
		report.h4('All System Signals')
		for (const s of brainSignals) {
			report.p(`- ${truncate(s.payload?.description ?? '', 300)}`)
		}
	}

	// Final learner states (full)
	report.h3('Final Learner States')
	for (const learner of brain.getLearners()) {
		const snap = snapshotLearner(learner)
		report.h4(`${snap.name} (${snap.id})`)
		report.json('Full State', snap)
		report.p('**Full Understanding:**')
		report.code(learner.getUnderstanding())
		report.p('**Full Observe Prompt:**')
		report.code(learner.getObserveSystemPrompt() ?? '(null)')
		report.p('**Full Synthesize Prompt:**')
		report.code(learner.getUnderstandSystemPrompt() ?? '(null)')
	}

	// ═══════════════════════════════════════════════════════════════════════
	// Write Report
	// ═══════════════════════════════════════════════════════════════════════

	const reportsDir = join(__dirname, '..', 'reports')
	mkdirSync(reportsDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const modelSlug = MODEL.replace(/\//g, '-')
	const reportPath = join(reportsDir, `brain-update-diagnostic-${modelSlug}-${timestamp}.md`)
	writeFileSync(reportPath, report.build())

	console.log(`\nReport saved: ${reportPath}`)
	console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s`)
	console.log(`Events: ${allEvents.length} ingested, ${collectedEvents.length} brain events`)
	console.log(`Governance signals: ${allGovSignals.length}, System signals: ${brainSignals.length}`)
}

main().catch((err) => {
	console.error('\nEval failed:', err)
	process.exit(1)
})
