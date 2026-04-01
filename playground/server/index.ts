/**
 * Playground Server
 *
 * Single Brain instance, SSE event streaming, commentator LLM.
 */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { serve } from "@hono/node-server"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import { z } from "zod"
import Database from "better-sqlite3"
import { readFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, statSync } from "node:fs"
import { join } from "node:path"
import { Brain } from "../../src"
import { SQLiteBrainStore } from "../../src/stores/sqlite/brain"
import { SQLiteNeuronStore } from "../../src/stores/sqlite/neuron"
import { generate, Output } from "../../src/llm"
import { Commentator } from "./commentator"
import { writeFileSync } from "node:fs"
import type { UseCaseConfig, UseCaseInfo, BrainConfig, DataSource, SSESender, ProviderType, ModelRef } from "./types"

// --- Use Case Loading ---

const USECASES_DIR = join(import.meta.dirname, "..", "usecases")

function loadUseCaseInfo(useCaseId: string): UseCaseInfo | null {
	const infoPath = join(USECASES_DIR, useCaseId, "usecase.json")
	if (!existsSync(infoPath)) return null
	return JSON.parse(readFileSync(infoPath, "utf-8")) as UseCaseInfo
}

function listVersions(useCaseId: string): string[] {
	const configsDir = join(USECASES_DIR, useCaseId, "configs")
	if (!existsSync(configsDir)) return []
	return readdirSync(configsDir).filter((f) => f.endsWith(".json")).sort().map((f) => f.replace(/\.json$/, ""))
}

function loadBrainConfig(useCaseId: string, version: string): BrainConfig | null {
	const configPath = join(USECASES_DIR, useCaseId, "configs", `${version}.json`)
	if (!existsSync(configPath)) return null
	return JSON.parse(readFileSync(configPath, "utf-8")) as BrainConfig
}

