import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Brain } from '../../src'
import { SQLiteStore } from '../../src/learners/stores/sqlite'
import { SQLiteBrainStore } from '../../src/brain/stores/sqlite'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3211)
const DB_PATH = join(__dirname, 'data/myceliom')
const FED_PATH = join(__dirname, 'data/fed-items.json')
const TOPIC_TRACKER_ID = 'topic-tracker'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const model = openrouter('google/gemini-2.5-flash')
const blueprintModel = openrouter('anthropic/claude-sonnet-4.5')

// ---------------------------------------------------------------------------
// Fed items tracking
// ---------------------------------------------------------------------------
function loadFedIds(): Set<string> {
	try {
		if (existsSync(FED_PATH)) {
			return new Set(JSON.parse(readFileSync(FED_PATH, 'utf-8')))
		}
	} catch { /* ignore */ }
	return new Set()
}

function saveFedIds(ids: Set<string>) {
	mkdirSync(dirname(FED_PATH), { recursive: true })
	writeFileSync(FED_PATH, JSON.stringify([...ids]))
}

const fedIds = loadFedIds()

// ---------------------------------------------------------------------------
// Data pool — ~50 items across 5 themes
// ---------------------------------------------------------------------------
interface PoolItem {
	id: string
	type: string
	title: string
	context: string
	source?: string
	savedAt: string
}

