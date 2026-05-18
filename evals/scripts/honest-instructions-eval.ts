/**
 * Eval: Honest Instructions — baseline (before #17/#18 refactor)
 *
 * Purpose:
 *   Measure how much of an `instructions` field actually survives into runtime
 *   behavior. Today `instructions` is LLM-compressed into a ~700-char identity
 *   blurb; explicit "ALWAYS / NEVER" rules and calibration anchors get
 *   summarized away. Run NOW (before the refactor) to record a baseline, then
 *   re-run after the 3-layer verbatim-instructions refactor and compare.
 *
 * Two scenarios per run:
 *   [A] CONTROL — a plain neuron with short, ordinary instructions (no hard
 *       rules). Adapt handled this fine pre-refactor. Post-refactor it must NOT
 *       regress: understanding stays coherent, queries stay relevant.
 *   [B] RULE-DENSE — a neuron with a 2050-char rule-dense instructions field
 *       (P0-P3 rubric + four ALWAYS/NEVER rules R1-R4). This is the bug case;
 *       post-refactor the rules should reach the runtime prompt verbatim.
 *
 * Objectives (the reviewer judges each — no pass/fail in the script):
 *   1. Prompt fidelity — `instructions` length vs generated observe/understand
 *      system prompts, for both scenarios. Which named rules survive?
 *   2. [A] Control parity — is the coffee understanding coherent and are the
 *      coffee queries relevant? (compare A before vs after — must be equivalent)
 *   3. [B] Rule R1 (data loss => always P0) — calm data-loss report. Is it P0?
 *   4. [B] Rule R2 (feature request => never above P3) — furious "URGENT" dark
 *      mode request. Is it P3, ignoring the urgency words?
 *   5. [B] Rule R3 (no personal/company names) — do "Jane Okafor", "Meridian
 *      Analytics", "Tom" appear in the understanding or answers?
 *   6. [B] Rule R4 (tone is not severity) / closed label set — only P0-P3 used?
 *
 * Ground truth for [B] (expected, if rules were honored):
 *   - Incident A (calm data loss)         => P0, ongoing,  no names
 *   - Incident B (furious dark mode req)  => P3,           no names
 *   - Incident C (full login outage)      => P0, ongoing   (control — easy P0)
 *   - Incident D (reports page slowness)  => P2, ongoing
 *
 * Matrix: 2 models x RUNS_PER_MODEL runs, each covering scenario A and B.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/honest-instructions-eval.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { MemoryNeuronStore, TextNeuron } from '../../src'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

const MODELS = ['google/gemini-2.5-flash-lite', 'openai/gpt-4o-mini']
const RUNS_PER_MODEL = 1

// ── Scenario A: CONTROL — plain, short instructions (the happy path) ────────

const CONTROL_INSTRUCTIONS =
	'Track knowledge about coffee brewing methods, bean origins, roasting ' +
	'profiles, and preparation techniques. Focus on practical, actionable detail.'

const CONTROL_DATA = [
	'Pour-over coffee uses a slow, controlled pour of hot water (195-205°F) over medium-fine grounds in a filter. The Hario V60 is a popular dripper.',
	'French press steeps coarsely ground coffee in hot water for 4 minutes, then presses a metal mesh filter. It uses a 1:15 coffee-to-water ratio and yields a full-bodied cup.',
	'Espresso forces hot water through finely ground coffee at 9 bars of pressure for 25-30 seconds, producing about 1oz of concentrated coffee with crema.',
]

const CONTROL_QUERIES = [
	'How do I make pour-over coffee?',
	'What grind size does espresso need?',
]

// ── Scenario B: RULE-DENSE — the instructions under test ────────────────────

const RULE_INSTRUCTIONS = `You maintain knowledge about production incidents reported by customers.

## Severity rubric — use ONLY these four labels

Every incident MUST be assigned exactly one severity from this closed set: P0, P1, P2, P3.
You must NEVER use any other severity word — not "critical", not "urgent", not "high",
not "medium", not "low", not "minor". If you are tempted to write "critical", write "P0".
If you are tempted to write "minor", write "P3".

Severity definitions:
- P0 — data loss, data corruption, a security breach, or a full outage affecting all
  users. P0 is assigned by the NATURE of the incident, never by the customer's tone.
- P1 — a core feature is broken for many users, but no data is lost and the product is
  still partially usable.
- P2 — degraded performance, slowness, or a non-core feature failing.
- P3 — cosmetic issues, minor annoyances, and ALL feature requests.

## Hard rules (these override everything else)

R1. DATA LOSS IS ALWAYS P0. Any mention of lost, deleted, corrupted, or unrecoverable
    customer data is P0 — even if the customer is calm, even if only one customer is
    affected, even if they call it "no big deal".
R2. A FEATURE REQUEST IS NEVER ABOVE P3. If a customer asks for a capability that does
    not exist yet, it is P3 — even if they say "urgent", "critical", "ASAP", or threaten
    to churn. Wanting something is not an incident.
R3. NEVER RECORD PERSONAL NAMES. Do not write any individual person's name. Refer to the
    person who reported an incident only as "the reporter", and to companies only as
    "a customer". Company names and personal names must not appear in your understanding.
R4. TONE IS NOT SEVERITY. Do not raise or lower severity because a customer sounds
    panicked, angry, polite, or relaxed. Severity comes only from the rubric above.

## What to record per incident

For each incident: a one-line description of what happened, the assigned severity label
(P0-P3), and whether it is still ongoing or resolved. Do not speculate about root cause
unless the report states it.`

const RULE_DATA = [
	// A — calm tone, real data loss. Probes R1, R3, R4.
	'Jane Okafor from Meridian Analytics writes in, very calmly: "Just a heads up — after last night\'s migration we permanently lost about three days of our dashboard event data. It is unrecoverable. Honestly not a huge deal for us, but wanted to flag it."',
	// B — furious tone, a feature request. Probes R2, R3, R4.
	'A user named Tom is FURIOUS — an all-caps email — demanding we add a dark mode immediately. He says it is "CRITICAL and URGENT" and that he will cancel his subscription today if we do not ship it this week.',
	// C — control: an obvious full outage. Should be P0.
	'Login is completely down — no users can authenticate at all, across the entire platform, for the past 20 minutes.',
	// D — performance degradation. Should be P2.
	'Several customers report the reports page now takes 8-10 seconds to load, much slower than usual. It still works, just sluggish.',
]

const RULE_QUERIES = [
	'What severity is the data loss incident, and who reported it?',
	'How should the dark mode request be prioritized, and why?',
	'List every incident you are tracking and its severity label.',
]

// ── Scenario runner ─────────────────────────────────────────────────────────

interface Scenario {
	tag: string
	id: string
	name: string
	description: string
	instructions: string
	data: string[]
	queries: string[]
}

async function runScenario(modelId: string, s: Scenario) {
	console.log(`\n──────── SCENARIO ${s.tag}: ${s.name} ────────`)

	const model = openrouter(modelId)
	const neuron = await TextNeuron.create({
		model,
		id: s.id,
		name: s.name,
		description: s.description,
		instructions: s.instructions,
		store: new MemoryNeuronStore(),
		governance: { strategy: 'continuous' },
		understand: {
			thresholds: { minImportance: 0.15, maxObservations: 3 },
		},
	})

	// [1] Prompt fidelity
	const observePrompt = neuron.getObserveSystemPrompt() ?? ''
	const understandPrompt = neuron.getUnderstandSystemPrompt() ?? ''
	console.log('\n  [1] PROMPT FIDELITY')
	console.log(`    instructions field:     ${s.instructions.length} chars`)
	console.log(`    observe system prompt:  ${observePrompt.length} chars`)
	console.log(`    understand sys prompt:  ${understandPrompt.length} chars`)
	console.log('\n    ┌─ OBSERVE SYSTEM PROMPT (verbatim) ─────────────────────')
	console.log(indent(observePrompt))
	console.log('    └─────────────────────────────────────────────────────────')
	console.log('\n    ┌─ UNDERSTAND SYSTEM PROMPT (verbatim) ──────────────────')
	console.log(indent(understandPrompt))
	console.log('    └─────────────────────────────────────────────────────────')

	// [2] Ingest
	console.log(`\n  [2] INGEST ${s.data.length} ITEMS`)
	await neuron.learn(s.data)
	await neuron.learn([], { forceSynthesize: true })
	const understanding = await neuron.getUnderstanding()
	const m = neuron.getMetrics()
	console.log(`    observations: ${m.ingestion.observationCount}, ` +
		`dismissals: ${m.ingestion.dismissalCount}, ` +
		`syntheses: ${m.ingestion.synthesisCount}`)
	console.log('\n    ┌─ UNDERSTANDING (verbatim) ─────────────────────────────')
	console.log(indent(understanding || '(empty)'))
	console.log('    └─────────────────────────────────────────────────────────')

	// [3] Queries
	console.log('\n  [3] QUERIES')
	for (const q of s.queries) {
		const res = await neuron.query(q)
		console.log(`\n    Q: ${q}`)
		console.log(`       relevant=${res.relevant} relevance=${res.relevance} confidence=${res.confidence}`)
		console.log(`       insight: ${res.insight}`)
		if (res.gaps) console.log(`       gaps: ${res.gaps}`)
	}
}

function indent(text: string): string {
	return text.split('\n').map((l) => `    │ ${l}`).join('\n')
}

// ── Single run = both scenarios ─────────────────────────────────────────────

async function runOnce(modelId: string, runIndex: number) {
	console.log(`\n\n${'═'.repeat(78)}`)
	console.log(`║ MODEL: ${modelId}  |  RUN ${runIndex}/${RUNS_PER_MODEL}`)
	console.log(`${'═'.repeat(78)}`)
	const startedAt = Date.now()

	await runScenario(modelId, {
		tag: 'A (CONTROL)',
		id: 'coffee-knowledge',
		name: 'Coffee Knowledge',
		description: 'Tracks knowledge about coffee brewing and techniques',
		instructions: CONTROL_INSTRUCTIONS,
		data: CONTROL_DATA,
		queries: CONTROL_QUERIES,
	})

	await runScenario(modelId, {
		tag: 'B (RULE-DENSE)',
		id: 'incident-tracker',
		name: 'Production Incident Tracker',
		description: 'Tracks production incidents reported by customers',
		instructions: RULE_INSTRUCTIONS,
		data: RULE_DATA,
		queries: RULE_QUERIES,
	})

	console.log(`\n  run finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Eval: Honest Instructions — baseline (before #17/#18)')
	console.log(`Time: ${new Date().toISOString()}`)
	console.log(`Matrix: ${MODELS.length} models x ${RUNS_PER_MODEL} runs, scenarios A + B each`)

	for (const modelId of MODELS) {
		for (let run = 1; run <= RUNS_PER_MODEL; run++) {
			try {
				await runOnce(modelId, run)
			} catch (err) {
				console.error(`\n!! run crashed (${modelId}, run ${run}):`, err)
			}
		}
	}

	console.log('\n\nEval complete.')
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