function loadUseCases(): UseCaseConfig[] {
	if (!existsSync(USECASES_DIR)) return []

	return readdirSync(USECASES_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.flatMap((d) => {
			const info = loadUseCaseInfo(d.name)
			if (!info) return []

			const versions = listVersions(d.name)
			if (versions.length === 0) return []

			const defaultVersion = versions.includes("default") ? "default" : versions[0]
			const brainConfig = loadBrainConfig(d.name, defaultVersion)
			if (!brainConfig) return []

			return [{ ...info, ...brainConfig, version: defaultVersion, versions }]
		})
}

function loadUseCase(useCaseId: string, version = "default"): UseCaseConfig | null {
	const info = loadUseCaseInfo(useCaseId)
	if (!info) return null

	const brainConfig = loadBrainConfig(useCaseId, version)
	if (!brainConfig) return null

	const versions = listVersions(useCaseId)
	return { ...info, ...brainConfig, version, versions }
}

function resolveStoragePath(useCaseId: string, version: string, config: { storage?: { path: string } }): string {
	const base = config.storage?.path ?? "storage"
	return join(USECASES_DIR, useCaseId, base, version)
}

interface VersionStatus {
	inited: boolean
	lastInited: string | null
	model: string | null
	provider: string | null
}

function getVersionStatus(useCaseId: string, version: string, config: UseCaseConfig): VersionStatus {
	const storagePath = resolveStoragePath(useCaseId, version, config)
	const brainDb = join(storagePath, "brain.db")
	if (!existsSync(brainDb)) return { inited: false, lastInited: null, model: null, provider: null }

	const stat = statSync(brainDb)
	let model: string | null = null
	let provider: string | null = null

	try {
		const db = new Database(brainDb, { readonly: true })
		const row = db.prepare("SELECT value FROM state WHERE id = ?").get("models") as { value: string } | undefined
		db.close()
		if (row) {
			const models = JSON.parse(row.value) as Record<string, { provider: string; modelId: string }>
			if (models.default) {
				provider = models.default.provider
				model = models.default.modelId
			}
		}
	} catch {
		// DB might be corrupted or locked — ignore
	}

	return { inited: true, lastInited: stat.mtime.toISOString(), model, provider }
}

function countDataItems(useCaseId: string): number {
	const sources = loadDataSources(useCaseId)
	return sources.reduce((sum, s) => sum + s.items.length, 0)
}

function loadDataSources(useCaseId: string): DataSource[] {
	const dataDir = join(USECASES_DIR, useCaseId, "data")
	if (!existsSync(dataDir)) return []

	return readdirSync(dataDir)
		.filter((f) => f.endsWith(".json"))
		.sort()
		.map((f) => {
			const raw = readFileSync(join(dataDir, f), "utf-8")
			return JSON.parse(raw) as DataSource
		})
}

// --- Model Factory ---

function resolveModelRef(
	slot: string | ModelRef | undefined,
	defaultProvider: ProviderType,
): { provider: ProviderType; model: string } {
	if (!slot) return { provider: defaultProvider, model: "google/gemini-2.5-flash" }
	if (typeof slot === "string") return { provider: defaultProvider, model: slot }
	return { provider: slot.provider ?? defaultProvider, model: slot.model }
}

function createModel(slot?: string | ModelRef, defaultProvider: ProviderType = "openrouter"): LanguageModel {
	const { provider, model } = resolveModelRef(slot, defaultProvider)

	if (provider === "ollama") {
		const ollama = createOpenAICompatible({
			name: "ollama",
			baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
			supportsStructuredOutputs: true,
		})
		return ollama.chatModel(model)
	}

	if (provider === "lmstudio") {
		const lmstudio = createOpenAICompatible({
			name: "lmstudio",
			baseURL: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
			supportsStructuredOutputs: true,
		})
		return lmstudio.chatModel(model)
	}

	const openrouter = createOpenRouter({
		apiKey: process.env.OPENROUTER_API_KEY,
	})
	return openrouter(model)
}

// --- Global State ---

let brain: Brain | null = null
let commentator: Commentator | null = null
let currentUseCaseId: string | null = null
let currentVersion: string | null = null
let status: "idle" | "initializing" | "ready" | "error" = "idle"
const sseClients = new Set<SSESender>()

function broadcast(event: string, data: unknown) {
	console.log(`[Event] ${event}`, JSON.stringify(data).slice(0, 120))

	for (const send of sseClients) {
		try {
			send(event, data)
		} catch {
			// Client disconnected
		}
	}
}

// --- App ---

const app = new Hono()

app.use("*", cors())

// --- Use Case Endpoints ---

app.get("/api/usecases", (c) => {
	const usecases = loadUseCases().map(({ id, title, description, versions }) => {
		const versionList = versions ?? ["default"]
		const itemCount = countDataItems(id)

		const versionDetails = versionList.map((v) => {
			const cfg = loadUseCase(id, v)
			const status = cfg ? getVersionStatus(id, v, cfg) : { inited: false, lastInited: null, model: null, provider: null }
			return {
				name: v,
				provider: status.provider ?? cfg?.provider ?? "openrouter",
				model: status.model ?? cfg?.model ?? null,
				inited: status.inited,
				lastInited: status.lastInited,
			}
		})

		return { id, title, description, versions: versionList, versionDetails, itemCount }
	})
	return c.json(usecases)
})

app.get("/api/usecases/:id", (c) => {
	const id = c.req.param("id")
	const version = (c.req.query("version") ?? "default") as string
	const usecase = loadUseCase(id, version)
	if (!usecase) return c.json({ error: "Use case not found" }, 404)

	const dataSources = loadDataSources(id)
	return c.json({ ...usecase, dataSources })
})

app.post("/api/usecases/:id/versions", async (c) => {
	const id = c.req.param("id")
	const info = loadUseCaseInfo(id)
	if (!info) return c.json({ error: "Use case not found" }, 404)

	const body = await c.req.json<{ name: string; config: BrainConfig }>()
	const name = body.name?.trim()

	if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
		return c.json({ error: "Invalid version name. Use alphanumeric, hyphens, underscores only." }, 400)
	}

	const configsDir = join(USECASES_DIR, id, "configs")
	const configPath = join(configsDir, `${name}.json`)

	if (existsSync(configPath)) {
		return c.json({ error: `Version "${name}" already exists` }, 409)
	}

	mkdirSync(configsDir, { recursive: true })
	writeFileSync(configPath, JSON.stringify(body.config, null, "\t") + "\n")

	return c.json({ ok: true, version: name }, 201)
})

