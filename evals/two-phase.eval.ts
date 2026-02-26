/**
 * Two-Phase Learning Eval
 *
 * Evaluates TextLearner with two-phase learning (observe → synthesize)
 * using continuous strategy. Produces a human-reviewable markdown report.
 *
 * Usage:
 *   bun evals/two-phase.eval.ts <dataset>
 *   bun evals/two-phase.eval.ts <dataset> --learner <id>
 *   bun evals/two-phase.eval.ts <dataset> --batch-size 20
 *   bun evals/two-phase.eval.ts --list
 *
 * Environment:
 *   MODEL=google/gemini-2.0-flash-001
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TextLearner, MemoryStore, type LearnOutput } from '../src/learners'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DatasetLearner {
	id: string
	name: string
	purpose: string
}

interface DatasetMetadata {
	name: string
	description: string
	learners: DatasetLearner[]
	queries: string[]
	[key: string]: unknown
}

interface Dataset {
	metadata: DatasetMetadata
	events: Array<{ id: string; type: string; content?: string; [key: string]: unknown }>
}

interface LearnRecord {
	eventId: string
	eventType: string
	eventPreview: string
	status: LearnOutput['status']
	output?: string
	understandingLength: number
	bufferCount: number
}

interface SynthesisRecord {
	triggerEventId: string
	previousLength: number
	newLength: number
	significance: string
	evolution: string
}

interface QueryRecord {
	question: string
	answer: string
	confidence: number
	gaps: string[]
	durationMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset Loading
// ─────────────────────────────────────────────────────────────────────────────

const DATASETS_DIR = join(__dirname, 'datasets')

function listDatasets(): Map<string, Dataset> {
	const datasets = new Map<string, Dataset>()
	const files = readdirSync(DATASETS_DIR).filter((f) => f.endsWith('.json'))

	for (const file of files) {
		const key = basename(file, '.json')
		const content = readFileSync(join(DATASETS_DIR, file), 'utf-8')
		datasets.set(key, JSON.parse(content) as Dataset)
	}

	return datasets
}

function loadDataset(name: string): Dataset {
	const filePath = join(DATASETS_DIR, `${name}.json`)
	const content = readFileSync(filePath, 'utf-8')
	return JSON.parse(content) as Dataset
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

interface EvalOptions {
	dataset: string
	learnerId?: string
	batchSize?: number
	instructions?: string
}

function parseArgs(): EvalOptions | 'list' {
	const args = process.argv.slice(2)

	if (args.includes('--list') || args.includes('-l')) {
		return 'list'
	}

	if (args.length === 0) {
		console.error('Usage: bun evals/two-phase.eval.ts <dataset> [options]')
		console.error('')
		console.error('Options:')
		console.error('  --learner <id>       Use specific learner from dataset')
		console.error('  --batch-size <n>     Limit number of events to process')
		console.error('  --instructions "..." Custom instructions (overrides learner)')
		console.error('  --list               List available datasets')
		process.exit(1)
	}

	const options: EvalOptions = {
		dataset: args[0],
	}

	for (let i = 1; i < args.length; i++) {
		if (args[i] === '--learner' && args[i + 1]) {
			options.learnerId = args[++i]
		} else if (args[i] === '--batch-size' && args[i + 1]) {
			options.batchSize = parseInt(args[++i], 10)
		} else if (args[i] === '--instructions' && args[i + 1]) {
			options.instructions = args[++i]
		}
	}

	return options
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEventContent(event: Dataset['events'][0]): string {
	// Try to extract content from common fields
	if (event.content) return event.content
	if (typeof event.excerpt === 'string') return event.excerpt
	if (typeof event.title === 'string') return event.title

	// Fallback: stringify the whole event
	const { id, type, ...rest } = event
	return JSON.stringify(rest).slice(0, 200)
}

function truncate(s: string, maxLen: number): string {
	if (s.length <= maxLen) return s
	return s.slice(0, maxLen - 3) + '...'
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateReport(
	model: string,
	dataset: Dataset,
	learnerConfig: DatasetLearner,
	learnRecords: LearnRecord[],
	synthesisRecords: SynthesisRecord[],
	queryRecords: QueryRecord[],
	finalUnderstanding: string,
	observeIdentity: string,
	synthesizeIdentity: string,
	durationMs: number,
): string {
	const observedCount = learnRecords.filter((r) => r.status === 'observed').length
	const dismissedCount = learnRecords.filter((r) => r.status === 'observe:dismissed').length
	const errorCount = learnRecords.filter((r) =>
		r.status === 'observe:error' || r.status === 'synthesize:error',
	).length

	const lines: string[] = []

	// Header
	lines.push(`# Two-Phase Learning Eval Report`)
	lines.push('')
	lines.push(`**Model:** ${model}`)
	lines.push(`**Dataset:** ${dataset.metadata.name}`)
	lines.push(`**Learner:** ${learnerConfig.name} (${learnerConfig.id})`)
	lines.push(`**Purpose:** ${learnerConfig.purpose}`)
	lines.push(`**Events processed:** ${learnRecords.length}`)
	lines.push(`**Duration:** ${(durationMs / 1000).toFixed(1)}s`)
	lines.push('')

	// Summary Stats
	lines.push(`## Summary`)
	lines.push('')
	lines.push(`| Metric | Value |`)
	lines.push(`|--------|-------|`)
	lines.push(`| Events observed | ${observedCount} |`)
	lines.push(`| Events dismissed | ${dismissedCount} |`)
	lines.push(`| Errors | ${errorCount} |`)
	lines.push(`| Synthesis cycles | ${synthesisRecords.length} |`)
	lines.push(`| Final understanding | ${finalUnderstanding.length} chars |`)
	lines.push('')

	// Observe Identity
	lines.push(`## Observe Identity`)
	lines.push('')
	lines.push('```')
	lines.push(observeIdentity)
	lines.push('```')
	lines.push('')

	// Synthesize Identity
	lines.push(`## Synthesize Identity`)
	lines.push('')
	lines.push('```')
	lines.push(synthesizeIdentity)
	lines.push('```')
	lines.push('')

	// Observe Samples (first 5 observed, first 3 dismissed)
	lines.push(`## Observe Phase Samples`)
	lines.push('')

	const observedSamples = learnRecords.filter((r) => r.status === 'observed').slice(0, 5)
	const dismissedSamples = learnRecords.filter((r) => r.status === 'observe:dismissed').slice(0, 3)

	if (observedSamples.length > 0) {
		lines.push(`### Observed (${observedCount} total, showing ${observedSamples.length})`)
		lines.push('')
		for (const r of observedSamples) {
			lines.push(`**Event ${r.eventId}** (${r.eventType})`)
			lines.push(`> ${truncate(r.eventPreview, 150)}`)
			lines.push('')
			lines.push(`**Observations:**`)
			lines.push('```')
			lines.push(r.output || '(no output)')
			lines.push('```')
			lines.push('')
		}
	}

	if (dismissedSamples.length > 0) {
		lines.push(`### Dismissed (${dismissedCount} total, showing ${dismissedSamples.length})`)
		lines.push('')
		for (const r of dismissedSamples) {
			lines.push(`**Event ${r.eventId}** (${r.eventType})`)
			lines.push(`> ${truncate(r.eventPreview, 150)}`)
			lines.push('')
		}
	}

	// Synthesis History
	lines.push(`## Synthesis History`)
	lines.push('')
	if (synthesisRecords.length === 0) {
		lines.push('_No synthesis occurred during this eval._')
	} else {
		lines.push(`| # | Trigger | Prev Length | New Length | Significance |`)
		lines.push(`|---|---------|-------------|------------|--------------|`)
		for (let i = 0; i < synthesisRecords.length; i++) {
			const s = synthesisRecords[i]
			lines.push(
				`| ${i + 1} | ${s.triggerEventId} | ${s.previousLength} | ${s.newLength} | ${s.significance} |`,
			)
		}
		lines.push('')

		// Show evolution notes
		lines.push(`### Evolution Notes`)
		lines.push('')
		for (let i = 0; i < synthesisRecords.length; i++) {
			const s = synthesisRecords[i]
			lines.push(`**Cycle ${i + 1}:** ${s.evolution}`)
			lines.push('')
		}
	}

	// Final Understanding
	lines.push(`## Final Understanding`)
	lines.push('')
	lines.push('```')
	lines.push(finalUnderstanding || '(empty)')
	lines.push('```')
	lines.push('')

	// Query Results
	lines.push(`## Query Results`)
	lines.push('')
	if (queryRecords.length === 0) {
		lines.push('_No queries defined for this dataset._')
	} else {
		for (const q of queryRecords) {
			lines.push(`### Q: ${q.question}`)
			lines.push('')
			lines.push(`**Answer:** ${q.answer}`)
			lines.push('')
			lines.push(`**Confidence:** ${q.confidence.toFixed(2)}`)
			if (q.gaps.length > 0) {
				lines.push(`**Gaps:** ${q.gaps.join('; ')}`)
			}
			lines.push(`_${q.durationMs}ms_`)
			lines.push('')
		}
	}

	// Understanding Growth Chart (ASCII)
	lines.push(`## Understanding Growth`)
	lines.push('')
	const growthPoints = learnRecords
		.filter((r) => r.status === 'observed' || r.status === 'synthesized')
		.map((r, i) => ({ index: i, length: r.understandingLength }))

	if (growthPoints.length > 0) {
		const maxLen = Math.max(...growthPoints.map((p) => p.length))
		const step = Math.ceil(growthPoints.length / 20) // Show ~20 points max
		lines.push('```')
		for (let i = 0; i < growthPoints.length; i += step) {
			const p = growthPoints[i]
			const barLen = Math.round((p.length / maxLen) * 40)
			const bar = '█'.repeat(barLen) + '░'.repeat(40 - barLen)
			lines.push(`${String(i).padStart(3)} ${bar} ${p.length}`)
		}
		lines.push('```')
	}
	lines.push('')

	return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Eval
// ─────────────────────────────────────────────────────────────────────────────

async function runEval(options: EvalOptions) {
	let dataset: Dataset
	try {
		dataset = loadDataset(options.dataset)
	} catch {
		console.error(`Dataset not found: ${options.dataset}`)
		const available = listDatasets()
		console.error(`Available datasets: ${[...available.keys()].join(', ')}`)
		process.exit(1)
	}

	// Select learner config
	const learnerConfig = options.learnerId
		? dataset.metadata.learners.find((l) => l.id === options.learnerId)
		: dataset.metadata.learners[0]

	if (!learnerConfig) {
		console.error(`Learner not found: ${options.learnerId}`)
		console.error(
			`Available learners: ${dataset.metadata.learners.map((l) => l.id).join(', ')}`,
		)
		process.exit(1)
	}

	const openrouter = createOpenRouter({
		apiKey: process.env.OPENROUTER_API_KEY,
	})
	const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

	// Apply batch size limit
	const events = options.batchSize
		? dataset.events.slice(0, options.batchSize)
		: dataset.events

	// Use custom instructions if provided, otherwise use learner config
	const instructions = options.instructions ?? learnerConfig.purpose

	console.log(`\nTwo-Phase Eval: ${dataset.metadata.name}`)
	console.log(`Model: ${MODEL}`)
	console.log(`Learner: ${options.instructions ? 'custom' : learnerConfig.name}`)
	console.log(`Instructions: ${truncate(instructions, 100)}`)
	console.log(`Events: ${events.length}`)
	console.log('')

	// Create learner with continuous strategy
	const learner = new TextLearner({
		id: `eval-${options.dataset}-${options.instructions ? 'custom' : learnerConfig.id}`,
		model: openrouter(MODEL),
		instructions,
		store: new MemoryStore(),
		governance: { strategy: 'continuous' },
	})

	// Initialize
	console.log('Initializing...')
	await learner.init()

	const observeIdentity = learner.getObserveIdentity()?.identity ?? '(none)'
	const synthesizeIdentity = learner.getUnderstandIdentity()?.identity ?? '(none)'

	// Track records
	const learnRecords: LearnRecord[] = []
	const synthesisRecords: SynthesisRecord[] = []

	const startTime = Date.now()

	// Process events one at a time
	console.log('Processing events...')
	for (let i = 0; i < events.length; i++) {
		const event = events[i]
		const prevUnderstanding = learner.getUnderstanding()

		const result = await learner.learn([event])
		const bufferState = learner.getBufferState()

		// Record learn result
		const record: LearnRecord = {
			eventId: event.id,
			eventType: event.type,
			eventPreview: getEventContent(event),
			status: result.status,
			understandingLength: learner.getUnderstanding().length,
			bufferCount: bufferState.count,
		}

		if (result.status === 'observed' || result.status === 'observe:dismissed') {
			record.output = result.output
		}

		learnRecords.push(record)

		// Track synthesis
		if (result.status === 'synthesized') {
			synthesisRecords.push({
				triggerEventId: event.id,
				previousLength: prevUnderstanding.length,
				newLength: learner.getUnderstanding().length,
				significance: result.significance,
				evolution: result.evolution,
			})
		}

		// Progress
		if ((i + 1) % 10 === 0 || i === events.length - 1) {
			const pct = Math.round(((i + 1) / events.length) * 100)
			process.stdout.write(`\r  ${i + 1}/${events.length} (${pct}%)`)
		}
	}
	console.log('')

	// Force final synthesis if there's buffered content
	const bufferState = learner.getBufferState()
	if (bufferState.count > 0) {
		console.log(`Forcing final synthesis (${bufferState.count} buffered observations)...`)
		const prevUnderstanding = learner.getUnderstanding()
		const result = await learner.learn([], { forceSynthesize: true })

		if (result.status === 'synthesized') {
			synthesisRecords.push({
				triggerEventId: 'final-flush',
				previousLength: prevUnderstanding.length,
				newLength: learner.getUnderstanding().length,
				significance: result.significance,
				evolution: result.evolution,
			})
		}
	}

	const endTime = Date.now()

	// Run queries
	console.log('Running queries...')
	const queryRecords: QueryRecord[] = []
	for (const question of dataset.metadata.queries) {
		const qStart = Date.now()
		const result = await learner.query(question)
		const qDuration = Date.now() - qStart

		queryRecords.push({
			question,
			answer: result.insight,
			confidence: result.confidence,
			gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
			durationMs: qDuration,
		})
		console.log(`  Q: ${truncate(question, 50)} -> ${result.confidence.toFixed(2)}`)
	}

	// Generate report (use effective config with possibly custom instructions)
	const effectiveLearnerConfig = options.instructions
		? { id: 'custom', name: 'Custom Instructions', purpose: options.instructions }
		: learnerConfig

	const report = generateReport(
		MODEL,
		dataset,
		effectiveLearnerConfig,
		learnRecords,
		synthesisRecords,
		queryRecords,
		learner.getUnderstanding(),
		observeIdentity,
		synthesizeIdentity,
		endTime - startTime,
	)

	// Save report
	const reportsDir = join(__dirname, 'reports')
	mkdirSync(reportsDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const modelSlug = MODEL.replace(/\//g, '-')
	const reportPath = join(reportsDir, `two-phase-${modelSlug}-${timestamp}.md`)
	writeFileSync(reportPath, report)

	console.log(`\nReport saved: ${reportPath}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────────────────

const parsedArgs = parseArgs()

if (parsedArgs === 'list') {
	const datasets = listDatasets()
	console.log('Available datasets:\n')
	for (const [key, dataset] of datasets) {
		console.log(`  ${key}`)
		console.log(`    ${dataset.metadata.description}`)
		console.log(`    Events: ${dataset.events.length}`)
		console.log(`    Learners: ${dataset.metadata.learners.map((l) => l.id).join(', ')}`)
		console.log()
	}
	process.exit(0)
}

runEval(parsedArgs).catch((err) => {
	console.error('\nEval failed:', err)
	process.exit(1)
})
