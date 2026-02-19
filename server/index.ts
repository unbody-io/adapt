/**
 * Brain Monitor Server
 *
 * HTTP API + SSE events for testing and monitoring Brain
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { streamSSE } from 'hono/streaming'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Brain } from '../src'
import { parseClaudeSessions, listClaudeProjects, listClaudeSessions } from './lib/claude-parser'
import type { BrainConfig } from '../src/brain/types'

// --- Session Logging ---

const LOGS_DIR = join(process.cwd(), 'server', 'logs')
let currentLogFile: string | null = null

function ensureLogsDir() {
	if (!existsSync(LOGS_DIR)) {
		mkdirSync(LOGS_DIR, { recursive: true })
	}
}

function createSessionLog(): string {
	ensureLogsDir()
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const filename = `session-${timestamp}.txt`
	currentLogFile = join(LOGS_DIR, filename)
	appendToLog(`=== Brain Session Started: ${new Date().toISOString()} ===\n`)
	return currentLogFile
}

function appendToLog(content: string) {
	if (!currentLogFile) return
	try {
		appendFileSync(currentLogFile, content + '\n')
	} catch (err) {
		console.error('[Log] Failed to write:', err)
	}
}

function logConfig(config: BrainConfig) {
	appendToLog('\n--- CONFIGURATION ---')
	appendToLog(`Prompt: ${config.prompt}`)
	appendToLog(`Model: ${config.model}`)
	appendToLog('---\n')
}

function logEvent(event: string, data: unknown) {
	const timestamp = new Date().toISOString()

	// Log interesting events with details
	if (event === 'brain:init:config:generated') {
		const d = data as { configs: Array<{ id: string; instructions: string }> }
		appendToLog(`[${timestamp}] LEARNERS GENERATED:`)
		d.configs.forEach(c => {
			appendToLog(`  - ${c.id}: ${c.instructions.slice(0, 100)}...`)
		})
	} else if (event === 'learner:observed') {
		const d = data as { learnerId: string; output: string; importance: number; bufferCount: number }
		appendToLog(`[${timestamp}] OBSERVED [${d.learnerId}] importance=${d.importance.toFixed(2)} buffer=${d.bufferCount}`)
		appendToLog(`  ${d.output.slice(0, 200)}${d.output.length > 200 ? '...' : ''}`)
	} else if (event === 'learner:observe:dismissed') {
		const d = data as { learnerId: string }
		appendToLog(`[${timestamp}] DISMISSED [${d.learnerId}]`)
	} else if (event === 'learner:synthesized') {
		const d = data as { learnerId: string; significance: string; evolution: string; newUnderstanding: string }
		appendToLog(`[${timestamp}] SYNTHESIZED [${d.learnerId}] significance=${d.significance}`)
		appendToLog(`  Evolution: ${d.evolution}`)
		appendToLog(`  Understanding (${d.newUnderstanding.length} chars):`)
		appendToLog(`  ${d.newUnderstanding.slice(0, 500)}${d.newUnderstanding.length > 500 ? '...' : ''}`)
	} else if (event === 'brain:ask:completed') {
		const d = data as { insight: string; gaps: string[] }
		appendToLog(`[${timestamp}] QUERY RESPONSE:`)
		appendToLog(`  ${d.insight.slice(0, 300)}${d.insight.length > 300 ? '...' : ''}`)
		if (d.gaps.length > 0) {
			appendToLog(`  Gaps: ${d.gaps.join(', ')}`)
		}
	}
}

// --- Config Logging Helpers ---

function getModelId(model: LanguageModel | undefined): string {
	if (!model) return '(not set)'
	// LanguageModel objects have modelId at runtime; the type union may include string literals
	const m = model as unknown as { modelId?: string }
	return m.modelId || String(model) || '(unknown)'
}

function getBrainConfigSnapshot(b: Brain) {
	const c = b.config
	// Read learner-level config from first learner (representative sample)
	const firstLearner = b.getLearners()[0]
	const learnerConfig = firstLearner ? {
		thresholds: firstLearner.getSynthesizeThresholds(),
		queryMethod: firstLearner.getQueryMethodName(),
		governance: firstLearner.getGovernance(),
	} : null
	return {
		prompt: b.prompt.slice(0, 120) + (b.prompt.length > 120 ? '...' : ''),
		models: {
			default: getModelId(c.model),
			blueprint: getModelId(c.blueprintModel),
			init: getModelId(c.init.model),
			query: getModelId(c.query.model),
		},
		evolution: c.evolution,
		learnerConfig,
	}
}

function logBrainConfig(label: string, b: Brain) {
	const snap = getBrainConfigSnapshot(b)
	console.log(`\n===== ${label} =====`)
	console.log(JSON.stringify(snap, null, 2))
	console.log('='.repeat(label.length + 12) + '\n')
	appendToLog(`\n===== ${label} =====`)
	appendToLog(JSON.stringify(snap, null, 2))
	appendToLog('='.repeat(label.length + 12) + '\n')
}

// --- Helpers ---

/**
 * Extract full error message including nested causes and API error details
 */
