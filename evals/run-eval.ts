/**
 * Universal Eval Runner for TextLearner (Multi-Learner Edition)
 *
 * Usage: bun evals/run-eval.ts <dataset-name>
 *
 * Example: bun evals/run-eval.ts crisis-hostage
 *
 * Loads dataset from evals/datasets/<name>.json
 * Creates multiple learners (generic + specialists) as defined in the dataset
 * Feeds the same data to ALL learners
 * Runs each query against ALL learners for comparison
 * Writes comparative report to evals/reports/<name>-<timestamp>.md
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TextLearner } from '../src/learners/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LearnerConfig {
	id: string
	name: string
	purpose: string
}

interface DatasetMetadata {
	name: string
	description: string
	source?: string
	eventCount: number
	timespan?: string
	learners: LearnerConfig[]
	queries: string[]
}

interface Dataset {
	metadata: DatasetMetadata
	events: unknown[]
}

interface QueryResult {
	learnerId: string
	learnerName: string
	query: string
	relevant: boolean
	confidence: number
	insight: string
	gaps: string[]
	durationMs: number
	tokens: number
	error?: string
}

interface DataBatchResult {
	learnerId: string
	learnerName: string
	batchNumber: number
	eventCount: number
	relevance: number
	durationMs: number
	tokens: number
	understandingSnapshot: string
	error?: string
}

interface EvalError {
	learnerId: string
	operation: 'data' | 'query'
	context: string
	error: string
	timestamp: string
}

interface LearnerStats {
	id: string
	name: string
	purpose: string
	totalDataTokens: number
	totalQueryTokens: number
	totalDataDuration: number
	totalQueryDuration: number
	avgRelevance: number
	finalUnderstanding: string
	governance: { status: string; activation: number; retrievalCount: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'anthropic/claude-haiku-4.5'
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 20

// ─────────────────────────────────────────────────────────────────────────────
// Observer Factory
// ─────────────────────────────────────────────────────────────────────────────

function createObserver(learnerId: string) {
	let currentOpTokens = 0
	let currentOpDuration = 0

	return {
		observer: {
			onStart: (event: { operation: string; input: unknown }) => {
				currentOpTokens = 0
				const inputStr = JSON.stringify(event.input)
				console.log(`\n┌─ [${learnerId}] ${event.operation.toUpperCase()} START`)
				console.log(
					`│  Input: ${inputStr.length > 80 ? `${inputStr.slice(0, 80)}... (${inputStr.length} chars)` : inputStr}`,
				)
			},
			onStep: (event: {
				stepNumber: number
				toolCalls?: Array<{ toolName: string; input?: unknown }>
				usage?: { totalTokens: number }
				finishReason: string
			}) => {
				const tools = event.toolCalls?.map((tc) => tc.toolName).join(', ')
				const tokens = event.usage?.totalTokens ?? 0
				currentOpTokens += tokens
				console.log(
					`│  Step ${event.stepNumber}: ${tools || 'thinking'} (${tokens} tokens)`,
				)
			},
			onEnd: (event: {
				operation: string
				totalSteps: number
				usage?: { totalTokens: number }
				durationMs: number
				success: boolean
			}) => {
				currentOpDuration = event.durationMs
				console.log(`│  Duration: ${event.durationMs}ms, Steps: ${event.totalSteps}, Tokens: ${currentOpTokens}`)
				console.log(
					`└─ [${learnerId}] ${event.operation.toUpperCase()} ${event.success ? 'SUCCESS' : 'FAILED'}`,
				)
			},
		},
		getCurrentStats: () => ({ tokens: currentOpTokens, durationMs: currentOpDuration }),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runEval(datasetName: string) {
	const startTime = Date.now()

	// Load dataset
	const datasetPath = join(process.cwd(), 'evals', 'datasets', `${datasetName}.json`)
	if (!existsSync(datasetPath)) {
		console.error(`Dataset not found: ${datasetPath}`)
		process.exit(1)
	}

	const dataset: Dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'))
	const { metadata, events } = dataset

	console.log(`\n${'═'.repeat(70)}`)
	console.log(`TEXTLEARNER EVAL: ${metadata.name}`)
	console.log(`${'═'.repeat(70)}`)
	console.log(`Model: ${MODEL}`)
	console.log(`Batch size: ${BATCH_SIZE}`)
	console.log(`Events: ${events.length}`)
	console.log(`Learners: ${metadata.learners.length}`)
	for (const l of metadata.learners) {
		console.log(`  - ${l.id}: ${l.name}`)
	}
	console.log(`Queries: ${metadata.queries.length}`)
	console.log(`${'═'.repeat(70)}\n`)

	// Create all learners
	const learners = new Map<string, { learner: TextLearner; config: LearnerConfig; observer: ReturnType<typeof createObserver> }>()

	for (const config of metadata.learners) {
		const obs = createObserver(config.id)
		const learner = new TextLearner({
			model: openrouter(MODEL),
			purpose: config.purpose,
			observer: obs.observer,
		})
		learners.set(config.id, { learner, config, observer: obs })
	}

	// Track results per learner
	const allDataBatchResults: DataBatchResult[] = []
	const allQueryResults: QueryResult[] = []
	const allErrors: EvalError[] = []
	const learnerStats = new Map<string, LearnerStats>()

	// Initialize stats
	for (const config of metadata.learners) {
		learnerStats.set(config.id, {
			id: config.id,
			name: config.name,
			purpose: config.purpose,
			totalDataTokens: 0,
			totalQueryTokens: 0,
			totalDataDuration: 0,
			totalQueryDuration: 0,
			avgRelevance: 0,
			finalUnderstanding: '',
			governance: { status: 'dormant', activation: 0, retrievalCount: 0 },
		})
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Process data in batches - ALL learners get the same data
	// ─────────────────────────────────────────────────────────────────────────
	const batches: unknown[][] = []
	for (let i = 0; i < events.length; i += BATCH_SIZE) {
		batches.push(events.slice(i, i + BATCH_SIZE))
	}

	console.log(`\n${'═'.repeat(70)}`)
	console.log(`DATA PROCESSING: ${batches.length} batches × ${metadata.learners.length} learners`)
	console.log(`${'═'.repeat(70)}`)

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i]
		console.log(`\n${'─'.repeat(70)}`)
		console.log(`BATCH ${i + 1}/${batches.length} (${batch.length} events)`)
		console.log(`${'─'.repeat(70)}`)

		// Process batch for each learner
		for (const [learnerId, { learner, config, observer }] of learners) {
			try {
				const result = await learner.onData(batch)
				const stats = observer.getCurrentStats()

				const batchResult: DataBatchResult = {
					learnerId,
					learnerName: config.name,
					batchNumber: i + 1,
					eventCount: batch.length,
					relevance: result.relevance,
					durationMs: stats.durationMs,
					tokens: stats.tokens,
					understandingSnapshot: learner.getUnderstanding(),
				}
				allDataBatchResults.push(batchResult)

				// Update learner stats
				const ls = learnerStats.get(learnerId)!
				ls.totalDataTokens += stats.tokens
				ls.totalDataDuration += stats.durationMs

				console.log(`  ${config.name}: relevance=${result.relevance.toFixed(2)}, tokens=${stats.tokens}`)
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err)
				const shortError = errorMsg.slice(0, 100)
				console.log(`  ❌ ${config.name}: ERROR - ${shortError}...`)

				allErrors.push({
					learnerId,
					operation: 'data',
					context: `Batch ${i + 1}`,
					error: errorMsg,
					timestamp: new Date().toISOString(),
				})

				// Add a placeholder result with error
				allDataBatchResults.push({
					learnerId,
					learnerName: config.name,
					batchNumber: i + 1,
					eventCount: batch.length,
					relevance: 0,
					durationMs: 0,
					tokens: 0,
					understandingSnapshot: learner.getUnderstanding(),
					error: shortError,
				})
			}
		}
	}

	// Calculate avg relevance and final understanding for each learner
	for (const [learnerId, { learner }] of learners) {
		const ls = learnerStats.get(learnerId)!
		const relevances = allDataBatchResults
			.filter((r) => r.learnerId === learnerId)
			.map((r) => r.relevance)
		ls.avgRelevance = relevances.reduce((a, b) => a + b, 0) / relevances.length
		ls.finalUnderstanding = learner.getUnderstanding()
		ls.governance = learner.getGovernance()
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Run queries - ALL learners answer ALL queries
	// ─────────────────────────────────────────────────────────────────────────
	console.log(`\n${'═'.repeat(70)}`)
	console.log(`QUERIES: ${metadata.queries.length} questions × ${metadata.learners.length} learners`)
	console.log(`${'═'.repeat(70)}`)

	for (const query of metadata.queries) {
		console.log(`\n${'─'.repeat(70)}`)
		console.log(`Q: ${query}`)
		console.log(`${'─'.repeat(70)}`)

		// Query each learner
		for (const [learnerId, { learner, config, observer }] of learners) {
			try {
				const result = await learner.onQuery(query)
				const stats = observer.getCurrentStats()

				const queryResult: QueryResult = {
					learnerId,
					learnerName: config.name,
					query,
					relevant: result.relevant,
					confidence: result.confidence === 'high' ? 1 : result.confidence === 'medium' ? 0.5 : 0,
					insight: result.insight,
					gaps: result.gaps,
					durationMs: stats.durationMs,
					tokens: stats.tokens,
				}
				allQueryResults.push(queryResult)

				// Update learner stats
				const ls = learnerStats.get(learnerId)!
				ls.totalQueryTokens += stats.tokens
				ls.totalQueryDuration += stats.durationMs

				const confStr = result.confidence === 'high' ? '🟢' : result.confidence === 'medium' ? '🟡' : '🔴'
				console.log(`\n  ${confStr} [${config.id}] ${config.name}`)
				console.log(`     Confidence: ${result.confidence} | Relevant: ${result.relevant}`)
				console.log(`     Insight: ${result.insight.slice(0, 150)}...`)
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err)
				const shortError = errorMsg.slice(0, 100)
				console.log(`\n  ❌ [${config.id}] ${config.name}`)
				console.log(`     ERROR: ${shortError}...`)

				allErrors.push({
					learnerId,
					operation: 'query',
					context: query,
					error: errorMsg,
					timestamp: new Date().toISOString(),
				})

				// Add a placeholder result with error
				allQueryResults.push({
					learnerId,
					learnerName: config.name,
					query,
					relevant: false,
					confidence: 0,
					insight: `[ERROR] ${shortError}`,
					gaps: ['Query failed due to API error'],
					durationMs: 0,
					tokens: 0,
					error: shortError,
				})
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Final stats
	// ─────────────────────────────────────────────────────────────────────────
	const totalDuration = Date.now() - startTime

	console.log(`\n${'═'.repeat(70)}`)
	console.log('FINAL STATISTICS')
	console.log(`${'═'.repeat(70)}`)
	console.log(`\nTotal duration: ${(totalDuration / 1000).toFixed(1)}s`)

	console.log(`\nPer-Learner Summary:`)
	console.log(`${'─'.repeat(70)}`)
	for (const [learnerId, stats] of learnerStats) {
		const totalTokens = stats.totalDataTokens + stats.totalQueryTokens
		console.log(`\n[${learnerId}] ${stats.name}`)
		console.log(`  Data: ${(stats.totalDataDuration / 1000).toFixed(1)}s, ${stats.totalDataTokens.toLocaleString()} tokens`)
		console.log(`  Query: ${(stats.totalQueryDuration / 1000).toFixed(1)}s, ${stats.totalQueryTokens.toLocaleString()} tokens`)
		console.log(`  Total: ${totalTokens.toLocaleString()} tokens`)
		console.log(`  Avg Relevance: ${stats.avgRelevance.toFixed(2)}`)
		console.log(`  Governance: ${stats.governance.status}, activation=${stats.governance.activation.toFixed(3)}`)
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Generate report
	// ─────────────────────────────────────────────────────────────────────────
	if (allErrors.length > 0) {
		console.log(`\n⚠️  ${allErrors.length} errors occurred during eval`)
	}

	const report = generateReport({
		datasetName,
		metadata,
		model: MODEL,
		batchSize: BATCH_SIZE,
		allDataBatchResults,
		allQueryResults,
		allErrors,
		learnerStats: Array.from(learnerStats.values()),
		totalDuration,
	})

	// Write report
	const reportsDir = join(process.cwd(), 'evals', 'reports')
	if (!existsSync(reportsDir)) {
		mkdirSync(reportsDir, { recursive: true })
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const reportPath = join(reportsDir, `${datasetName}-${timestamp}.md`)
	writeFileSync(reportPath, report)

	console.log(`\n✅ Report written to: ${reportPath}\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateReport(data: {
	datasetName: string
	metadata: DatasetMetadata
	model: string
	batchSize: number
	allDataBatchResults: DataBatchResult[]
	allQueryResults: QueryResult[]
	allErrors: EvalError[]
	learnerStats: LearnerStats[]
	totalDuration: number
}): string {
	const {
		datasetName,
		metadata,
		model,
		batchSize,
		allDataBatchResults,
		allQueryResults,
		allErrors,
		learnerStats,
		totalDuration,
	} = data

	const now = new Date().toISOString()
	const totalTokens = learnerStats.reduce((sum, ls) => sum + ls.totalDataTokens + ls.totalQueryTokens, 0)

	// Group query results by query
	const queriesGrouped = metadata.queries.map((query) => ({
		query,
		results: allQueryResults.filter((r) => r.query === query),
	}))

	return `# TextLearner Eval Report: ${metadata.name}

**Generated:** ${now}
**Dataset:** ${datasetName}.json

## Parameters

| Parameter | Value |
|-----------|-------|
| Model | \`${model}\` |
| Batch Size | ${batchSize} |
| Total Events | ${metadata.eventCount} |
| Total Learners | ${metadata.learners.length} |
| Total Queries | ${metadata.queries.length} |

## Dataset Info

- **Name:** ${metadata.name}
- **Description:** ${metadata.description}
- **Timespan:** ${metadata.timespan || 'N/A'}

## Learner Configurations

| ID | Name | Purpose |
|----|------|---------|
${metadata.learners.map((l) => `| ${l.id} | ${l.name} | ${l.purpose.slice(0, 60)}... |`).join('\n')}

## Performance Summary

### Overall

| Metric | Value |
|--------|-------|
| Total Duration | ${(totalDuration / 1000).toFixed(1)}s |
| Total Tokens | ${totalTokens.toLocaleString()} |
| Avg Tokens/Event | ${Math.round(totalTokens / metadata.eventCount)} |

### Per-Learner Comparison

| Learner | Data Tokens | Query Tokens | Total Tokens | Avg Relevance | Activation |
|---------|-------------|--------------|--------------|---------------|------------|
${learnerStats.map((ls) => `| ${ls.name} | ${ls.totalDataTokens.toLocaleString()} | ${ls.totalQueryTokens.toLocaleString()} | ${(ls.totalDataTokens + ls.totalQueryTokens).toLocaleString()} | ${ls.avgRelevance.toFixed(2)} | ${ls.governance.activation.toFixed(3)} |`).join('\n')}

## Query Comparison

Each query was run against ALL learners. Compare responses to see if specialists outperform the generic learner on their domain.

${queriesGrouped.map((qg, i) => `
### ${i + 1}. ${qg.query}

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
${qg.results.map((r) => `| ${r.learnerName} | ${r.confidence === 1 ? '🟢 high' : r.confidence === 0.5 ? '🟡 medium' : '🔴 low'} | ${r.relevant ? 'Yes' : 'No'} | ${r.tokens.toLocaleString()} |`).join('\n')}

${qg.results.map((r) => `
**[${r.learnerId}] ${r.learnerName}:**
> ${r.insight}
${r.gaps.length > 0 ? `\n*Gaps: ${r.gaps.join('; ')}*` : ''}
`).join('\n')}
`).join('\n---\n')}

## Final Understanding (Per Learner)

${learnerStats.map((ls) => `
### ${ls.name} (${ls.id})

**Purpose:** ${ls.purpose}

\`\`\`
${ls.finalUnderstanding}
\`\`\`
`).join('\n')}

## Governance State

| Learner | Status | Activation | Retrieval Count |
|---------|--------|------------|-----------------|
${learnerStats.map((ls) => `| ${ls.name} | ${ls.governance.status} | ${ls.governance.activation.toFixed(3)} | ${ls.governance.retrievalCount} |`).join('\n')}

## Analysis

### Generic vs Specialist Comparison

<!-- Compare how the generic learner performed vs specialists on domain-specific questions -->

#### Questions where Specialists Outperformed Generic:

-

#### Questions where Generic Matched or Beat Specialists:

-

### Key Observations

#### Strengths

-

#### Weaknesses

-

#### Recommendations

-
${allErrors.length > 0 ? `
## Errors

**Total Errors:** ${allErrors.length}

| Learner | Operation | Context | Error |
|---------|-----------|---------|-------|
${allErrors.map((e) => `| ${e.learnerId} | ${e.operation} | ${e.context.slice(0, 30)}... | ${e.error.slice(0, 50)}... |`).join('\n')}

### Error Details

${allErrors.map((e, i) => `
#### Error ${i + 1}: [${e.learnerId}] ${e.operation}

- **Context:** ${e.context}
- **Timestamp:** ${e.timestamp}
- **Error:** \`${e.error.slice(0, 200)}${e.error.length > 200 ? '...' : ''}\`
`).join('\n')}
` : ''}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const datasetName = process.argv[2]

if (!datasetName) {
	console.error('Usage: bun evals/run-eval.ts <dataset-name>')
	console.error('Example: bun evals/run-eval.ts crisis-hostage')
	console.error('\nAvailable datasets:')
	try {
		const datasetsDir = join(process.cwd(), 'evals', 'datasets')
		const files = require('node:fs').readdirSync(datasetsDir)
		for (const file of files) {
			if (file.endsWith('.json')) {
				console.error(`  - ${file.replace('.json', '')}`)
			}
		}
	} catch {
		console.error('  (unable to list datasets)')
	}
	process.exit(1)
}

runEval(datasetName).catch((err) => {
	console.error('\n❌ Eval failed:', err)
	process.exit(1)
})
