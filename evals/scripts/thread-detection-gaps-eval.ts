/**
 * Eval: Thread Detection — Gap Learner Diagnostic
 *
 * Starts with NO external learners (just thread-registry). All data hits gaps.
 * Focuses on:
 *   a. Gap learner understanding + buffer after each batch
 *   b. How evolution thinks and reasons
 *   c. All compiled prompts printed at startup
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/thread-detection-gaps-eval.ts
 */

import { Brain } from '../../src/brain/class'
import { INTERNAL_LEARNER_IDS } from '../../src/brain/internal-learners'
import { MemoryBrainStore } from '../../src/brain/stores'
import { MemoryStore } from '../../src/learners/stores'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ─────────────────────────────────────────────────────────────────────────────
// Event collection
// ─────────────────────────────────────────────────────────────────────────────

const events: Array<{ type: string; payload?: unknown; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 3) + '...'
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain Prompt — minimal, no thread concept, just "watch what user saves"
// ─────────────────────────────────────────────────────────────────────────────

const BRAIN_PROMPT = `You are the memory engine for Mycelium, a personal attention tracker. Users save diverse data — bookmarks, highlights, articles, notes, conversations, products, images — across many tools.

Each specialist should represent a distinct thread of attention: a coherent cluster of interest, not a keyword tag but a lived meaning. Threads emerge from what the user actually saves, intensify with activity, and go dormant when attention moves on. Prefer focused, topic-specific threads over broad catch-all categories. When data doesn't fit any existing thread, that's a signal a new thread is emerging.`

// ─────────────────────────────────────────────────────────────────────────────
// Dataset — smaller, 4 batches, 2 clear clusters + 1 surprise
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_1 = [
	{ type: 'Note', title: 'Build our own bookmarking app under the Unbody brand', savedAt: '2025-12-10T10:00:00Z' },
	{ type: 'Claude conversation', title: 'AI as mental prosthetic for ADHD', context: 'Coined "cognitive exoskeleton"', savedAt: '2025-12-14T20:00:00Z' },
	{ type: 'Article', title: 'Malleable software: Restoring user agency', context: 'Ink & Switch', source: 'inkandswitch.com', savedAt: '2025-12-22T11:00:00Z' },
	{ type: 'Repository', title: 'logseq', context: 'Open source knowledge base with outliner and graph', source: 'github.com', savedAt: '2025-12-20T10:00:00Z' },
	{ type: 'Article', title: 'Local-first software: You own your data', context: 'CRDTs, offline-first', source: 'inkandswitch.com', savedAt: '2025-12-28T11:00:00Z' },
]

const BATCH_2 = [
	{ type: 'Note', title: 'Wedding language', context: '"Elevated backyard party. Intimacy, informality, people actually relaxed and present."', savedAt: '2026-01-10T19:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding venue planning and cost estimate', context: 'Babós-Forró Mansion, rural Transylvania', savedAt: '2026-01-12T15:00:00Z' },
	{ type: 'Image', title: 'Outdoor Wedding Reception in European Village Square', savedAt: '2026-01-15T10:00:00Z' },
	{ type: 'Product', title: 'Liquid Silver Ring', context: 'Handmade Organic Sculptural Melted Band', source: 'etsy.com', savedAt: '2026-02-01T10:00:00Z' },
	{ type: 'Product', title: 'Molten Ring — Recycled Sterling Silver', context: 'Handcrafted, organic, anti-industrial', source: 'etsy.com', savedAt: '2026-02-02T09:00:00Z' },
]