function extractErrorMessage(error: unknown): string {
	if (!error) return 'Unknown error'

	const messages: string[] = []

	// Get main message
	if (error instanceof Error) {
		messages.push(error.message)

		// Check for cause chain
		let cause = error.cause
		while (cause) {
			if (cause instanceof Error) {
				messages.push(`Caused by: ${cause.message}`)
				cause = cause.cause
			} else if (typeof cause === 'object' && cause !== null) {
				// API errors often have data/error properties
				const causeObj = cause as Record<string, unknown>
				if (causeObj.error) {
					messages.push(`API error: ${JSON.stringify(causeObj.error)}`)
				} else if (causeObj.message) {
					messages.push(`Caused by: ${causeObj.message}`)
				} else {
					messages.push(`Details: ${JSON.stringify(cause)}`)
				}
				break
			} else {
				messages.push(`Caused by: ${String(cause)}`)
				break
			}
		}

		// Check for data property (common in API errors)
		const errorObj = error as Record<string, unknown>
		if (errorObj.data && typeof errorObj.data === 'object') {
			messages.push(`Data: ${JSON.stringify(errorObj.data)}`)
		}
		if (errorObj.responseBody) {
			messages.push(`Response: ${JSON.stringify(errorObj.responseBody)}`)
		}
	} else if (typeof error === 'object') {
		messages.push(JSON.stringify(error))
	} else {
		messages.push(String(error))
	}

	return messages.join(' | ')
}

// --- Types ---

interface InitRequest {
	prompt: string
	model?: string
	blueprintModel?: string
	observeModel?: string
	observeBlueprintModel?: string
	synthesizeModel?: string
	synthesizeBlueprintModel?: string
	batchSize?: number
	strategy?: 'continuous' | 'cumulative' | 'decay'
	maxObservations?: number
	minImportance?: number
	queryMethod?: 'direct' | 'tool-based'
	governanceMaxTokens?: number
	evolution?: {
		enabled?: boolean
		autoEvaluate?: boolean
		evaluatorSignalThreshold?: number
	}
}

interface InjectRequest {
	sessionIds?: string[]
	projectPath?: string
	data?: unknown[]
	userMessagesOnly?: boolean
}

interface AskRequest {
	query: string
	model?: string
	temperature?: number
	maxOutputTokens?: number
}

// --- State ---

let brain: Brain | null = null
let sseClients: Set<(event: string, data: unknown) => void> = new Set()

// --- App ---

const app = new Hono()

// Middleware
app.use('*', cors())

// Serve static files from public/
app.use('/ui/*', serveStatic({ root: './server/public', rewriteRequestPath: (path) => path.replace('/ui', '') }))

// --- SSE Events ---

app.get('/brain/events', (c) => {
	return streamSSE(c, async (stream) => {
		const send = (event: string, data: unknown) => {
			try {
				stream.writeSSE({ event, data: JSON.stringify(data) })
			} catch {
				// Stream closed
			}
		}

		sseClients.add(send)
		console.log(`[SSE] Client connected (${sseClients.size} total)`)

		// Keep alive every 5 seconds (must be less than idleTimeout)
		const keepAlive = setInterval(() => {
			try {
				stream.writeSSE({ event: 'ping', data: '' })
			} catch {
				// Stream closed, will be cleaned up
			}
		}, 5000)

		// Wait for disconnect
		try {
			while (true) {
				await stream.sleep(1000)
			}
		} finally {
			clearInterval(keepAlive)
			sseClients.delete(send)
			console.log(`[SSE] Client disconnected (${sseClients.size} remaining)`)
		}
	})
})

