/**
 * Eval: Brain askDirect pre-filtering
 *
 * Objectives:
 *   1. When asking a domain-specific question, only relevant learners appear in sources
 *   2. Clearly unrelated learners are excluded from sources
 *   3. Ambiguous/cross-domain queries include multiple relevant learners
 *   4. Single-learner brain skips filtering (no wasted LLM call)
 *
 * Setup:
 *   4 learners across distinct domains:
 *   - coffee-brewing (text): coffee brewing methods
 *   - workout-log (list): gym exercises and routines
 *   - git-commands (text): git version control
 *   - recipe-book (list): cooking recipes
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/brain-17-ask-prefilter.ts
 */

import { Brain } from '../../src/brain/class'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

async function main() {
	console.log('Eval: Brain askDirect pre-filtering')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	const brain = new Brain({
		prompt: 'A multi-domain knowledge brain',
		model: openrouter(MODEL),
		autoSetup: false,
		learners: [
			{
				id: 'coffee-brewing',
				name: 'Coffee Brewing Expert',
				type: 'text' as const,
				description: 'Tracks coffee brewing methods, bean origins, grind sizes, and extraction techniques.',
				instructions: 'Track knowledge about coffee brewing.',
				governance: { strategy: 'continuous' as const },
			},
			{
				id: 'workout-log',
				name: 'Workout Tracker',
				type: 'list' as const,
				description: 'Tracks gym exercises, workout routines, sets, reps, and fitness goals.',
				instructions: 'Track gym workouts and exercises.',
			},
			{
				id: 'git-commands',
				name: 'Git Expert',
				type: 'text' as const,
				description: 'Tracks git version control commands, workflows, branching strategies, and best practices.',
				instructions: 'Track git commands and workflows.',
				governance: { strategy: 'continuous' as const },
			},
			{
				id: 'recipe-book',
				name: 'Recipe Collection',
				type: 'list' as const,
				description: 'Tracks cooking recipes, ingredients, techniques, and meal planning.',
				instructions: 'Track cooking recipes and techniques.',
			},
		],
	})

	await brain.initialize()

	const learners = brain.getLearners()
	console.log(`\nLearners created: ${learners.map((l) => l.id).join(', ')}`)

	// ── Inject knowledge ────────────────────────────────────────────────────
	// inject() sends to ALL learners — each learner's instructions determine what it absorbs

	console.log('\n═══ Injecting knowledge ═══\n')

	await brain.inject([
		'Pour-over coffee uses a 1:16 ratio with 200°F water and a medium-fine grind. Brew time is 3-4 minutes.',
		'French press uses coarse grind, 1:12 ratio, 4 minute steep. Produces full-bodied coffee.',
		'Espresso requires 9 bars of pressure, fine grind, 25-30 second extraction.',
		'Bench press: 4 sets of 8 reps at 185lbs. Targets chest, shoulders, triceps.',
		'Deadlift: 3 sets of 5 reps at 315lbs. Targets posterior chain.',
		'Pull-ups: 3 sets of 12 reps bodyweight. Targets lats and biceps.',
		'git rebase -i HEAD~3 lets you squash, reorder, or edit the last 3 commits interactively.',
		'git cherry-pick <sha> applies a single commit from another branch onto current branch.',
		'git bisect uses binary search to find the commit that introduced a bug.',
		'Carbonara: spaghetti, eggs, pecorino, guanciale, black pepper. No cream. Toss with pasta water.',
		'Thai green curry: coconut milk, green curry paste, chicken, bamboo shoots, Thai basil.',
		'Shakshuka: tomatoes, bell peppers, onions, cumin, paprika, poached eggs on top.',
	])
	console.log('Injected 12 items across all domains')

	// Let learners process
	await new Promise((r) => setTimeout(r, 2000))

	// Log what each learner absorbed
	for (const l of brain.getLearners()) {
		const u = await l.getUnderstanding()
		const uLen = typeof u === 'string' ? u.length : Array.isArray(u) ? u.length : 0
		console.log(`  ${l.id}: understanding size = ${uLen}`)
	}

	// ── Scenario 1: Coffee-only question ────────────────────────────────────

	console.log('\n═══ Scenario 1: Coffee-only question ═══')
	console.log('Query: "What is the ideal grind size for pour-over?"')
	console.log('Expected relevant: coffee-brewing')
	console.log('Expected excluded: workout-log, git-commands, recipe-book\n')

	const r1 = await brain.ask('What is the ideal grind size for pour-over?', { mode: 'direct' })
	console.log(`Sources: ${r1.sources.map((s) => `${s.learnerId} (rel=${s.relevance})`).join(', ') || 'none'}`)
	console.log(`Insight: ${r1.insight.slice(0, 200)}`)
	console.log(`Gaps: ${r1.gaps.join(', ') || 'none'}`)

	// ── Scenario 2: Git-only question ───────────────────────────────────────

	console.log('\n═══ Scenario 2: Git-only question ═══')
	console.log('Query: "How do I use git bisect to find a bug?"')
	console.log('Expected relevant: git-commands')
	console.log('Expected excluded: coffee-brewing, workout-log, recipe-book\n')

	const r2 = await brain.ask('How do I use git bisect to find a bug?', { mode: 'direct' })
	console.log(`Sources: ${r2.sources.map((s) => `${s.learnerId} (rel=${s.relevance})`).join(', ') || 'none'}`)
	console.log(`Insight: ${r2.insight.slice(0, 200)}`)
	console.log(`Gaps: ${r2.gaps.join(', ') || 'none'}`)

	// ── Scenario 3: Cross-domain (cooking + coffee) ─────────────────────────

	console.log('\n═══ Scenario 3: Cross-domain question (food & drink) ═══')
	console.log('Query: "What should I serve for an Italian dinner with good coffee?"')
	console.log('Expected relevant: recipe-book, coffee-brewing')
	console.log('Expected excluded: workout-log, git-commands\n')

	const r3 = await brain.ask('What should I serve for an Italian dinner with good coffee?', { mode: 'direct' })
	console.log(`Sources: ${r3.sources.map((s) => `${s.learnerId} (rel=${s.relevance})`).join(', ') || 'none'}`)
	console.log(`Insight: ${r3.insight.slice(0, 200)}`)
	console.log(`Gaps: ${r3.gaps.join(', ') || 'none'}`)

	// ── Scenario 4: Fitness-only question ───────────────────────────────────

	console.log('\n═══ Scenario 4: Fitness-only question ═══')
	console.log('Query: "What exercises target the posterior chain?"')
	console.log('Expected relevant: workout-log')
	console.log('Expected excluded: coffee-brewing, git-commands, recipe-book\n')

	const r4 = await brain.ask('What exercises target the posterior chain?', { mode: 'direct' })
	console.log(`Sources: ${r4.sources.map((s) => `${s.learnerId} (rel=${s.relevance})`).join(', ') || 'none'}`)
	console.log(`Insight: ${r4.insight.slice(0, 200)}`)
	console.log(`Gaps: ${r4.gaps.join(', ') || 'none'}`)

	console.log('\n═══ Done ═══')
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
