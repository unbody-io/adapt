import { useState, useCallback, useRef } from "react"
import type {
	SessionState,
	Neuron,
	NeuronMetrics,
	NeuronHealth,
	DataItem,
	InjectionProgress,
} from "../types"

const defaultMetrics: NeuronMetrics = {
	observations: 0,
	dismissals: 0,
	syntheses: 0,
	queries: 0,
	lastSynthesisSignificance: null,
	lastSynthesisEvolution: null,
}

const defaultHealth: NeuronHealth = {
	activation: 0.5,
	status: "active",
}

/** Map raw server neuron to frontend Neuron with full metrics */
function toNeuron(
	raw: Record<string, unknown>,
	existingMetrics?: NeuronMetrics,
	existingHealth?: NeuronHealth,
): Neuron {
	const understanding = raw.understanding
	let understandingSize = 0
	if (typeof understanding === "string") {
		understandingSize = understanding.length
	} else if (Array.isArray(understanding)) {
		understandingSize = understanding.length
	}

	// Extract health from server data if available
	const serverHealth = raw.health as Record<string, unknown> | undefined
	const health: NeuronHealth = serverHealth
		? {
				activation: (serverHealth.activation as number) ?? existingHealth?.activation ?? 0.5,
				status: (serverHealth.status as string) ?? existingHealth?.status ?? "active",
			}
		: existingHealth ?? { ...defaultHealth }

	// Extract metrics from server data if available
	const serverMetrics = raw.metrics as Record<string, unknown> | undefined
	const metrics: NeuronMetrics = serverMetrics
		? {
				observations: (serverMetrics.totalObservations as number) ?? existingMetrics?.observations ?? 0,
				dismissals: (serverMetrics.totalDismissals as number) ?? existingMetrics?.dismissals ?? 0,
				syntheses: (serverMetrics.totalSyntheses as number) ?? existingMetrics?.syntheses ?? 0,
				queries: existingMetrics?.queries ?? 0,
				lastSynthesisSignificance: existingMetrics?.lastSynthesisSignificance ?? null,
				lastSynthesisEvolution: existingMetrics?.lastSynthesisEvolution ?? null,
			}
		: existingMetrics ?? { ...defaultMetrics }

	return {
		id: raw.id as string,
		name: raw.name as string,
		type: raw.type as string,
		description: raw.description as string,
		understandingSize,
		activity: "idle",
		metrics,
		health,
	}
}

const initialState: SessionState = {
	sessionId: null,
	status: "idle",
	activity: "",
	neurons: [],
	commentary: "",
	events: [],
	injectedIds: new Set(),
	injectionProgress: null,
}

/** Map event types to human-readable activity labels */
function activityFromEvent(type: string, payload: Record<string, unknown>): string | null {
	switch (type) {
		case "brain:init:started": return "Decomposing brain prompt..."
		case "brain:init:config:generated": {
			const count = (payload.configs as unknown[])?.length ?? 0
			return `Generated ${count} neuron configs`
		}
		case "brain:neuron:added": return `Creating neuron "${payload.name}"...`
		case "brain:init:completed": return "Brain ready"
		case "inject:started": return `Injecting ${payload.itemCount} items...`
		case "inject:completed": return "Injection complete"
		case "neuron:observed": return `Observed by ${payload.neuronName ?? payload.neuronId}`
		case "neuron:observe:dismissed": return `Dismissed by ${payload.neuronName ?? payload.neuronId}`
		case "neuron:synthesize:started": return `Synthesizing "${payload.neuronName ?? payload.neuronId}"...`
		case "neuron:synthesized": return `Synthesized "${payload.neuronName ?? payload.neuronId}"`
		case "evaluator:evaluation:completed": {
			const count = payload.decisionCount as number
			return count > 0 ? `Evolution: ${count} decision(s)` : "Evolution: no changes"
		}
		case "evolution:action:executed": return `Evolving: ${payload.action} on ${(payload.targets as string[])?.join(", ")}`
		case "brain:neuron:removed": return `Removed neuron`
		default: return null
	}
}