function broadcast(event: string, data: unknown) {
	// Log full error details for error events
	if (event.includes('error') || event.includes('failed')) {
		console.error(`[Event] ${event}`, JSON.stringify(data, null, 2).slice(0, 500))
	} else {
		console.log(`[Event] ${event}`, JSON.stringify(data).slice(0, 100))
	}

	// Log which model is configured for phase-related events
	if (brain && (
		event === 'learner:observe:started' ||
		event === 'learner:synthesize:started' ||
		event === 'learner:query:started'
	)) {
		const c = brain.config
		const phase = event.includes('observe') ? 'observe' : event.includes('synthesize') ? 'synthesize' : 'query'
		const d = data as { learnerId?: string }
		console.log(`  >> [MODEL] ${phase} for ${d.learnerId || '?'} (brain default: ${getModelId(c.model)})`)
		appendToLog(`  >> [MODEL] ${phase} for ${d.learnerId || '?'} (brain default: ${getModelId(c.model)})`)
	}

	// Log config update events
	if (event === 'brain:config:updated') {
		console.log(`  >> [CONFIG CHANGED]`, JSON.stringify(data, null, 2).slice(0, 500))
		appendToLog(`  >> [CONFIG CHANGED] ${JSON.stringify(data, null, 2).slice(0, 500)}`)
	}

	logEvent(event, data) // Write to session log file
	for (const send of sseClients) {
		try {
			send(event, data)
		} catch {
			// Client disconnected
		}
	}
}

// --- Brain Endpoints ---

app.post('/brain/init', async (c) => {
	const body = await c.req.json<InitRequest>()

	if (!body.prompt) {
		return c.json({ error: 'prompt is required' }, 400)
	}

	const openrouter = createOpenRouter({
		apiKey: process.env.OPENROUTER_API_KEY,
	})

	const primaryModel = openrouter(body.model || 'anthropic/claude-sonnet-4')
	const blueprintModel = body.blueprintModel ? openrouter(body.blueprintModel) : undefined
	const observeModel = body.observeModel ? openrouter(body.observeModel) : undefined
	const observeBlueprintModel = body.observeBlueprintModel ? openrouter(body.observeBlueprintModel) : undefined
	const synthesizeModel = body.synthesizeModel ? openrouter(body.synthesizeModel) : undefined
	const synthesizeBlueprintModel = body.synthesizeBlueprintModel ? openrouter(body.synthesizeBlueprintModel) : undefined

	const config: BrainConfig = {
		prompt: body.prompt,
		model: primaryModel,
		blueprintModel,
		ingest: {
			batchSize: body.batchSize || 20,
		},
		learning: {
			observe: {
				model: observeModel,
				blueprintModel: observeBlueprintModel,
			},
			synthesize: {
				model: synthesizeModel,
				blueprintModel: synthesizeBlueprintModel,
				thresholds: {
					maxObservations: body.maxObservations,
					minImportance: body.minImportance,
				},
			},
			governance: {
				strategy: body.strategy,
				...(body.governanceMaxTokens ? { maxTokens: body.governanceMaxTokens } : {}),
			},
			query: {
				method: body.queryMethod,
			},
		},
		...(body.evolution ? { evolution: body.evolution } : {}),
	}

	// Start session log
	createSessionLog()
	logConfig(config)

	brain = new Brain(config)

	// Forward all events to SSE clients
	brain.on((event) => {
		broadcast(event.type, event.payload)
	})

	broadcast('server:brain:creating', { prompt: body.prompt })

	try {
		await brain.initialize()
		logBrainConfig('BRAIN INITIALIZED', brain)

		const learners = brain.getLearners().map((l) => ({
			id: l.id,
			instructions: l.instructions,
		}))

		broadcast('server:brain:ready', { learners })

		return c.json({
			status: 'initialized',
			learners,
		})
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Init Error]', error)
		broadcast('server:brain:error', { error: message })
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/inject', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<InjectRequest>()

	let data: unknown[] = []

	// If sessionIds provided, parse Claude sessions
	if (body.sessionIds && body.sessionIds.length > 0) {
		broadcast('server:parsing:started', { sessionIds: body.sessionIds })

		const messages = await parseClaudeSessions(body.sessionIds, {
			userMessagesOnly: body.userMessagesOnly ?? true,
			projectPath: body.projectPath,
		})

		data = messages
		broadcast('server:parsing:completed', { messageCount: messages.length })
	} else if (body.data) {
		data = Array.isArray(body.data) ? body.data : [body.data]
	} else {
		return c.json({ error: 'Either sessionIds or data is required' }, 400)
	}

	broadcast('server:inject:started', { itemCount: data.length })

	try {
		const result = await brain.inject(data)
		broadcast('server:inject:completed', { result })
		return c.json(result)
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Inject Error]', error)
		broadcast('server:inject:error', { error: message })
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/ask', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<AskRequest>()

	if (!body.query) {
		return c.json({ error: 'query is required' }, 400)
	}

	broadcast('server:ask:started', { query: body.query })

	try {
		// Build options from request
		const options: { model?: LanguageModel; temperature?: number; maxOutputTokens?: number } = {}

		if (body.model) {
			const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
			options.model = openrouter(body.model)
		}
		if (body.temperature !== undefined) options.temperature = body.temperature
		if (body.maxOutputTokens !== undefined) options.maxOutputTokens = body.maxOutputTokens

		const result = await brain.ask(body.query, Object.keys(options).length > 0 ? options : undefined)
		broadcast('server:ask:completed', { result })
		return c.json(result)
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Ask Error]', error)
		broadcast('server:ask:error', { error: message })
		return c.json({ error: message }, 500)
	}
})