const DATA_POOL: PoolItem[] = [
	// Theme 1: Building tools for thought (~15 items, steady throughout)
	{ id: 't1-01', type: 'Article', title: 'The case for personal software that molds to how you think', context: 'A long essay on why rigid productivity apps fail creative workers — argues for interfaces that adapt to individual cognitive styles rather than enforcing a workflow.', savedAt: '2025-12-05' },
	{ id: 't1-02', type: 'Bookmark', title: 'Notational velocity and the speed of retrieval', context: 'Classic piece on how reducing friction in capture changes what people choose to remember externally. The faster you can get something out of your head, the more you trust the system.', savedAt: '2025-12-08' },
	{ id: 't1-03', type: 'Claude conversation', title: 'Designing a system that reads your attention patterns', context: 'Long conversation about building something that watches what you save and tells you what you care about — without tags or folders.', savedAt: '2025-12-12' },
	{ id: 't1-04', type: 'Repository', title: 'tldraw — infinite canvas as a thinking medium', context: 'Open-source spatial computing canvas. Interesting how freeform spatial arrangement reveals relationships that lists hide.', savedAt: '2025-12-18' },
	{ id: 't1-05', type: 'Note', title: 'What if the filing cabinet was never the right metaphor?', context: 'Personal reflection on why hierarchical organization fails for creative work. The brain doesn\'t file — it associates. Systems should do the same.', savedAt: '2025-12-22' },
	{ id: 't1-06', type: 'Article', title: 'Augmenting human intellect: a conceptual framework', context: 'Engelbart\'s original vision — not about making computers smarter but about amplifying human capability. The distinction matters for how you design.', savedAt: '2026-01-03' },
	{ id: 't1-07', type: 'Bookmark', title: 'A reading environment that compounds understanding', context: 'Tool that highlights connections between what you\'re reading now and everything you\'ve read before. Serendipity by design.', savedAt: '2026-01-09' },
	{ id: 't1-08', type: 'Claude conversation', title: 'Can a machine notice what you\'re avoiding?', context: 'Exploring whether absence patterns in saved content reveal as much as presence patterns. What you don\'t save might be what you\'re resisting.', savedAt: '2026-01-15' },
	{ id: 't1-09', type: 'WebPage', title: 'The garden and the stream: a technopastoral', context: 'Mike Caulfield\'s distinction between gardens (curated, evolving) and streams (chronological, ephemeral). Most tools optimize for streams.', savedAt: '2026-01-20' },
	{ id: 't1-10', type: 'Product', title: 'Kosmik — visual workspace for connecting documents', context: 'Spatial canvas that lets you arrange PDFs, images, notes on an infinite board. The spatial proximity becomes the organization.', savedAt: '2026-01-28' },
	{ id: 't1-11', type: 'Note', title: 'The capture gap: why most ideas die between thought and record', context: 'Every second of friction between having an idea and recording it increases the chance the idea is lost. Speed of capture is the most underrated feature.', savedAt: '2026-02-04' },
	{ id: 't1-12', type: 'Article', title: 'Memory prosthetics for the easily distracted', context: 'Research on external memory aids for ADHD — the most effective ones are ambient and passive, not demanding active organization.', savedAt: '2026-02-10' },
	{ id: 't1-13', type: 'Repository', title: 'Fermat — computational notebook rethinking the document', context: 'Blurs the line between writing and computing. Documents that can reason about their own content.', savedAt: '2026-02-18' },
	{ id: 't1-14', type: 'Claude conversation', title: 'Why bookmarking apps always fail', context: 'Conversation analyzing the graveyard of read-it-later apps. The pattern: capture is easy, retrieval is hard, and no one goes back.', savedAt: '2026-02-22' },
	{ id: 't1-15', type: 'Bookmark', title: 'Programmable attention and the economics of focus', context: 'Essay arguing that attention management is the meta-skill — every productivity system is really an attention allocation system in disguise.', savedAt: '2026-02-28' },

	// Theme 2: Wedding planning (~10 items, steady but quieter)
	{ id: 't2-01', type: 'Image', title: 'Dried floral arch — earthy ceremony backdrop', context: 'Warm-toned installation using pampas grass, dried lunaria, and raw linen draping. Natural, imperfect, grounded.', savedAt: '2025-12-10' },
	{ id: 't2-02', type: 'Note', title: 'We want something that feels like a long dinner with friends', context: 'Not a performance. No stage. Just a beautiful space where the people we love can eat together. Intimacy over spectacle.', savedAt: '2025-12-20' },
	{ id: 't2-03', type: 'Product', title: 'Handmade ceramic tableware — irregular glazed set', context: 'Each piece slightly different. Wabi-sabi aesthetic. Stoneware with reactive glaze that pools in the grooves.', savedAt: '2026-01-05' },
	{ id: 't2-04', type: 'WebPage', title: 'Small venue in the hills — stone farmhouse with olive grove', context: 'Seats 60. Kitchen garden they cook from. The chef forages local herbs. Fifteen minutes from the nearest town.', savedAt: '2026-01-12' },
	{ id: 't2-05', type: 'Claude conversation', title: 'How to write vows that don\'t sound like vows', context: 'Working through the discomfort of sincerity. How to say something real without it feeling rehearsed or performative.', savedAt: '2026-01-22' },
	{ id: 't2-06', type: 'Image', title: 'Linen suit — unstructured, sand-colored', context: 'Relaxed Mediterranean tailoring. No tie, no rigid shoulders. Looks like someone who belongs outdoors.', savedAt: '2026-02-01' },
	{ id: 't2-07', type: 'Bookmark', title: 'A photographer who shoots in available light only', context: 'Documentary style — no posed shots, no flash. Captures what actually happened rather than what was staged. The candid frames are the best ones.', savedAt: '2026-02-08' },
	{ id: 't2-08', type: 'Product', title: 'Sculptural silver band — organic molten texture', context: 'Handcast. Looks like liquid metal frozen mid-flow. No gemstones, no symmetry, just form.', savedAt: '2026-02-14' },
	{ id: 't2-09', type: 'Note', title: 'Music: no DJ, just a playlist we build together', context: 'Curate it over months. Each song is a memory or an inside joke. The playlist becomes an artifact of the relationship.', savedAt: '2026-02-20' },
	{ id: 't2-10', type: 'WebPage', title: 'Sustainable floristry — seasonal and locally foraged', context: 'A florist who only works with what\'s growing within 30 miles. No imported roses. The arrangements look like they were picked from a meadow.', savedAt: '2026-02-26' },

	// Theme 3: Energy/recovery (~5 items, active month 1 then silent)
	{ id: 't3-01', type: 'Article', title: 'The cost of pushing through when your body says stop', context: 'Research on allostatic load — the cumulative wear of chronic stress. Recovery isn\'t rest, it\'s the biological process of restoring baseline capacity.', savedAt: '2025-12-06' },
	{ id: 't3-02', type: 'Claude conversation', title: 'Recognizing the acceleration pattern before collapse', context: 'Mapping out personal warning signs: increased output velocity, shorter sleep, skipping meals, feeling "locked in" — the high before the crash.', savedAt: '2025-12-14' },
	{ id: 't3-03', type: 'Note', title: 'I keep building when I should be resting and I know it', context: 'Honest journaling about the compulsion to produce. The guilt of doing nothing. The fear that stopping means losing momentum permanently.', savedAt: '2025-12-21' },
	{ id: 't3-04', type: 'Bookmark', title: 'Pacing strategies for attention-driven minds', context: 'ADHD-specific energy management. The key insight: hyperfocus isn\'t free — it borrows from tomorrow\'s energy. You always pay later.', savedAt: '2025-12-28' },
	{ id: 't3-05', type: 'Article', title: 'Why ambitious people burn out in predictable cycles', context: 'Pattern analysis of high-achiever burnout: the cycle is excitement → overcommitment → depletion → shame → withdrawal → slow rebuild → excitement again.', savedAt: '2026-01-02' },

	// Theme 4: Local-first tech (~8 items, burst in month 2-3)
	{ id: 't4-01', type: 'Article', title: 'Collaborative editing without a central server', context: 'Deep dive into how documents can stay in sync across devices without any coordinator. Each copy is equally authoritative — conflicts resolve automatically.', savedAt: '2026-01-18' },
	{ id: 't4-02', type: 'Repository', title: 'cr-sqlite — merging database replicas like git branches', context: 'Extension that makes relational databases mergeable. Each device maintains its own copy. Changes converge without coordination.', savedAt: '2026-01-25' },
	{ id: 't4-03', type: 'Claude conversation', title: 'What if your app worked the same offline and online?', context: 'Exploring the UX implications of software that never shows a loading spinner. Data is always local, sync is invisible background process.', savedAt: '2026-02-02' },
	{ id: 't4-04', type: 'Article', title: 'The distributed state problem and why it matters for personal tools', context: 'If your data lives on someone else\'s server, you don\'t own your tools. You rent them. The technical architecture determines the power relationship.', savedAt: '2026-02-08' },
	{ id: 't4-05', type: 'WebPage', title: 'Embedded databases are eating application architecture', context: 'How putting the database inside the app (rather than behind an API) changes everything: latency drops to microseconds, deployments simplify, offline works.', savedAt: '2026-02-13' },
	{ id: 't4-06', type: 'Repository', title: 'Automerge — data structures that resolve conflicts by design', context: 'Library for building applications where multiple users can edit the same data simultaneously without locks, transactions, or consensus protocols.', savedAt: '2026-02-19' },
	{ id: 't4-07', type: 'Note', title: 'Sync should be like plumbing: invisible and reliable', context: 'The best sync engine is one you never think about. It should feel like the data is simply everywhere, not that it\'s being moved between places.', savedAt: '2026-02-23' },
	{ id: 't4-08', type: 'Bookmark', title: 'Why the next wave of productivity tools will run on your device', context: 'Market analysis arguing that the cloud-first era is ending for personal software. Privacy, speed, and ownership are driving the shift back to local computation.', savedAt: '2026-02-27' },

	// Theme 5: Misc outliers (~5 items, scattered)
	{ id: 't5-01', type: 'Bookmark', title: '"You must change your life" — Rilke on encountering beauty', context: 'The archaic torso of Apollo poem and its abrupt ending. How encountering something genuinely beautiful creates an obligation to respond.', savedAt: '2025-12-15' },
	{ id: 't5-02', type: 'Note', title: 'Sourdough focaccia with rosemary from the garden', context: 'Recipe: 80% hydration, overnight cold ferment, dimpled with olive oil pools, topped with flaky salt and fresh rosemary. The crumb should be open and irregular.', savedAt: '2026-01-10' },
	{ id: 't5-03', type: 'Article', title: 'Walking the Kumano Kodo pilgrimage trail', context: 'Travel essay about ancient forest paths in Japan. The trail was built for spiritual transformation, not exercise. Every step is intentionally slowed by the terrain.', savedAt: '2026-01-30' },
	{ id: 't5-04', type: 'Image', title: 'Overhead shot of a ceramics studio in morning light', context: 'Dust particles in the sunbeam. Half-finished bowls on the wheel. Tools laid out with the care of a surgeon. The beauty of process over product.', savedAt: '2026-02-12' },
	{ id: 't5-05', type: 'WebPage', title: 'The paradox of choice in a world of infinite options', context: 'Revisiting Schwartz\'s thesis — more options lead to less satisfaction. The constraint of fewer choices is liberating, not limiting.', savedAt: '2026-02-24' },
]