app.delete("/api/usecases/:id/versions/:version", (c) => {
	const id = c.req.param("id")
	const version = c.req.param("version")

	const configPath = join(USECASES_DIR, id, "configs", `${version}.json`)
	if (!existsSync(configPath)) return c.json({ error: "Version not found" }, 404)

	// Wipe storage for this version
	const config = loadBrainConfig(id, version)
	const storagePath = resolveStoragePath(id, version, config ?? {})
	if (existsSync(storagePath)) {
		for (const f of readdirSync(storagePath)) {
			if (f.endsWith(".db") || f.endsWith(".db-wal") || f.endsWith(".db-shm")) {
				unlinkSync(join(storagePath, f))
			}
		}
	}

	// Only delete config file if not the last version
	if (listVersions(id).length > 1) {
		unlinkSync(configPath)
	}

	return c.json({ ok: true })
})

// --- Brain Endpoints ---

app.post("/api/brain/start", async (c) => {
	const body = await c.req.json<{ useCaseId: string; version?: string }>()

	// Destroy previous brain if any
	if (brain) {
		commentator?.detach()
		await brain.dispose()
		brain = null
		commentator = null
	}

	const usecase = loadUseCase(body.useCaseId, body.version ?? "default")
	if (!usecase) return c.json({ error: "Use case not found" }, 404)

	currentUseCaseId = usecase.id
	currentVersion = usecase.version ?? "default"

	const p = usecase.provider ?? "openrouter"
	const model = createModel(usecase.model, p)

	const evolutionConfig = usecase.evolution
		? {
				enabled: usecase.evolution.enabled,
				autoEvaluate: usecase.evolution.autoEvaluate,
				evaluatorSignalThreshold: usecase.evolution.evaluatorSignalThreshold,
				...(usecase.evolution.model
					? { model: createModel(usecase.evolution.model, p) }
					: {}),
			}
		: undefined

	// Resolve storage — always persistent (SQLite)
	const storagePath = resolveStoragePath(usecase.id, currentVersion, usecase)
	mkdirSync(storagePath, { recursive: true })

	brain = new Brain({
		prompt: usecase.prompt,
		model,
		...(usecase.blueprintModel
			? { blueprintModel: createModel(usecase.blueprintModel, p) }
			: {}),
		autoSetup: usecase.autoSetup ?? true,
		...(usecase.neurons ? { neurons: usecase.neurons } : {}),
		store: new SQLiteBrainStore(join(storagePath, "brain.db")),
		learning: {
			...usecase.learning,
			store: (id: string) => new SQLiteNeuronStore(join(storagePath, `neuron-${id}.db`)),
		},
		evolution: evolutionConfig,
		ingest: usecase.ingest,
	})

	// Forward all Brain events to SSE
	brain.on((event) => {
		broadcast(event.type, event.payload)
	})

	// Create and attach commentator
	const commentatorModel = createModel(
		usecase.commentatorModel || process.env.COMMENTATOR_MODEL, p,
	)
	commentator = new Commentator(commentatorModel, broadcast)
	commentator.attach(brain)

	// Check for existing persisted state
	const hasExistingState = (await brain.store.state.get("prompt")) !== undefined

	status = hasExistingState ? "idle" : "initializing"

	return c.json({
		status: "created",
		hasExistingState,
		persistent: true,
	})
})

let initPromise: Promise<unknown> | null = null

app.post("/api/brain/init", async (c) => {
	if (!brain) return c.json({ error: "No brain. Call /api/brain/start first." }, 400)
	if (status === "ready") return c.json({ status: "ready" })

	// Deduplicate: if already initializing, wait for the same promise
	if (initPromise) {
		await initPromise
		return c.json({ status })
	}

	const doInit = async () => {
		await brain!.initialize()
		status = "ready"
		const neurons = brain!.getNeurons().map((l) => ({
			id: l.id,
			name: l.name,
			type: l.type,
			description: l.description,
			instructions: l.instructions,
		}))
		broadcast("brain:ready", { neurons })
		return neurons
	}

	initPromise = doInit()

	try {
		const neurons = await initPromise
		initPromise = null
		return c.json({ status: "ready", neurons })
	} catch (error) {
		initPromise = null
		status = "error"
		const message = error instanceof Error ? error.message : "Unknown error"
		broadcast("brain:error", { error: message })
		return c.json({ error: message }, 500)
	}
})