app.get('/brain/status', (c) => {
	if (!brain) {
		return c.json({ status: 'not_initialized' })
	}

	const learners = brain.getLearners().map((l) => ({
		id: l.id,
		name: l.name,
		description: l.description,
		instructions: l.instructions,
		understanding: l.getUnderstanding(),
		evolution: l.getEvolution(),
		buffer: l.getBufferState(),
		bufferObservations: l.getBufferedObservations(),
		health: l.getHealth(),
		governance: l.getGovernance(),
		synthesizeThresholds: l.getSynthesizeThresholds(),
		observePrompt: l.getObserveSystemPrompt(),
		synthesizePrompt: l.getSynthesizeSystemPrompt(),
		queryMethod: l.getQueryMethodName(),
	}))

	return c.json({
		status: 'initialized',
		prompt: brain.prompt,
		evolution: brain.config.evolution,
		learners,
	})
})

// --- Brain Update Endpoint ---

app.post('/brain/update', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{
		prompt?: string
		model?: string
		blueprintModel?: string
		init?: { model?: string }
		query?: { model?: string }
		ingest?: { batchSize?: number }
		learning?: {
			model?: string
			blueprintModel?: string
			instructions?: string
			name?: string
			description?: string
			observe?: { model?: string; blueprintModel?: string }
			synthesize?: {
				model?: string
				blueprintModel?: string
				thresholds?: { maxObservations?: number; maxTokens?: number; minImportance?: number }
			}
			query?: { model?: string; method?: 'tool-based' | 'direct' }
			governance?: { strategy?: 'continuous' | 'cumulative' | 'decay'; maxTokens?: number }
		}
		evolution?: {
			enabled?: boolean
			evaluatorSignalThreshold?: number
			autoEvaluate?: boolean
		}
	}>()

	const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

	// Build the updates object, converting string model IDs to LanguageModel instances
	const updates: Parameters<typeof brain.update>[0] = {}
	if (body.prompt !== undefined) updates.prompt = body.prompt
	if (body.model) updates.model = openrouter(body.model)
	if (body.blueprintModel) updates.blueprintModel = openrouter(body.blueprintModel)
	if (body.init?.model) updates.init = { model: openrouter(body.init.model) }
	if (body.query?.model) updates.query = { model: openrouter(body.query.model) }
	if (body.ingest) updates.ingest = body.ingest
	if (body.learning) {
		updates.learning = {
			...(body.learning.model ? { model: openrouter(body.learning.model) } : {}),
			...(body.learning.blueprintModel ? { blueprintModel: openrouter(body.learning.blueprintModel) } : {}),
			...(body.learning.instructions ? { instructions: body.learning.instructions } : {}),
			...(body.learning.name ? { name: body.learning.name } : {}),
			...(body.learning.description ? { description: body.learning.description } : {}),
			...(body.learning.observe ? {
				observe: {
					...(body.learning.observe.model ? { model: openrouter(body.learning.observe.model) } : {}),
					...(body.learning.observe.blueprintModel ? { blueprintModel: openrouter(body.learning.observe.blueprintModel) } : {}),
				},
			} : {}),
			...(body.learning.synthesize ? {
				synthesize: {
					...(body.learning.synthesize.model ? { model: openrouter(body.learning.synthesize.model) } : {}),
					...(body.learning.synthesize.blueprintModel ? { blueprintModel: openrouter(body.learning.synthesize.blueprintModel) } : {}),
					...(body.learning.synthesize.thresholds ? { thresholds: body.learning.synthesize.thresholds } : {}),
				},
			} : {}),
			...(body.learning.query ? {
				query: {
					...(body.learning.query.model ? { model: openrouter(body.learning.query.model) } : {}),
					...(body.learning.query.method ? { method: body.learning.query.method } : {}),
				},
			} : {}),
			...(body.learning.governance ? { governance: body.learning.governance } : {}),
		}
	}
	if (body.evolution) updates.evolution = body.evolution

	try {
		logBrainConfig('BEFORE brain.update()', brain)
		const result = await brain.update(updates)
		logBrainConfig('AFTER brain.update()', brain)
		broadcast('server:brain:updated', { updates: { ...body }, changedFields: result.changedFields })
		return c.json(result)
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Update Error]', error)
		return c.json({ error: message }, 500)
	}
})

