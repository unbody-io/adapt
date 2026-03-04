/**
 * Eval: Myceliom Brain — AutoSetup + Injection
 *
 * Tests Brain with autoSetup: true and no predefined learners.
 * Injects diverse bookmark data and logs everything raw.
 *
 * Flow:
 *   1. Init brain → log all auto-created learners (raw details)
 *   2. Inject batches → log every event, every synthesis understanding, every evolution action
 *   3. Final dump → full understanding of all learners (internal + external)
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/thread-detection-eval.ts
 */

import { Brain } from '../../src/brain/class'
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
// Timing
// ─────────────────────────────────────────────────────────────────────────────

const startTime = Date.now()
function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Settle detection — wait for async evolution to finish
// ─────────────────────────────────────────────────────────────────────────────

let lastEvolutionEventTime = 0

function markEvolutionActivity() {
	lastEvolutionEventTime = Date.now()
}

function waitForSettle(quietMs = 8000, maxMs = 120000): Promise<void> {
	return new Promise((resolve) => {
		const deadline = Date.now() + maxMs
		const check = () => {
			if (Date.now() >= deadline) {
				console.log(`  [${elapsed()}s] settle: max timeout`)
				resolve()
				return
			}
			if (Date.now() - lastEvolutionEventTime >= quietMs) {
				resolve()
				return
			}
			setTimeout(check, 1000)
		}
		setTimeout(check, quietMs)
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function dumpLearnerRaw(learner: any, label: string) {
	console.log(`\n  ── ${label} ──`)
	console.log(`    id:           ${learner.id}`)
	console.log(`    type:         ${learner.type}`)
	console.log(`    name:         ${learner.name}`)
	console.log(`    origin:       ${learner.origin}`)
	console.log(`    description:  ${learner.description}`)
	console.log(`    instructions: ${learner.instructions}`)
	console.log(`    focus:        ${learner.focus ?? '(none)'}`)
	console.log(`    initialized:  ${learner.isInitialized()}`)

	const health = learner.getHealth()
	console.log(`    health:       status=${health.status} activation=${health.activation.toFixed(2)}`)

	const thresholds = learner.getUnderstandThresholds()
	console.log(`    thresholds:   ${JSON.stringify(thresholds)}`)

	// Prompts
	const obsPrompt = learner.getObserveSystemPrompt()
	if (obsPrompt) {
		console.log(`    observePrompt (${obsPrompt.length} chars):`)
		console.log(`      ${obsPrompt.replace(/\n/g, '\n      ')}`)
	}
	const undPrompt = learner.getUnderstandSystemPrompt()
	if (undPrompt) {
		console.log(`    understandPrompt (${undPrompt.length} chars):`)
		console.log(`      ${undPrompt.replace(/\n/g, '\n      ')}`)
	}

	// Schemas
	const obsSchema = learner.getObservationSchema()
	if (obsSchema) {
		console.log(`    observationSchema:`)
		console.log(`      ${JSON.stringify(obsSchema, null, 2).replace(/\n/g, '\n      ')}`)
	}
	const undSchema = learner.getUnderstandingSchema()
	if (undSchema) {
		console.log(`    understandingSchema:`)
		console.log(`      ${JSON.stringify(undSchema, null, 2).replace(/\n/g, '\n      ')}`)
	}

	// Understanding
	const understanding = await learner.getUnderstanding()
	if (understanding) {
		const text = typeof understanding === 'string' ? understanding : JSON.stringify(understanding, null, 2)
		console.log(`    understanding (${text.length} chars):`)
		console.log(`      ${text.replace(/\n/g, '\n      ')}`)
	} else {
		console.log(`    understanding: (empty)`)
	}
}

async function dumpAllUnderstandings(brain: Brain, label: string) {
	console.log(`\n  ═══ ${label} ═══`)

	// External learners
	const learners = brain.getLearners()
	console.log(`\n  External learners: ${learners.length}`)
	for (const l of learners) {
		await dumpLearnerRaw(l, `${l.id} — "${l.name}"`)
	}

	// Internal learners
	const internals = Array.from((brain as any).internalLearners.values())
	console.log(`\n  Internal learners: ${internals.length}`)
	for (const l of internals as any[]) {
		const understanding = await l.getUnderstanding()
		const text = typeof understanding === 'string' ? understanding : JSON.stringify(understanding, null, 2)
		console.log(`\n  ── ${l.id} (${l.type}) ──`)
		if (text && text.length > 2) {
			console.log(`    understanding (${text.length} chars):`)
			console.log(`      ${text.replace(/\n/g, '\n      ')}`)
		} else {
			console.log(`    understanding: (empty)`)
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain Prompt
// ─────────────────────────────────────────────────────────────────────────────

const BRAIN_PROMPT = `Mycelium is my personal attention tracker. I save things from everywhere — bookmarks, articles, notes, conversations with Claude, products, images, code repos. I want it to understand what I'm actually paying attention to, notice when new threads emerge, and help me see patterns I can't see myself.`

// ─────────────────────────────────────────────────────────────────────────────
// Dataset — 10 batches
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_1 = [
	{ type: 'Note', title: 'Build our own bookmarking app under the Unbody brand. Allows us to experiment with tech and learn...', savedAt: '2025-12-10T10:00:00Z' },
	{ type: 'Note', title: 'Mindloops — another app name idea: Untangle...', savedAt: '2025-12-12T14:30:00Z' },
	{ type: 'Claude conversation', title: 'AI as mental prosthetic for ADHD', context: 'Where the term "cognitive exoskeleton" was coined — AI that extends executive function', savedAt: '2025-12-14T20:00:00Z' },
	{ type: 'Claude conversation', title: 'Untangle elevator pitch and name origin', context: 'Trying to articulate what this tool IS — not a bookmark manager, a thinking partner', savedAt: '2025-12-16T09:00:00Z' },
	{ type: 'Article', title: 'The Tools We Think With', context: 'How writing, maps, and software shape cognition — not just augment it', source: 'aeon.co', savedAt: '2025-12-17T11:00:00Z' },
	{ type: 'WebPage', title: 'Notion vs Obsidian vs Roam — PKM tool comparison', context: 'Evaluating existing tools. None of them understand the user.', source: 'nesslabs.com', savedAt: '2025-12-18T08:00:00Z' },
	{ type: 'Article', title: 'Andy Matuschak — Why books don\'t work', context: 'Reading is not understanding. Passive consumption creates illusion of learning.', source: 'andymatuschak.org', savedAt: '2025-12-19T15:00:00Z' },
	{ type: 'Repository', title: 'logseq', context: 'Open source knowledge base with outliner and graph view', source: 'github.com/logseq', savedAt: '2025-12-20T10:00:00Z' },
]

const BATCH_2 = [
	{ type: 'Article', title: 'Malleable software: Restoring user agency', context: 'Ink & Switch — software should adapt to users, not the other way around', source: 'inkandswitch.com', savedAt: '2025-12-22T11:00:00Z' },
	{ type: 'WebPage', title: 'Capture the Why', context: 'sanju.sh — the gap between saving content and understanding why you saved it', source: 'sanju.sh', savedAt: '2025-12-23T16:00:00Z' },
	{ type: 'Claude conversation', title: 'Users as routers between software silos', context: '"We became users. We had to adapt our thinking and actions to the software"', savedAt: '2025-12-24T13:00:00Z' },
	{ type: 'Article', title: 'End-User Programming', context: 'Ink & Switch — vision of users as creators, not consumers of software', source: 'inkandswitch.com', savedAt: '2025-12-25T10:00:00Z' },
	{ type: 'WebPage', title: 'Dynamicland — Bret Victor', context: 'Computing that lives in the physical world. Radical rethinking of what an interface is.', source: 'dynamicland.org', savedAt: '2025-12-26T14:00:00Z' },
	{ type: 'Claude conversation', title: 'What if the tool could see across all my apps?', context: 'Frustration with context fragmentation — each app is a silo, the user is the only integration layer', savedAt: '2025-12-27T09:00:00Z' },
	{ type: 'Article', title: 'Local-first software: You own your data', context: 'Ink & Switch — CRDTs, offline-first, data ownership', source: 'inkandswitch.com', savedAt: '2025-12-28T11:00:00Z' },
	{ type: 'Repository', title: 'automerge', context: 'CRDT library for building local-first collaborative applications', source: 'github.com/automerge', savedAt: '2025-12-28T14:00:00Z' },
]

const BATCH_3 = [
	{ type: 'Claude conversation', title: 'Recovery from ADHD energy crash', context: 'Discussing energy depletion cycles, burnout recovery strategies', savedAt: '2025-12-28T19:00:00Z' },
	{ type: 'Note', title: "You're trying to solve an emotional problem with a depleted nervous system. It's like trying to have therapy while running a marathon. You can't do the work until you stop.", savedAt: '2025-12-30T23:00:00Z' },
	{ type: 'Article', title: 'ADHD and the Interest-Based Nervous System', context: 'William Dodson — ADHD motivation isn\'t broken willpower, it\'s a different reward system', source: 'additudemag.com', savedAt: '2026-01-02T10:00:00Z' },
	{ type: 'Claude conversation', title: 'Naming avoidance and procrastination', context: 'Trying to develop vocabulary for categorizing tasks being put off', savedAt: '2026-01-03T14:00:00Z' },
	{ type: 'Note', title: 'Energy log: woke up at 6, crashed by 10. The pattern is accelerating.', savedAt: '2026-01-04T11:00:00Z' },
	{ type: 'Article', title: 'Burnout Is Not Just Exhaustion — It\'s Depersonalization', context: 'The three dimensions of burnout: exhaustion, cynicism, and reduced efficacy', source: 'hbr.org', savedAt: '2026-01-05T09:00:00Z' },
	{ type: 'Claude conversation', title: 'Self-assessment of current challenges', context: 'Severe energy depletion, avoidance patterns — tension between building and recovery', savedAt: '2026-01-06T21:00:00Z' },
	{ type: 'WebPage', title: 'ADHD Burnout Recovery: A Non-Linear Process', context: 'Recovery isn\'t a straight line — expect setbacks, plan for them', source: 'chadd.org', savedAt: '2026-01-07T15:00:00Z' },
	{ type: 'Note', title: 'The crash is not the problem. The problem is the acceleration before the crash that I never see coming.', savedAt: '2026-01-08T22:00:00Z' },
	{ type: 'Article', title: 'Spoon Theory and Chronic Energy Management', context: 'Finite energy budget — spending spoons wisely', source: 'butyoudontlooksick.com', savedAt: '2026-01-09T08:00:00Z' },
]

const BATCH_4 = [
	{ type: 'Note', title: 'Wedding language', context: '"something that feels special and elevated, but not through the usual performative markers of fancy. Elevated backyard party. Intimacy, informality, people actually relaxed and present — but with care put in."', savedAt: '2026-01-10T19:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding day structure and values outline', context: "Noémi's theatrical-acts brainstorm — the wedding as a story with acts", savedAt: '2026-01-11T21:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding venue planning and cost estimate', context: 'Babós-Forró Mansion, Pădureni — rural Transylvania, outdoor space', savedAt: '2026-01-12T15:00:00Z' },
	{ type: 'Image', title: 'Elegant Outdoor Wedding Reception Under Decorated Tent', savedAt: '2026-01-13T12:00:00Z' },
	{ type: 'Image', title: 'Outdoor Wedding Reception Under Tent', savedAt: '2026-01-14T14:00:00Z' },
	{ type: 'Image', title: 'Outdoor Wedding Reception in European Village Square', savedAt: '2026-01-15T10:00:00Z' },
	{ type: 'Image', title: 'Outdoor Wedding Reception Under Canvas Tent', savedAt: '2026-01-16T16:00:00Z' },
	{ type: 'WebPage', title: 'Rustic Wedding Venues in Transylvania', context: 'Outdoor venues with character — barns, mansions, village squares', source: 'weddingwire.ro', savedAt: '2026-01-17T09:00:00Z' },
	{ type: 'Note', title: 'Anti-registry idea: instead of a gift list, ask people to bring a dish from their culture. Potluck wedding.', savedAt: '2026-01-18T20:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding catering — local vs imported food', context: 'Preference for local, seasonal, simple food. Nothing fussy.', savedAt: '2026-01-19T11:00:00Z' },
]

const BATCH_5 = [
	{ type: 'WebPage', title: 'PowerSync', context: 'Local-first data sync — real-time, offline, reactive', source: 'powersync.com', savedAt: '2026-01-20T09:00:00Z' },
	{ type: 'Repository', title: 'omnivore', context: 'Open-source read-it-later app — competitor research', source: 'github.com/omnivore', savedAt: '2026-01-21T11:00:00Z' },
	{ type: 'Repository', title: 'linkwarden', context: 'Bookmark management with AI tagging — competitor research', source: 'github.com/linkwarden', savedAt: '2026-01-22T14:00:00Z' },
	{ type: 'WebPage', title: 'mymind — the extension for your mind', context: 'AI-powered bookmarking, auto-tagging, visual search. Pretty but shallow.', source: 'mymind.com', savedAt: '2026-01-23T10:00:00Z' },
	{ type: 'WebPage', title: 'Raindrop.io — all-in-one bookmark manager', context: 'Polished UX, good collections, but just a filing cabinet', source: 'raindrop.io', savedAt: '2026-01-24T08:00:00Z' },
	{ type: 'Claude conversation', title: 'Cross-platform memory integration for Claude', context: 'Tried to retrofit the exoskeleton onto existing tools before building it', savedAt: '2026-01-25T10:00:00Z' },
	{ type: 'Claude conversation', title: 'Not enough time for everything', context: '"I need 10x to do what I want" — tension between ambition and capacity', savedAt: '2026-01-25T22:00:00Z' },
	{ type: 'WebPage', title: 'SQLite as an application file format', context: 'Using SQLite as the local data store — simple, robust, everywhere', source: 'sqlite.org', savedAt: '2026-01-26T09:00:00Z' },
	{ type: 'Repository', title: 'electric-sql', context: 'Sync engine for local-first apps — Postgres to SQLite', source: 'github.com/electric-sql', savedAt: '2026-01-27T11:00:00Z' },
	{ type: 'Article', title: 'You keep saving competitors but your vision is fundamentally different', context: 'Self-reflection: omnivore, linkwarden, mymind organize content. You want to understand a person.', source: 'journal', savedAt: '2026-01-28T15:00:00Z' },
]

const BATCH_6 = [
	{ type: 'Product', title: 'Liquid Silver Ring', context: 'Handmade Organic Sculptural Melted Band — wedding ring option', source: 'etsy.com', savedAt: '2026-02-01T10:00:00Z' },
	{ type: 'Product', title: 'Dripping Sterling Silver Ring', context: 'Modern Liquid Design — anti-industrial, organic feel', source: 'etsy.com', savedAt: '2026-02-01T10:15:00Z' },
	{ type: 'Product', title: 'Molten Ring — Recycled Sterling Silver', context: 'Handcrafted, organic shape — fits the "elevated but not performative" wedding aesthetic', source: 'etsy.com', savedAt: '2026-02-02T09:00:00Z' },
	{ type: 'Product', title: 'Flux Ring in Gold Vermeil', context: 'MARA Paris — organic flowing shape, artisanal', source: 'maraparis.com', savedAt: '2026-02-02T09:30:00Z' },
	{ type: 'Product', title: 'Ocean Dream Ring', context: 'MARA Paris — sculpted organic silver, wave-like form', source: 'maraparis.com', savedAt: '2026-02-02T10:00:00Z' },
	{ type: 'Image', title: 'Outdoor table setting with wildflowers and linen', savedAt: '2026-02-03T14:00:00Z' },
	{ type: 'Image', title: 'Handwritten place cards with pressed flowers', savedAt: '2026-02-03T14:15:00Z' },
	{ type: 'Note', title: 'Every ring saved is handmade, organic, anti-industrial. Every venue image is outdoor, European, relaxed. The aesthetic is coherent even though I never defined it explicitly.', savedAt: '2026-02-04T20:00:00Z' },
	{ type: 'Claude conversation', title: 'Wedding music — acoustic, folk, no DJ', context: 'Live musicians, local folk songs, maybe a string quartet for ceremony. No playlist energy.', savedAt: '2026-02-05T11:00:00Z' },
	{ type: 'WebPage', title: 'Sustainable Wedding Guide', context: 'Eco-friendly choices: local flowers, vintage decor, zero-waste catering', source: 'greenweddingshoes.com', savedAt: '2026-02-06T09:00:00Z' },
]

const BATCH_7 = [
	{ type: 'WebPage', title: 'Daylight Computer', context: '"A More Caring Computer" — e-ink, no blue light, calm computing, anti-addictive by design', source: 'daylightcomputer.com', savedAt: '2026-02-07T10:00:00Z' },
	{ type: 'WebPage', title: 'Resonance: AI-powered Journal', context: 'MIT Media Lab — reflective journaling with AI assistance', source: 'media.mit.edu', savedAt: '2026-02-08T16:00:00Z' },
	{ type: 'Claude conversation', title: 'Rhizome project handover and next steps', context: 'Naming the project Rhizome, planning architecture — the mycelium metaphor', savedAt: '2026-02-09T10:00:00Z' },
	{ type: 'Article', title: 'The Garden and the Stream: A Technopastoral', context: 'Mike Caulfield — two different approaches to the web. Streams (feeds) vs gardens (curated).', source: 'hapgood.us', savedAt: '2026-02-10T11:00:00Z' },
	{ type: 'Note', title: 'For every complex problem, there is an answer that is clear, simple, and wrong.', savedAt: '2026-02-11T08:00:00Z' },
	{ type: 'WebPage', title: 'Kobo Elipsa 2E — e-ink tablet for reading and writing', context: 'E-ink device research — calm reading, no distractions', source: 'kobo.com', savedAt: '2026-02-12T09:00:00Z' },
	{ type: 'Article', title: 'Calm Technology — Designing for the Next 50 Billion Devices', context: 'Amber Case — tech that respects attention, sits in periphery until needed', source: 'calmtech.com', savedAt: '2026-02-13T14:00:00Z' },
	{ type: 'Repository', title: 'hono', context: 'Ultra-fast web framework — considering for Rhizome API layer', source: 'github.com/honojs/hono', savedAt: '2026-02-14T10:00:00Z' },
	{ type: 'Claude conversation', title: 'The ecology vision for Rhizome', context: 'Soil (data) → Mycelium (processing) → Mushrooms (interfaces). The system is an organism.', savedAt: '2026-02-15T20:00:00Z' },
	{ type: 'Article', title: 'Digital Minimalism — Cal Newport', context: 'Choosing technology deliberately, not by default. Less is more.', source: 'calnewport.com', savedAt: '2026-02-16T09:00:00Z' },
]

const BATCH_8 = [
	{ type: 'Article', title: 'Building a Calm Note-Taking Tool', context: 'Bridges calm tech philosophy with tools-for-thought — digital minimalism meets PKM', source: 'calmtech.dev', savedAt: '2026-02-17T12:00:00Z' },
	{ type: 'WebPage', title: 'The Extended Mind: Annie Murphy Paul', context: 'How thinking extends beyond the brain — into tools, spaces, and other people', source: 'anniemurphypaul.com', savedAt: '2026-02-18T15:00:00Z' },
	{ type: 'Note', title: 'Connection: the wedding aesthetic and the Daylight Computer share the same sensibility. Calm, intentional, anti-performative. I used the word "calm" for both.', savedAt: '2026-02-19T21:00:00Z' },
	{ type: 'Claude conversation', title: 'What connects the wedding and the Daylight Computer?', context: 'Both are expressions of the same sensibility — calm, intentional, anti-performative', savedAt: '2026-02-20T10:00:00Z' },
	{ type: 'Article', title: 'The Science of Sourdough: Wild Yeast and Fermentation', context: 'Deep dive into how wild yeast cultures work, the microbiology of sourdough starters', source: 'seriouseats.com', savedAt: '2026-02-21T08:00:00Z' },
	{ type: 'WebPage', title: 'Tartine Country Loaf Recipe', context: 'Chad Robertson\'s famous recipe — high hydration, long cold ferment, open crumb structure', source: 'tartinebakery.com', savedAt: '2026-02-21T08:30:00Z' },
	{ type: 'Article', title: 'Sourdough as Meditation: The Practice of Slow Bread', context: 'The rhythms of feeding a starter, the patience of bulk fermentation — bread as mindfulness practice', source: 'breadmagazine.com', savedAt: '2026-02-22T07:00:00Z' },
	{ type: 'Note', title: 'Started my own sourdough starter today. Named it "Claude." Day 1: just flour and water. The waiting begins.', savedAt: '2026-02-22T20:00:00Z' },
	{ type: 'WebPage', title: 'Flour Water Salt Yeast — Ken Forkish Method', context: 'Beginner-friendly approach to artisan bread, emphasis on feel over precision', source: 'kenforkish.com', savedAt: '2026-02-23T12:00:00Z' },
	{ type: 'Article', title: 'Why Sourdough? The Probiotic Benefits of Fermented Bread', context: 'Gut health, reduced gluten sensitivity, longer shelf life — practical benefits', source: 'healthline.com', savedAt: '2026-02-23T15:00:00Z' },
]

const BATCH_9 = [
	{ type: 'Note', title: 'Sourdough day 3: bubbles appearing. The culture is alive. There\'s something deeply satisfying about nurturing a living thing that has its own schedule.', savedAt: '2026-03-01T07:00:00Z' },
	{ type: 'WebPage', title: 'Sourdough Scoring Patterns — Bread Art', context: 'Decorative scoring techniques for artisan loaves. Ear development.', source: 'theperfectloaf.com', savedAt: '2026-03-01T08:00:00Z' },
	{ type: 'Article', title: 'The Microbiome of Sourdough', context: 'Each starter develops a unique microbiome based on location, flour, environment', source: 'nature.com', savedAt: '2026-03-01T10:00:00Z' },
	{ type: 'Note', title: 'First bake attempt. Overproofed. Flat as a frisbee. But the smell — incredible.', savedAt: '2026-03-02T18:00:00Z' },
	{ type: 'WebPage', title: 'Troubleshooting Sourdough: Common Mistakes', context: 'Underproofed vs overproofed, hydration issues, oven spring problems', source: 'kingarthurbaking.com', savedAt: '2026-03-02T19:00:00Z' },
	{ type: 'Claude conversation', title: 'Mycelium as the new name for Rhizome', context: 'The project evolves: from Rhizome to Mycelium. The ecology metaphor deepens.', savedAt: '2026-03-03T10:00:00Z' },
	{ type: 'Article', title: 'How Notion Thinks About Data Models', context: 'Blocks, databases, relations. The primitives of personal software.', source: 'notion.so/blog', savedAt: '2026-03-03T14:00:00Z' },
	{ type: 'WebPage', title: 'Unbody — AI-native content platform', context: 'The company behind Mycelium. Headless CMS with AI understanding.', source: 'unbody.io', savedAt: '2026-03-04T09:00:00Z' },
	{ type: 'Claude conversation', title: 'Thread detection as the core feature', context: 'The system should discover threads of attention organically, not through user-created tags', savedAt: '2026-03-04T15:00:00Z' },
	{ type: 'Note', title: 'The thread registry idea: a learner that just watches everything and maintains a list of active threads. Like a table of contents for attention.', savedAt: '2026-03-05T08:00:00Z' },
]

const BATCH_10 = [
	{ type: 'Claude conversation', title: 'Wedding invitation wording — bilingual', context: 'Hungarian + English. Warm but not cheesy. Reflects the anti-performative values.', savedAt: '2026-03-06T10:00:00Z' },
	{ type: 'Product', title: 'Handmade Paper Wedding Invitations', context: 'Letterpress on cotton paper — tactile, imperfect, beautiful', source: 'etsy.com', savedAt: '2026-03-06T10:30:00Z' },
	{ type: 'Image', title: 'Outdoor ceremony with wildflower arch', savedAt: '2026-03-07T11:00:00Z' },
	{ type: 'Note', title: 'Second sourdough bake: much better rise! The ear is starting to form. Used a Dutch oven this time.', savedAt: '2026-03-07T18:00:00Z' },
	{ type: 'Article', title: 'Advanced Sourdough Hydration: 80%+ Doughs', context: 'High-hydration techniques for open crumb — stretch and fold vs coil fold', source: 'theperfectloaf.com', savedAt: '2026-03-08T08:00:00Z' },
	{ type: 'WebPage', title: 'Sourdough Discard Recipes: Crackers, Pancakes, Pizza', context: 'Using excess starter — zero waste baking', source: 'kingarthurbaking.com', savedAt: '2026-03-08T09:00:00Z' },
	{ type: 'Note', title: 'I notice the sourdough rhythm is the opposite of my work rhythm. It forces patience. You can\'t rush fermentation. Maybe that\'s why I\'m drawn to it right now.', savedAt: '2026-03-08T22:00:00Z' },
	{ type: 'Note', title: 'Saved 47 things this week. In January it was 12/week. The acceleration is back.', savedAt: '2026-03-09T23:00:00Z' },
	{ type: 'Claude conversation', title: 'Am I accelerating again?', context: 'Pattern recognition: the same intake velocity that preceded the December crash', savedAt: '2026-03-10T10:00:00Z' },
	{ type: 'Note', title: '"What could I say to you that would be of value, except that perhaps you seek too much, that as a result of your seeking you cannot find." — Hesse', savedAt: '2026-03-10T23:00:00Z' },
]

const ALL_BATCHES = [
	{ label: 'Batch 1: Exoskeleton — Origin Story (week 1)', data: BATCH_1 },
	{ label: 'Batch 2: Exoskeleton — Malleable Software + User Agency (week 2)', data: BATCH_2 },
	{ label: 'Batch 3: Energy Crash — Burnout + ADHD (weeks 2-3)', data: BATCH_3 },
	{ label: 'Batch 4: Wedding — Values + Venue Research (week 3)', data: BATCH_4 },
	{ label: 'Batch 5: Exoskeleton — Competitor Research + Local-First (week 4)', data: BATCH_5 },
	{ label: 'Batch 6: Wedding — Rings + Aesthetic Deepens (week 5)', data: BATCH_6 },
	{ label: 'Batch 7: Exoskeleton — Rhizome + Calm Tech (week 6)', data: BATCH_7 },
	{ label: 'Batch 8: Cross-Thread Overlap + Sourdough Emerges (week 7)', data: BATCH_8 },
	{ label: 'Batch 9: Sourdough Intensifies + Exoskeleton Continues (week 8)', data: BATCH_9 },
	{ label: 'Batch 10: Wedding Details + Sourdough + Tension Returns (week 9)', data: BATCH_10 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const totalItems = ALL_BATCHES.reduce((sum, b) => sum + b.data.length, 0)
	console.log(`\n=== Eval: Myceliom Brain — AutoSetup + Injection ===`)
	console.log(`Model: ${MODEL}`)
	console.log(`Date: ${new Date().toISOString()}`)
	console.log(`Dataset: ${ALL_BATCHES.length} batches, ${totalItems} total items\n`)

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// STAGE 1: Init
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('STAGE 1: Init (autoSetup: true, no predefined learners)')

	const brain = new Brain({
		prompt: BRAIN_PROMPT,
		model,
		store: new MemoryBrainStore(),
		autoSetup: true,
		learning: {
			store: () => new MemoryStore(),
			understand: {
				thresholds: {
					maxObservations: 3,
					minImportance: 0.2,
				},
			},
		},
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 1,
		},
	})

	// Subscribe to ALL events — raw log everything
	brain.on((event) => {
		const p = event.payload as Record<string, unknown> | undefined

		// Compact event line
		console.log(`  [${elapsed()}s] EVENT: ${event.type} ${JSON.stringify(p ?? {})}`)

		// On synthesize completed — dump understanding of that learner
		if (event.type === 'learner:synthesized' && p?.learnerId) {
			const learnerId = p.learnerId as string
			const learner = brain.getLearner(learnerId) ?? (brain as any).internalLearners.get(learnerId)
			if (learner) {
				learner.getUnderstanding().then((u: unknown) => {
					const text = typeof u === 'string' ? u : JSON.stringify(u, null, 2)
					console.log(`\n  ╔══ UNDERSTANDING after synthesize [${learnerId}] (${text?.length ?? 0} chars) ══╗`)
					console.log(`  ${text?.replace(/\n/g, '\n  ') ?? '(empty)'}`)
					console.log(`  ╚══════════════════════════════════════════════════╝\n`)
				})
			}
		}

		// Track evolution activity for settle detection
		if (
			event.type.startsWith('evolution:') ||
			event.type.startsWith('evaluator:') ||
			event.type === 'learner:init:completed' ||
			event.type === 'brain:learner:added'
		) {
			markEvolutionActivity()
		}
	})

	console.log(`\n  Initializing brain...`)
	await brain.initialize()

	// Log evolution context
	console.log(`\n  Prompt context:`)
	console.log(`  ---`)
	console.log(JSON.stringify((brain as any).state.promptContext, null, 2) ?? '(null)')
	console.log(`  ---`)

	// Dump ALL created learners raw
	const initLearners = brain.getLearners()
	console.log(`\n  Learners after init: ${initLearners.length}`)
	for (const l of initLearners) {
		await dumpLearnerRaw(l, `${l.id} — "${l.name}"`)
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// STAGE 2: Inject
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('STAGE 2: Inject Data')

	for (let i = 0; i < ALL_BATCHES.length; i++) {
		const batch = ALL_BATCHES[i]
		console.log(`\n  ═══════════════════════════════════════════════════════`)
		console.log(`  ${batch.label} (${batch.data.length} items)`)
		console.log(`  ═══════════════════════════════════════════════════════`)

		await brain.inject(batch.data)

		// Wait for evolution to settle
		console.log(`  [${elapsed()}s] Waiting for evolution to settle...`)
		await waitForSettle()
		console.log(`  [${elapsed()}s] Settled.`)

		// Snapshot learner count
		const current = brain.getLearners()
		console.log(`  [${elapsed()}s] Learners: ${current.length} — [${current.map(l => `${l.id}(${l.type})`).join(', ')}]`)
	}

	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	// STAGE 3: Final Dump
	// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

	logger.logSection('STAGE 3: Final Understanding Dump')

	await dumpAllUnderstandings(brain, 'All Learners — Full Understanding')

	const totalElapsed = Date.now() - startTime
	await brain.dispose()
	logger.logSuccess(`Eval complete in ${(totalElapsed / 1000).toFixed(1)}s — ${brain.getLearners().length} final learners`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