// ---------------------------------------------------------------------------
// Brain — created lazily, initialized via API
// ---------------------------------------------------------------------------
mkdirSync(join(__dirname, 'data'), { recursive: true })

let brain: Brain | null = null

function createBrain(): Brain {
	const b = new Brain({
		prompt: `You are the memory behind Mycelium, which is my personal memory.
I save things from everywhere — bookmarks, articles, notes, conversations with Claude,
products, images, code repos. I want it to understand what I'm actually paying attention to,
notice when new threads emerge, and help me see patterns I can't see myself.`,

		model,
		blueprintModel,
		autoSetup: true,
		store: new SQLiteBrainStore(DB_PATH),

		learners: [
			{
				id: TOPIC_TRACKER_ID,
				name: 'Topic Tracker',
				type: 'list',
				description: 'Tracks distinct topics and threads of attention across all saved content',
				instructions: `Track every distinct topic or thread of attention that appears in the data.

Watch for:
- New topics emerging from saved content
- Existing topics gaining more depth or shifting focus
- Topics going dormant (no new saves)

Track answers to:
- What are the active threads of attention?
- When did each thread first appear and when was it last seen?
- Which threads are intensifying vs fading?`,
				skipObservation: true,
			},
		],

		learning: {
			store: (learnerId: string) => new SQLiteStore(`${DB_PATH}-learner-${learnerId}`),
		},

		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 3,
			autoEvaluate: true,
		},
	})

	// Forward all brain events to SSE (enrich learner events with type info)
	b.on((event) => {
		if (event.type === 'brain:learner:added') {
			const learner = b.getLearner(event.payload.learnerId)
			broadcast(event.type, {
				...event.payload,
				learnerType: learner?.type ?? '',
				description: learner?.description ?? '',
			})
		} else {
			broadcast(event.type, event.payload)
		}
	})

	return b
}