app.post("/api/brain/reset", async (c) => {
	if (!brain) return c.json({ error: "No brain. Call /api/brain/start first." }, 400)

	// Dispose current brain (closes SQLite connections)
	commentator?.detach()
	await brain.dispose()

	// Re-create brain with same use case config
	const usecase = loadUseCase(currentUseCaseId!, currentVersion ?? "default")
	if (!usecase) return c.json({ error: "Use case not found" }, 404)

	const rp = usecase.provider ?? "openrouter"
	const model = createModel(usecase.model, rp)
	const evolutionConfig = usecase.evolution
		? {
				enabled: usecase.evolution.enabled,
				autoEvaluate: usecase.evolution.autoEvaluate,
				evaluatorSignalThreshold: usecase.evolution.evaluatorSignalThreshold,
				...(usecase.evolution.model
					? { model: createModel(usecase.evolution.model, rp) }
					: {}),
			}
		: undefined

	const storagePath = resolveStoragePath(usecase.id, currentVersion ?? "default", usecase)

	// Delete existing DB files
	if (existsSync(storagePath)) {
		for (const f of readdirSync(storagePath)) {
			if (f.endsWith(".db") || f.endsWith(".db-wal") || f.endsWith(".db-shm")) {
				unlinkSync(join(storagePath, f))
			}
		}
	}

	mkdirSync(storagePath, { recursive: true })

	brain = new Brain({
		prompt: usecase.prompt,
		model,
		...(usecase.blueprintModel
			? { blueprintModel: createModel(usecase.blueprintModel, rp) }
			: {}),
		autoSetup: usecase.autoSetup ?? true,
		...(usecase.neurons ? { neurons: usecase.neurons } : {}),
		store: new SQLiteBrainStore(join(storagePath, "brain.db")),
		learning: {
			...usecase.learning,
			store: (id: string) => new SQLiteNeuronStore(join(storagePath, `neuron-${id}.db`)),
		},
		evolution: evolutionConfig,
		ingest: usecase.ingest,
	})

	brain.on((event) => {
		broadcast(event.type, event.payload)
	})

	const commentatorModel = createModel(
		usecase.commentatorModel || process.env.COMMENTATOR_MODEL, rp,
	)
	commentator = new Commentator(commentatorModel, broadcast)
	commentator.attach(brain)

	status = "initializing"

	// Initialize fresh (LLM decomposition)
	try {
		await brain.initialize()
		status = "ready"
		const neurons = brain.getNeurons().map((l) => ({
			id: l.id,
			name: l.name,
			type: l.type,
			description: l.description,
			instructions: l.instructions,
		}))
		broadcast("brain:ready", { neurons })
		return c.json({ status: "ready", neurons })
	} catch (error) {
		status = "error"
		const message = error instanceof Error ? error.message : "Unknown error"
		broadcast("brain:error", { error: message })
		return c.json({ error: message }, 500)
	}
})

app.post("/api/brain/inject", async (c) => {
	if (!brain) return c.json({ error: "No brain" }, 400)
	if (status !== "ready") return c.json({ error: "Brain not ready" }, 400)

	const body = await c.req.json<{
		items: Array<{ id: string; label: string; data: Record<string, unknown> }>
	}>()

	broadcast("inject:started", {
		itemCount: body.items.length,
		labels: body.items.map((i) => i.label),
	})

	try {
		const data = body.items.map((item) => item.data)
		const usecase = loadUseCase(currentUseCaseId!, currentVersion ?? "default")
		const appBatchSize = usecase?.appBatchSize

		if (appBatchSize && appBatchSize < data.length) {
			const results: Awaited<ReturnType<typeof brain.inject>>[] = []
			const batchCount = Math.ceil(data.length / appBatchSize)
			for (let i = 0; i < data.length; i += appBatchSize) {
				const batchIndex = Math.floor(i / appBatchSize)
				const batch = data.slice(i, i + appBatchSize)
				const itemIds = body.items.slice(i, i + appBatchSize).map((item) => item.id)
				broadcast("inject:batch:started", { batchIndex, batchCount, itemIds })
				const result = await brain.inject(batch)
				results.push(result)
				broadcast("inject:batch:completed", { batchIndex, batchCount, itemIds })
			}
			broadcast("inject:completed", { itemCount: body.items.length, results })
			return c.json(results)
		}

		const result = await brain.inject(data)
		broadcast("inject:completed", { itemCount: body.items.length, result })
		return c.json(result)
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		broadcast("inject:error", { error: message })
		return c.json({ error: message }, 500)
	}
})