const BATCH_3 = [
	{ type: 'Repository', title: 'omnivore', context: 'Open-source read-it-later — competitor research', source: 'github.com', savedAt: '2026-01-21T11:00:00Z' },
	{ type: 'WebPage', title: 'Daylight Computer', context: '"A More Caring Computer" — e-ink, calm computing', source: 'daylightcomputer.com', savedAt: '2026-02-07T10:00:00Z' },
	{ type: 'Claude conversation', title: 'Rhizome project handover and next steps', context: 'Naming project Rhizome, planning architecture', savedAt: '2026-02-09T10:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding music — acoustic, folk, no DJ', context: 'Live musicians, no playlist energy', savedAt: '2026-02-05T11:00:00Z' },
	{ type: 'Note', title: 'Every ring saved is handmade, organic, anti-industrial. The aesthetic is coherent even though I never defined it.', savedAt: '2026-02-04T20:00:00Z' },
]

const BATCH_4 = [
	{ type: 'Article', title: 'The Science of Sourdough: Wild Yeast and Fermentation', context: 'Microbiology of sourdough starters', source: 'seriouseats.com', savedAt: '2026-02-21T08:00:00Z' },
	{ type: 'WebPage', title: 'Tartine Country Loaf Recipe', context: 'High hydration, long cold ferment, open crumb', source: 'tartinebakery.com', savedAt: '2026-02-21T08:30:00Z' },
	{ type: 'Article', title: 'Sourdough as Meditation: The Practice of Slow Bread', context: 'Bread as mindfulness practice', source: 'breadmagazine.com', savedAt: '2026-02-22T07:00:00Z' },
	{ type: 'Note', title: 'Started my own sourdough starter. Named it "Claude." Day 1: just flour and water.', savedAt: '2026-02-22T20:00:00Z' },
	{ type: 'WebPage', title: 'Flour Water Salt Yeast — Ken Forkish Method', context: 'Beginner artisan bread, emphasis on feel over precision', source: 'kenforkish.com', savedAt: '2026-02-23T12:00:00Z' },
]