// --- Per-Learner Update Endpoint ---

app.post('/brain/learners/:id/update', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const learnerId = c.req.param('id')
	const learner = brain.getLearner(learnerId)
	if (!learner) {
		return c.json({ error: `Learner ${learnerId} not found` }, 404)
	}

	const body = await c.req.json<{
		name?: string
		description?: string
		instructions?: string
		model?: string
		observe?: { model?: string }
		synthesize?: { model?: string; thresholds?: { maxObservations?: number; minImportance?: number } }
		query?: { method?: 'tool-based' | 'direct' }
		governance?: Record<string, unknown>
		health?: { signalThresholds?: { maxDismissalRate?: number; minConfidence?: number; maxObservationsWithoutSynthesis?: number } }
	}>()

	const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

	const updates: Record<string, unknown> = {}
	if (body.name !== undefined) updates.name = body.name
	if (body.description !== undefined) updates.description = body.description
	if (body.instructions !== undefined) updates.instructions = body.instructions
	if (body.model) updates.model = openrouter(body.model)
	if (body.observe?.model) updates.observe = { model: openrouter(body.observe.model) }
	if (body.synthesize) {
		updates.synthesize = {
			...(body.synthesize.model ? { model: openrouter(body.synthesize.model) } : {}),
			...(body.synthesize.thresholds ? { thresholds: body.synthesize.thresholds } : {}),
		}
	}
	if (body.query) updates.query = body.query
	if (body.governance) updates.governance = body.governance
	if (body.health) updates.health = body.health

	try {
		const result = await learner.update(updates)
		broadcast('server:learner:updated', { learnerId, changedFields: result.changedFields })
		return c.json({ changedFields: result.changedFields })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Learner Update Error]', error)
		return c.json({ error: message }, 500)
	}
})

// --- Evolution Endpoints ---

app.post('/brain/signal', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ source: string; description: string }>()
	if (!body.source || !body.description) {
		return c.json({ error: 'source and description are required' }, 400)
	}

	brain.signal({ source: body.source, description: body.description })
	return c.json({ ok: true })
})