export function useSession() {
	const [state, setState] = useState<SessionState>(initialState)
	const eventSourceRef = useRef<EventSource | null>(null)
	const eventIdCounter = useRef(0)
	const commentaryBufferRef = useRef("")

	const addEvent = useCallback((type: string, payload: Record<string, unknown>) => {
		setState((prev) => ({
			...prev,
			events: [
				...prev.events,
				{
					id: String(++eventIdCounter.current),
					type,
					payload,
					timestamp: new Date().toISOString(),
				},
			],
		}))
	}, [])

	/** Update a single neuron's fields without replacing the whole array */
	const patchNeuron = useCallback((neuronId: string, patch: Partial<Neuron>) => {
		setState((prev) => ({
			...prev,
			neurons: prev.neurons.map((l) =>
				l.id === neuronId ? { ...l, ...patch } : l,
			),
		}))
	}, [])

	/** Increment a metric counter for a neuron */
	const incrementMetric = useCallback((neuronId: string, key: keyof NeuronMetrics) => {
		setState((prev) => ({
			...prev,
			neurons: prev.neurons.map((l) => {
				if (l.id !== neuronId) return l
				return {
					...l,
					metrics: {
						...l.metrics,
						[key]: (l.metrics[key] as number) + 1,
					},
				}
			}),
		}))
	}, [])

	const updateNeurons = useCallback((neurons: Neuron[]) => {
		setState((prev) => {
			// Preserve existing metrics/activity when updating from server
			const merged = neurons.map((newL) => {
				const existing = prev.neurons.find((l) => l.id === newL.id)
				if (existing) {
					return {
						...newL,
						activity: existing.activity,
						metrics: {
							...existing.metrics,
							// Server metrics override if higher (they're cumulative)
							observations: Math.max(existing.metrics.observations, newL.metrics.observations),
							dismissals: Math.max(existing.metrics.dismissals, newL.metrics.dismissals),
							syntheses: Math.max(existing.metrics.syntheses, newL.metrics.syntheses),
							lastSynthesisSignificance: newL.metrics.lastSynthesisSignificance ?? existing.metrics.lastSynthesisSignificance,
							lastSynthesisEvolution: newL.metrics.lastSynthesisEvolution ?? existing.metrics.lastSynthesisEvolution,
						},
						health: newL.health.activation !== 0.5 ? newL.health : existing.health,
					}
				}
				return newL
			})
			return { ...prev, neurons: merged }
		})
	}, [])

	const startSession = useCallback(
		async (useCaseId: string, version?: string) => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close()
				eventSourceRef.current = null
			}

			commentaryBufferRef.current = ""
			setState({
				...initialState,
				status: "initializing",
				activity: "Creating brain...",
				injectedIds: new Set(),
			})

			try {
				const es = new EventSource("/api/events")
				eventSourceRef.current = es

				es.addEventListener("snapshot", (e) => {
					const payload = JSON.parse(e.data)
					if (payload.neurons?.length) {
						const neurons = payload.neurons.map((r: Record<string, unknown>) => toNeuron(r))
						updateNeurons(neurons)
					}
					if (payload.commentary) {
						commentaryBufferRef.current = payload.commentary
						setState((prev) => ({
							...prev,
							commentary: payload.commentary,
						}))
					}
				})

				// Prepend event label when a new comment starts
				es.addEventListener("commentary:start", (e) => {
					const { event } = JSON.parse(e.data)
					if (event) {
						commentaryBufferRef.current += `[${event}] `
					}
				})

				// Deltas flush to state so Stream shows real-time typing
				es.addEventListener("commentary:delta", (e) => {
					const { delta } = JSON.parse(e.data)
					commentaryBufferRef.current += delta
					setState((prev) => ({
						...prev,
						commentary: commentaryBufferRef.current,
					}))
				})

				es.addEventListener("commentary:end", () => {
					commentaryBufferRef.current += "\n\n"
					setState((prev) => ({
						...prev,
						commentary: commentaryBufferRef.current,
					}))
				})

				es.addEventListener("commentary:cancel", () => {
					const lastBreak = commentaryBufferRef.current.lastIndexOf("\n\n")
					commentaryBufferRef.current = lastBreak >= 0
						? commentaryBufferRef.current.slice(0, lastBreak + 2)
						: ""
				})

				es.addEventListener("brain:ready", (e) => {
					const payload = JSON.parse(e.data)
					setState((prev) => ({
						...prev,
						status: "ready",
						neurons: payload.neurons
							? payload.neurons.map((r: Record<string, unknown>) => {
									const existing = prev.neurons.find((l) => l.id === r.id as string)
									return toNeuron(r, existing?.metrics, existing?.health)
								})
							: prev.neurons,
					}))
				})

				es.addEventListener("brain:error", () => {
					setState((prev) => ({ ...prev, status: "error" }))
				})

				es.addEventListener("brain:destroyed", () => {
					commentaryBufferRef.current = ""
					setState((prev) => ({
						...prev,
						status: "idle",
						neurons: [],
						commentary: "",
						events: [],
					}))
				})

				es.addEventListener("inject:batch:started", (e) => {
					const payload = JSON.parse(e.data)
					const progress: InjectionProgress = {
						batchIndex: payload.batchIndex as number,
						batchCount: payload.batchCount as number,
						activeItemIds: new Set(payload.itemIds as string[]),
						completedItemIds: new Set(),
					}
					setState((prev) => {
						// Carry over completed items from previous batches
						if (prev.injectionProgress) {
							for (const id of prev.injectionProgress.completedItemIds) {
								progress.completedItemIds.add(id)
							}
						}
						return { ...prev, injectionProgress: progress }
					})
				})

				es.addEventListener("inject:batch:completed", (e) => {
					const payload = JSON.parse(e.data)
					const completedIds = payload.itemIds as string[]
					setState((prev) => {
						if (!prev.injectionProgress) return prev
						const completed = new Set(prev.injectionProgress.completedItemIds)
						for (const id of completedIds) completed.add(id)
						return {
							...prev,
							injectionProgress: {
								...prev.injectionProgress,
								activeItemIds: new Set(),
								completedItemIds: completed,
							},
						}
					})
				})


				for (const eventType of [
					"brain:init:started",
					"brain:init:completed",
					"brain:init:config:generated",
					"neuron:init:completed",
					"neuron:observed",
					"neuron:observe:dismissed",
					"neuron:synthesized",
					"neuron:synthesize:started",
					"neuron:health:updated",
					"neuron:signal",
					"evolution:action:executed",
					"evaluator:evaluation:completed",
					"inject:started",
					"inject:completed",
					"brain:neuron:added",
					"brain:neuron:removed",
				]) {
					es.addEventListener(eventType, (e) => {
						const payload = JSON.parse(e.data)
						addEvent(eventType, payload)

						const activity = activityFromEvent(eventType, payload)
						if (activity) {
							setState((prev) => ({ ...prev, activity }))
						}

						// Track per-neuron metrics
						const neuronId = payload.neuronId as string | undefined
						if (neuronId) {
							switch (eventType) {
								case "neuron:observed":
									incrementMetric(neuronId, "observations")
									patchNeuron(neuronId, { activity: "observing" })
									// Reset to idle after a short delay
									setTimeout(() => patchNeuron(neuronId, { activity: "idle" }), 800)
									break
								case "neuron:observe:dismissed":
									incrementMetric(neuronId, "dismissals")
									break
								case "neuron:synthesize:started":
									patchNeuron(neuronId, { activity: "synthesizing" })
									break
								case "neuron:synthesized":
									incrementMetric(neuronId, "syntheses")
									patchNeuron(neuronId, { activity: "idle" })
									// Store last synthesis info
									setState((prev) => ({
										...prev,
										neurons: prev.neurons.map((l) => {
											if (l.id !== neuronId) return l
											return {
												...l,
												metrics: {
													...l.metrics,
													lastSynthesisSignificance: (payload.significance as string) ?? null,
													lastSynthesisEvolution: typeof payload.newUnderstanding === "string"
														? payload.newUnderstanding.slice(0, 100)
														: null,
												},
											}
										}),
									}))
									break
								case "neuron:health:updated":
									patchNeuron(neuronId, {
										health: {
											activation: (payload.activation as number) ?? 0.5,
											status: (payload.status as string) ?? "active",
										},
									})
									break
							}
						}

						// Fetch full state on structural changes
						if (
							eventType === "brain:init:completed" ||
							eventType === "brain:neuron:added" ||
							eventType === "brain:neuron:removed" ||
							eventType === "evolution:action:executed"
						) {
							fetch("/api/brain/state")
								.then((r) => r.json())
								.then((s) => {
									if (s.neurons) {
										setState((prev) => {
											const newNeurons = (s.neurons as Record<string, unknown>[]).map((r) => {
												const existing = prev.neurons.find((l) => l.id === r.id as string)
												return toNeuron(r, existing?.metrics, existing?.health)
											})
											return { ...prev, neurons: newNeurons }
										})
									}
								})
								.catch(() => {})
						}
					})
				}

				es.onerror = () => {
					console.warn("[SSE] Connection error")
				}

				await new Promise<void>((resolve) => {
					es.addEventListener("snapshot", () => resolve(), { once: true })
				})

				const startRes = await fetch("/api/brain/start", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ useCaseId, version }),
				})

				const startData = await startRes.json()

				if (!startRes.ok) {
					throw new Error(startData.error || "Failed to start brain")
				}

				setState((prev) => ({ ...prev, sessionId: useCaseId }))

				if (startData.hasExistingState) {
					// Persistent use case with existing data — wait for user choice
					setState((prev) => ({ ...prev, status: "pending" }))
				} else {
					// No existing state — auto-init
					fetch("/api/brain/init", { method: "POST" }).catch((err) => {
						console.error("[Init] Failed:", err)
						setState((prev) => ({ ...prev, status: "error" }))
					})
				}

				return useCaseId
			} catch (error) {
				setState((prev) => ({ ...prev, status: "error" }))
				throw error
			}
		},
		[addEvent, updateNeurons, patchNeuron, incrementMetric],
	)

	const initSession = useCallback(async () => {
		setState((prev) => ({
			...prev,
			status: "initializing",
			activity: "Restoring brain...",
		}))
		try {
			await fetch("/api/brain/init", { method: "POST" })
		} catch (err) {
			console.error("[Init] Failed:", err)
			setState((prev) => ({ ...prev, status: "error" }))
		}
	}, [])

	const resetSession = useCallback(async () => {
		setState((prev) => ({
			...prev,
			status: "initializing",
			activity: "Initializing brain...",
		}))
		try {
			await fetch("/api/brain/reset", { method: "POST" })
		} catch (err) {
			console.error("[Reset] Failed:", err)
			setState((prev) => ({ ...prev, status: "error" }))
		}
	}, [])

	const inject = useCallback(
		async (items: DataItem[]) => {
			const res = await fetch("/api/brain/inject", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items }),
			})

			if (!res.ok) {
				const err = await res.json()
				throw new Error(err.error || "Injection failed")
			}

			setState((prev) => {
				const newIds = new Set(prev.injectedIds)
				for (const item of items) newIds.add(item.id)
				return { ...prev, injectedIds: newIds, injectionProgress: null }
			})

			return res.json()
		},
		[],
	)

	const destroySession = useCallback(async () => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close()
			eventSourceRef.current = null
		}
		commentaryBufferRef.current = ""
		await fetch("/api/brain/destroy", { method: "POST" }).catch(() => {})
		setState({ ...initialState, injectedIds: new Set() })
	}, [])

	return {
		state,
		startSession,
		initSession,
		resetSession,
		inject,
		destroySession,
	}
}