const ALL_BATCHES = [
	{ label: 'Batch 1: Cognitive Exoskeleton / PKM', data: BATCH_1 },
	{ label: 'Batch 2: Wedding Planning', data: BATCH_2 },
	{ label: 'Batch 3: Mixed — Exoskeleton + Wedding', data: BATCH_3 },
	{ label: 'Batch 4: Surprise Sourdough', data: BATCH_4 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const totalItems = ALL_BATCHES.reduce((sum, b) => sum + b.data.length, 0)
	console.log(`\n=== Eval: Thread Detection — Gap Learner Diagnostic ===`)
	console.log(`Model: ${MODEL}`)
	console.log(`Date: ${new Date().toISOString()}`)
	console.log(`Dataset: ${ALL_BATCHES.length} batches, ${totalItems} items`)
	console.log(`Learners: NONE (truly empty — gap detection only)\n`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// SETUP
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('SETUP')

	const brain = new Brain({
		prompt: BRAIN_PROMPT,
		model,
		store: new MemoryBrainStore(),
		autoSetup: false,
		learners: [],
		learning: {
			store: () => new MemoryStore(),
			understand: {
				thresholds: {
					maxObservations: 2,
					minImportance: 0.1,
				},
			},
		},
		internalLearners: {
			globalUnderstanding: true,
			globalQueryUnderstanding: false,
			injectionGaps: {
				understand: {
					thresholds: {
						maxObservations: 2,
						minImportance: 0.1,
					},
				},
			},
			queryGaps: false,
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 2,
		},
	})

	// Subscribe to ALL events
	brain.on((event) => {
		events.push({ type: event.type, payload: event.payload, time: Date.now() - startTime })
		const p = event.payload as Record<string, unknown>
		const id = p?.learnerId ?? p?.injectId ?? p?.action ?? ''
		console.log(`  [${elapsed()}s] ${event.type} ${id ? `[${id}]` : ''}`)
	})

	await brain.initialize()

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// PRINT ALL COMPILED PROMPTS
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('COMPILED PROMPTS')

	console.log(`\n  Brain prompt:`)
	console.log(`  ---`)
	console.log(BRAIN_PROMPT)
	console.log(`  ---`)

	console.log(`\n  Prompt context (compiled):`)
	console.log(`  ---`)
	console.log(JSON.stringify((brain as any).state.promptContext, null, 2) ?? '(null)')
	console.log(`  ---`)

	// External learners
	for (const l of brain.getLearners()) {
		const state = (l as any).state
		console.log(`\n  === ${l.id} (${l.type}) ===`)
		console.log(`  instructions: ${l.instructions}`)
		if (state?.observe_identity) {
			console.log(`\n  observe_identity:`)
			console.log(JSON.stringify(state.observe_identity, null, 2))
		}
		if (state?.observe_prompt) {
			console.log(`\n  observe_prompt:`)
			console.log(state.observe_prompt)
		}
		if (state?.understand_prompt) {
			console.log(`\n  understand_prompt:`)
			console.log(state.understand_prompt)
		}
	}

	// Internal learners — especially gap learner
	for (const [id, learner] of brain.internalLearners) {
		const state = (learner as any).state
		console.log(`\n  === ${id} (internal, ${learner.type}) ===`)
		console.log(`  instructions: ${learner.instructions}`)
		if (state?.observe_identity) {
			console.log(`\n  observe_identity:`)
			console.log(JSON.stringify(state.observe_identity, null, 2))
		}
		if (state?.understand_prompt) {
			console.log(`\n  understand_prompt:`)
			console.log(state.understand_prompt)
		}
	}

	console.log(`\n  Learners: ${brain.getLearners().length} external, ${brain.internalLearners.size} internal`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// INJECT + MONITOR GAP LEARNER
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('INJECTION + GAP MONITORING')

	const gapLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.injectionGaps)!
	const globalLearner = brain.getInternalLearner(INTERNAL_LEARNER_IDS.globalUnderstanding)!

	for (let i = 0; i < ALL_BATCHES.length; i++) {
		const batch = ALL_BATCHES[i]
		console.log(`\n  ═══════════════════════════════════════════`)
		console.log(`  ${batch.label} (${batch.data.length} items)`)
		console.log(`  ═══════════════════════════════════════════`)

		const result = await brain.inject(batch.data)

		// Injection results
		console.log(`\n  Injection results:`)
		for (const b of result.batches) {
			for (const lr of b.results) {
				console.log(`    ${lr.learnerId}: ${lr.result.status}`)
			}
		}

		// Gap learner state — RAW observation buffer dump
		const gapBuffer = await gapLearner.getBufferState()
		const gapMetrics = gapLearner.getMetrics()
		const gapUnderstanding = await gapLearner.getUnderstanding()
		const gapText = typeof gapUnderstanding === 'string' ? gapUnderstanding : JSON.stringify(gapUnderstanding)
		console.log(`\n  --- Gap Learner State ---`)
		console.log(`    Buffer: ${gapBuffer.count} pending`)
		console.log(`    Observations: ${gapMetrics.ingestion.observationCount}, Synthesis: ${gapMetrics.ingestion.synthesisCount}`)

		// Dump RAW buffer contents
		const gapStore = (gapLearner as any).store
		if (gapStore?.observations?.list) {
			const allObs = await gapStore.observations.list()
			console.log(`    RAW observations in store: ${allObs.length}`)
			for (const obs of allObs) {
				const data = typeof obs.data === 'string' ? obs.data : JSON.stringify(obs.data)
				console.log(`      [${obs.metadata_status}] importance=${obs.metadata_importance} data=${truncate(data, 300)}`)
			}
		}

		if (gapText && gapText.length > 2) {
			console.log(`    Understanding (${gapText.length} chars):`)
			console.log(gapText)
		} else {
			console.log(`    Understanding: (empty)`)
		}

		// Global understanding state
		const globalBuffer = await globalLearner.getBufferState()
		const globalMetrics = globalLearner.getMetrics()
		const globalUnderstanding = await globalLearner.getUnderstanding()
		const globalText = typeof globalUnderstanding === 'string' ? globalUnderstanding : JSON.stringify(globalUnderstanding)
		console.log(`\n  --- Global Understanding ---`)
		console.log(`    Buffer: ${globalBuffer.count} pending`)
		console.log(`    Observations: ${globalMetrics.ingestion.observationCount}, Synthesis: ${globalMetrics.ingestion.synthesisCount}`)
		if (globalText && globalText.length > 2) {
			console.log(`    Understanding (${globalText.length} chars):`)
			console.log(truncate(globalText, 500))
		}

		// Dismissed batches — RAW data dump
		const dismissed = await brain.store.dismissedBatches.list()
		console.log(`\n  --- Dismissed Batches: ${dismissed.length} ---`)
		for (const d of dismissed) {
			const dataStr = typeof d.data === 'string' ? d.data : JSON.stringify(d.data)
			const gapsStr = typeof d.gaps === 'string' ? d.gaps : JSON.stringify(d.gaps)
			console.log(`    ${d.id}: status=${d.status}, retryCount=${d.retryCount}`)
			console.log(`      gaps: ${gapsStr}`)
			console.log(`      data: ${truncate(dataStr, 400)}`)
		}

		// Signals — FULL payload dump
		const signals = events.filter(e => e.type === 'brain:signal:received')
		console.log(`\n  Signals so far: ${signals.length}`)
		for (const s of signals) {
			console.log(`    [${(s.time / 1000).toFixed(1)}s] signal:`)
			console.log(JSON.stringify(s.payload, null, 2))
		}

		// Evolution events — FULL payload dump
		const evoEvents = events.filter(e => e.type.startsWith('evolution:') || e.type.startsWith('evaluator:'))
		console.log(`\n  Evolution events so far: ${evoEvents.length}`)
		for (const e of evoEvents) {
			console.log(`    [${(e.time / 1000).toFixed(1)}s] ${e.type}:`)
			console.log(JSON.stringify(e.payload, null, 2))
		}

		// Learner count
		const learners = brain.getLearners()
		console.log(`\n  Current learners: ${learners.length}`)
		for (const l of learners) {
			console.log(`    ${l.id} (${l.type}) — "${l.name}"`)
		}
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// FINAL REPORT
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	// Wait for async evolution to complete
	console.log(`\n  Waiting 30s for async evolution to complete...`)
	await new Promise(resolve => setTimeout(resolve, 30000))

	logger.logSection('FINAL REPORT')

	// Full learner dump
	const finalLearners = brain.getLearners()
	console.log(`\n  Final learners: ${finalLearners.length} (started with 0)`)
	for (const l of finalLearners) {
		const understanding = await l.getUnderstanding()
		const text = typeof understanding === 'string' ? understanding : JSON.stringify(understanding, null, 2)
		const metrics = l.getMetrics()
		const health = l.getHealth()
		console.log(`\n  ${l.id} (${l.type}) — "${l.name}"`)
		console.log(`    health: ${health.status} (${health.activation.toFixed(2)})`)
		console.log(`    obs=${metrics.ingestion.observationCount} synth=${metrics.ingestion.synthesisCount} dismiss=${metrics.ingestion.dismissalCount}`)
		if (text && text.length > 2) {
			console.log(`    Understanding:`)
			console.log(text)
		}
	}

	// Gap learner final state
	const finalGapUnderstanding = await gapLearner.getUnderstanding()
	const finalGapText = typeof finalGapUnderstanding === 'string' ? finalGapUnderstanding : JSON.stringify(finalGapUnderstanding)
	console.log(`\n  === Gap Learner Final Understanding ===`)
	console.log(finalGapText || '(empty)')

	// Event summary
	console.log(`\n  === Event Summary ===`)
	const eventCounts: Record<string, number> = {}
	for (const e of events) eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`    ${type}: ${count}`)
	}

	const totalElapsed = Date.now() - startTime
	await brain.dispose()
	logger.logSuccess(`Eval complete in ${(totalElapsed / 1000).toFixed(1)}s — ${events.length} events, ${finalLearners.length} learners (started with 0)`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