app.post('/brain/evaluate', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	broadcast('server:evaluate:started', {})

	try {
		const { decisions, results } = await brain.evaluateEvolution()
		broadcast('server:evaluate:completed', { decisionCount: decisions.length, results })
		return c.json({ decisions, results })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Evaluate Error]', error)
		broadcast('server:evaluate:error', { error: message })
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/learners/create', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{
		name: string
		instructions: string
		description?: string
	}>()

	if (!body.name || !body.instructions) {
		return c.json({ error: 'name and instructions are required' }, 400)
	}

	try {
		const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
		const learner = await brain.createLearnerFromConfig({
			id,
			name: body.name,
			instructions: body.instructions,
			description: body.description,
		})
		broadcast('server:learner:created', { learnerId: learner.id, name: body.name })
		return c.json({ learnerId: learner.id })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Learner Create Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/evolve/create', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ guidance: string }>()
	if (!body.guidance) {
		return c.json({ error: 'guidance is required' }, 400)
	}

	try {
		const learner = await brain.createLearner(body.guidance)
		return c.json({ learnerId: learner.id })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Create Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/evolve/merge', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ learnerIds: string[]; guidance: string }>()
	if (!body.learnerIds?.length || !body.guidance) {
		return c.json({ error: 'learnerIds and guidance are required' }, 400)
	}

	try {
		const learner = await brain.mergeLearners(body.learnerIds, body.guidance)
		return c.json({ learnerId: learner.id })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Merge Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/evolve/split', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ learnerId: string; guidance: string }>()
	if (!body.learnerId || !body.guidance) {
		return c.json({ error: 'learnerId and guidance are required' }, 400)
	}

	try {
		const learners = await brain.splitLearner(body.learnerId, body.guidance)
		return c.json({ learnerIds: learners.map(l => l.id) })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Split Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/evolve/update', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ learnerId: string; guidance: string }>()
	if (!body.learnerId || !body.guidance) {
		return c.json({ error: 'learnerId and guidance are required' }, 400)
	}

	try {
		const learner = await brain.updateLearner(body.learnerId, body.guidance)
		return c.json({ learnerId: learner.id })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Update Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/evolve/delete', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const body = await c.req.json<{ learnerId: string }>()
	if (!body.learnerId) {
		return c.json({ error: 'learnerId is required' }, 400)
	}

	try {
		await brain.deleteLearner(body.learnerId)
		return c.json({ ok: true })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Brain Delete Error]', error)
		return c.json({ error: message }, 500)
	}
})

// --- Learner Action Endpoints ---

app.post('/brain/learners/:id/synthesize', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const learnerId = c.req.param('id')
	const learner = brain.getLearner(learnerId)
	if (!learner) {
		return c.json({ error: `Learner ${learnerId} not found` }, 404)
	}

	try {
		const result = await learner.learn([], { forceSynthesize: true })
		return c.json({ ok: true, result })
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Force Synthesis Error]', error)
		return c.json({ error: message }, 500)
	}
})

app.post('/brain/learners/:id/query', async (c) => {
	if (!brain) {
		return c.json({ error: 'Brain not initialized. Call /brain/init first.' }, 400)
	}

	const learnerId = c.req.param('id')
	const learner = brain.getLearner(learnerId)
	if (!learner) {
		return c.json({ error: `Learner ${learnerId} not found` }, 404)
	}

	const body = await c.req.json<{ query: string }>()
	if (!body.query) {
		return c.json({ error: 'query is required' }, 400)
	}

	try {
		const result = await learner.query(body.query)
		return c.json(result)
	} catch (error) {
		const message = extractErrorMessage(error)
		console.error('[Learner Query Error]', error)
		return c.json({ error: message }, 500)
	}
})

// --- Claude Session Endpoints ---

app.get('/claude/projects', async (c) => {
	const projects = await listClaudeProjects()
	return c.json(projects)
})

app.get('/claude/sessions', async (c) => {
	const projectPath = c.req.query('project')
	if (!projectPath) {
		return c.json({ error: 'project query param required' }, 400)
	}

	const sessions = await listClaudeSessions(projectPath)
	return c.json(sessions)
})

// --- Root redirect ---

app.get('/', (c) => c.redirect('/ui/'))

// --- Start Server ---

const port = Number(process.env.PORT) || 3210

console.log(`
Brain Monitor Server
====================
UI:     http://localhost:${port}/ui/
API:    http://localhost:${port}/brain/*
Events: http://localhost:${port}/brain/events (SSE)
`)

export default {
	port,
	fetch: app.fetch,
	idleTimeout: 120, // 2 minutes - keep SSE connections alive longer
}