function requireBrain(): Brain {
	if (!brain) throw new Error('Brain not initialized')
	return brain
}

// ---------------------------------------------------------------------------
// SSE clients
// ---------------------------------------------------------------------------
type SSEClient = (event: string, data: unknown) => void
const sseClients = new Set<SSEClient>()

function broadcast(event: string, data: unknown) {
	for (const send of sseClients) {
		send(event, data)
	}
}

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------
const app = new Hono()
app.use('*', cors())

// Serve static files
app.use('/public/*', serveStatic({ root: join(__dirname) }))
app.get('/', (c) => {
	const html = readFileSync(join(__dirname, 'public/index.html'), 'utf-8')
	return c.html(html)
})

// Brain status — works whether brain is initialized or not
app.get('/api/status', (c) => {
	if (!brain) {
		const hasDb = existsSync(DB_PATH) || existsSync(DB_PATH + '.db')
		return c.json({ initialized: false, canRestore: hasDb })
	}
	const learners = brain.getLearners()
	return c.json({
		initialized: true,
		canRestore: false,
		learnerCount: learners.length,
		learners: learners.map((l) => ({
			id: l.id,
			name: l.name,
			type: l.type,
			description: l.description ?? '',
		})),
	})
})

// Initialize brain (fresh — wipes existing DB)
app.post('/api/brain/init', async (c) => {
	if (brain) {
		await brain.dispose()
		brain = null
	}
	// Clean up existing DB files (brain + per-learner) and fed items
	const dataDir = dirname(DB_PATH)
	const dbBase = DB_PATH.split('/').pop()!
	if (existsSync(dataDir)) {
		for (const file of readdirSync(dataDir)) {
			if (file.startsWith(dbBase)) {
				unlinkSync(join(dataDir, file))
			}
		}
	}
	if (existsSync(FED_PATH)) unlinkSync(FED_PATH)
	fedIds.clear()

	brain = createBrain()
	await brain.initialize()
	const learners = brain.getLearners()
	console.log(`Brain initialized fresh — ${learners.length} learners`)
	return c.json({
		initialized: true,
		learnerCount: learners.length,
		learners: learners.map((l) => ({ id: l.id, name: l.name, type: l.type, description: l.description ?? '' })),
	})
})

// Restore brain from persisted SQLite
app.post('/api/brain/restore', async (c) => {
	if (brain) {
		return c.json({ error: 'Brain already initialized' }, 400)
	}
	brain = createBrain()
	await brain.initialize() // restores from SQLite if state exists
	const learners = brain.getLearners()
	console.log(`Brain restored — ${learners.length} learners`)
	return c.json({
		initialized: true,
		learnerCount: learners.length,
		learners: learners.map((l) => ({ id: l.id, name: l.name, type: l.type, description: l.description ?? '' })),
	})
})