app.get("/api/brain/state", async (c) => {
	if (!brain) return c.json({ status: "idle" })

	const neurons = await Promise.all(
		brain.getNeurons().map(async (l) => ({
			id: l.id,
			name: l.name,
			type: l.type,
			description: l.description,
			understanding: await l.getUnderstanding(),
			health: l.getHealth(),
			metrics: l.getMetrics(),
		})),
	)

	return c.json({
		status,
		useCaseId: currentUseCaseId,
		neurons,
		commentary: commentator?.getFullText() ?? "",
	})
})

const classifySchema = z.object({
	intent: z.enum(["ask", "signal"]),
	reasoning: z.string().describe("Brief explanation of why this is a question or a signal"),
})

app.post("/api/brain/query", async (c) => {
	if (!brain) return c.json({ error: "No brain" }, 400)
	if (status !== "ready") return c.json({ error: "Brain not ready" }, 400)

	const body = await c.req.json<{ query: string; mode?: "direct" | "deep"; neuronIds?: string[] }>()
	const { query, mode: askMode = "direct", neuronIds } = body

	return streamSSE(c, async (stream) => {
		const send = async (type: string, data: Record<string, unknown> = {}) => {
			await stream.writeSSE({ event: "query", data: JSON.stringify({ type, ...data }) })
		}

		try {
			// Step 1: Classify intent
			await send("status", { message: "Classifying..." })

			const uc = loadUseCase(currentUseCaseId!, currentVersion ?? "default")
			const classifierModel = createModel(uc?.model, uc?.provider)
			const neuronList = brain!.getNeurons().map((l) => `- ${l.name}: ${l.description || l.type}`)

			const classification = await generate({
				model: classifierModel,
				system: `You classify user inputs directed at a knowledge system (a "Brain" with specialist neurons).

The Brain has these neurons:
${neuronList.join("\n")}

Two categories:
- "ask": The user wants to RETRIEVE information, ask a question, or query what the system knows. Examples: "What are the main themes?", "Summarize what you know about X", "How many times was Y mentioned?"
- "signal": The user wants to STEER, adjust, or give feedback to the system. They want to change how it behaves, what it focuses on, or flag something. Examples: "Focus more on sentiment", "You should pay more attention to dates", "Split the topics neuron into two", "Ignore duplicate entries"

Classify the following input.`,
				prompt: query,
				output: Output.object({ schema: classifySchema }),
				repairSchema: classifySchema,
			})

			const { intent, reasoning } = classification.output as z.infer<typeof classifySchema>
			await send("classified", { intent, reasoning })

			// Step 2: Execute based on intent
			if (intent === "ask") {
				if (neuronIds?.length) {
					// Per-neuron mode: queryStream each selected neuron individually
					for (const id of neuronIds) {
						const neuron = brain!.getNeuron(id)
						if (!neuron) {
							await send("neuron-error", { neuronId: id, message: `Neuron "${id}" not found` })
							continue
						}

						await send("neuron-start", { neuronId: id, name: neuron.name })

						try {
							const stream = await neuron.queryStream(query, { mode: "direct" })

							let text = ""
							for await (const chunk of stream.textStream) {
								text += chunk
								await send("neuron-delta", { neuronId: id, text: chunk })
							}

							await send("neuron-done", { neuronId: id, text })
						} catch (err) {
							const msg = err instanceof Error ? err.message : String(err)
							await send("neuron-error", { neuronId: id, message: msg })
						}
					}
				} else if (askMode === "deep") {
					// Deep mode: agentic synthesis — tool calls visible in fullStream
					await send("status", { message: "Querying specialists..." })
					const result = await brain!.askStream(query, { mode: "deep" })

					const sources: Array<{ neuronId: string; relevance: number; confidence: number; insight: string }> = []
					const pendingSpecialists = new Map<string, string>()

					for await (const part of result.fullStream) {
						const p = part as { type: string; [k: string]: unknown }
						switch (p.type) {
							case "text-delta":
								await send("reasoning", { text: String(p.textDelta ?? "") })
								break
							case "tool-call": {
								const toolName = p.toolName as string
								const input = (p.args ?? p.input) as Record<string, unknown>
								const toolCallId = p.toolCallId as string
								if (toolName === "querySpecialist") {
									pendingSpecialists.set(toolCallId, input.id as string)
									await send("activity", {
										action: "querying-specialist",
										specialistId: input.id,
										question: input.question,
									})
								} else if (toolName === "answer") {
									const args = input as { response: string; gaps: string[] }
									await send("answer", {
										insight: args.response,
										sources,
										gaps: args.gaps ?? [],
									})
								} else {
									await send("activity", {
										action: "consulting",
										toolName,
									})
								}
								break
							}
							case "tool-result": {
								const toolName = p.toolName as string
								const toolCallId = p.toolCallId as string
								if (toolName === "querySpecialist") {
									const specialistId = pendingSpecialists.get(toolCallId) ?? "unknown"
									pendingSpecialists.delete(toolCallId)
									const res = (p.result ?? p.output) as { relevant?: boolean; insight?: string }
									if (res.relevant) {
										sources.push({
											neuronId: specialistId,
											relevance: 1,
											confidence: 1,
											insight: res.insight ?? "",
										})
									}
									await send("activity", {
										action: "specialist-responded",
										specialistId,
										relevant: res.relevant ?? false,
									})
								}
								break
							}
						}
					}
				} else {
					// Direct mode: pre-filters neurons, queries them, then streams synthesis text
					await send("status", { message: "Preparing specialists..." })
					const result = await brain!.askStream(query, { mode: "direct" })

					await send("status", { message: "Synthesizing..." })

					let fullText = ""
					for await (const chunk of result.textStream) {
						fullText += chunk
						await send("answer-delta", { text: chunk })
					}

					await send("answer", {
						insight: fullText,
						sources: [],
						gaps: [],
					})
				}
			} else {
				// Signal
				await send("status", { message: "Sending signal to brain..." })
				brain!.signal({ source: "user:query-bar", description: query, bypass: true })
				await send("signal-ack", { message: "Signal received. The brain will evaluate and may adjust its neurons." })
			}

			await send("done")
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			await send("error", { message })
		}
	})
})

app.post("/api/brain/destroy", async (c) => {
	if (!brain) return c.json({ error: "No brain to destroy" }, 400)

	commentator?.detach()
	await brain.dispose()
	brain = null
	commentator = null
	currentUseCaseId = null
	currentVersion = null
	status = "idle"

	broadcast("brain:destroyed", {})
	return c.json({ ok: true })
})

// --- SSE Events ---

app.get("/api/events", (c) => {
	return streamSSE(c, async (stream) => {
		const send: SSESender = (event, data) => {
			try {
				stream.writeSSE({ event, data: JSON.stringify(data) })
			} catch {
				// Stream closed
			}
		}

		sseClients.add(send)
		console.log(`[SSE] Client connected (${sseClients.size} total)`)

		// Send current snapshot
		const neurons = brain
			? brain.getNeurons().map((l) => ({
					id: l.id,
					name: l.name,
					type: l.type,
					description: l.description,
				}))
			: []
		send("snapshot", {
			status,
			useCaseId: currentUseCaseId,
			neurons,
			commentary: commentator?.getFullText() ?? "",
		})

		// Keep alive
		const keepAlive = setInterval(() => {
			try {
				stream.writeSSE({ event: "ping", data: "" })
			} catch {
				// closed
			}
		}, 5000)

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

// --- Start ---

const port = Number(process.env.PORT) || 3211

async function shutdown() {
	if (brain) {
		console.log("[Shutdown] Disposing brain...")
		commentator?.detach()
		await brain.dispose()
	}
	process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.log(`
Playground API Server
=====================
API: http://localhost:${port}/api/*
`)

serve({ fetch: app.fetch, port })