// Destroy brain (stop, but keep DB)
app.post('/api/brain/destroy', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized' }, 400)
	}
	await brain.dispose()
	brain = null
	console.log('Brain destroyed')
	return c.json({ ok: true })
})

// Get threads from topic tracker
app.get('/api/threads', async (c) => {
	const b = requireBrain()
	const topicTracker = b.getLearner(TOPIC_TRACKER_ID)
	if (!topicTracker) {
		return c.json({ threads: [] })
	}
	const understanding = await topicTracker.getUnderstanding()
	return c.json({ threads: understanding ?? [] })
})

// Get data pool with fed status
app.get('/api/pool', (c) => {
	const pool = DATA_POOL.map((item) => ({
		...item,
		fed: fedIds.has(item.id),
	}))
	return c.json({ items: pool })
})

// Save: contextualize → enrich → inject (broadcasts per-item progress via SSE)
app.post('/api/save', async (c) => {
	const b = requireBrain()
	const { ids } = await c.req.json<{ ids: string[] }>()
	const items = DATA_POOL.filter((item) => ids.includes(item.id) && !fedIds.has(item.id))

	if (items.length === 0) {
		return c.json({ error: 'No new items to save' }, 400)
	}

	// Check if topic tracker has knowledge for contextualization
	const topicTracker = b.getLearner(TOPIC_TRACKER_ID)
	const hasTopics = topicTracker ? await topicTracker.hasKnowledge() : false

	// Process items — broadcast progress for each
	const results: Array<{ id: string; title: string; contextualization: unknown }> = []

	for (const item of items) {
		broadcast('save:item:started', { id: item.id, title: item.title, total: items.length, index: results.length })

		let contextualization: { insight: string } | null = null

		if (hasTopics && topicTracker) {
			broadcast('save:item:contextualizing', { id: item.id, title: item.title })
			try {
				const context = await topicTracker.query(
					`What threads does this connect to: "${item.title}" — ${item.context}`
				)
				contextualization = { insight: context.insight }
				broadcast('save:item:contextualized', { id: item.id, title: item.title, insight: context.insight })
			} catch {
				broadcast('save:item:contextualized', { id: item.id, title: item.title, insight: null })
			}
		}

		broadcast('save:item:injecting', { id: item.id, title: item.title })
		await b.inject([{
			...item,
			...(contextualization ? { contextualization: contextualization.insight } : {}),
		}])

		fedIds.add(item.id)
		results.push({ id: item.id, title: item.title, contextualization })
		broadcast('save:item:done', { id: item.id, title: item.title, contextualization })
	}

	saveFedIds(fedIds)
	broadcast('save:batch:done', { count: results.length })
	return c.json({ results })
})

// Ask a question
app.post('/api/ask', async (c) => {
	const b = requireBrain()
	const { question } = await c.req.json<{ question: string }>()
	const result = await b.ask(question)
	return c.json({
		insight: result.insight,
		sources: (result.sources ?? []).map((s) => ({
			learnerId: s.learnerId,
			relevance: s.relevance,
			confidence: s.confidence,
			insight: s.insight,
		})),
		gaps: result.gaps,
	})
})

// Send a correction signal
app.post('/api/correct', async (c) => {
	const b = requireBrain()
	const { feedback } = await c.req.json<{ feedback: string }>()
	b.signal({
		source: 'user-correction',
		description: feedback,
	})
	return c.json({ ok: true })
})

// SSE events
app.get('/api/events', (c) => {
	return streamSSE(c, async (stream) => {
		const send: SSEClient = (event, data) => {
			stream.writeSSE({
				event,
				data: JSON.stringify(data),
			})
		}
		sseClients.add(send)

		stream.onAbort(() => {
			sseClients.delete(send)
		})

		// Keep alive
		while (true) {
			await stream.writeSSE({ event: 'ping', data: '' })
			await stream.sleep(15000)
		}
	})
})

// ---------------------------------------------------------------------------
// Start — server only, brain initialized via API
// ---------------------------------------------------------------------------
serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`Myceliom running at http://localhost:${PORT}`)
	console.log('Brain not initialized — use the UI to init or restore.')
})
