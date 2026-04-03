import { useState, useCallback, useRef } from "react"
import type { LanguageModel } from "ai"
import type {
	Neuron,
	NeuronMetrics,
	NeuronHealth,
	BrainEvent,
	InjectionProgress,
	DataSource,
} from "./types"

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

export type DemoPhase = "idle" | "initializing" | "ready" | "error"

export interface DemoState {
	phase: DemoPhase
	activity: string
	neurons: Neuron[]
	commentary: string
	events: BrainEvent[]
	injectionProgress: InjectionProgress | null
}

const initialState: DemoState = {
	phase: "idle",
	activity: "",
	neurons: [],
	commentary: "",
	events: [],
	injectionProgress: null,
}

interface UseBrainOptions {
	model: LanguageModel
	blueprintModel?: LanguageModel
	commentatorModel?: LanguageModel
	prompt: string
	autoSetup?: boolean
	learning?: {
		understand?: {
			thresholds?: {
				maxObservations?: number
				maxTokens?: number
				minImportance?: number
			}
		}
		governance?: {
			strategy?: "continuous" | "cumulative" | "decay"
			maxTokens?: number
		}
	}
	evolution?: {
		enabled?: boolean
		model?: LanguageModel
		autoEvaluate?: boolean
		evaluatorSignalThreshold?: number
	}
	ingest?: {
		batchSize?: number
	}
}

export function useBrain() {
	const [state, setState] = useState<DemoState>(initialState)
	const brainRef = useRef<import("@unbody/adapt").Brain | null>(null)
	const commentatorRef = useRef<import("../../components/demo/commentator").Commentator | null>(null)
	const eventIdCounter = useRef(0)
	const timelineRef = useRef<{ t: number; event: string; payload: Record<string, unknown> }[]>([])
	const startTimeRef = useRef(0)

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

	const patchNeuron = useCallback((neuronId: string, patch: Partial<Neuron>) => {
		setState((prev) => ({
			...prev,
			neurons: prev.neurons.map((n) =>
				n.id === neuronId ? { ...n, ...patch } : n,
			),
		}))
	}, [])

	const incrementMetric = useCallback((neuronId: string, key: keyof NeuronMetrics) => {
		setState((prev) => ({
			...prev,
			neurons: prev.neurons.map((n) => {
				if (n.id !== neuronId) return n
				return {
					...n,
					metrics: {
						...n.metrics,
						[key]: (n.metrics[key] as number) + 1,
					},
				}
			}),
		}))
	}, [])

	const start = useCallback(async (options: UseBrainOptions) => {
		const { Brain, MemoryBrainStore, MemoryNeuronStore } = await import("@unbody/adapt")
		const { Commentator } = await import("../../components/demo/commentator")

		startTimeRef.current = Date.now()
		timelineRef.current = []
		setState({ ...initialState, phase: "initializing", activity: "Creating brain..." })

		const brain = new Brain({
			prompt: options.prompt,
			autoSetup: options.autoSetup ?? true,
			model: options.model,
			blueprintModel: options.blueprintModel ?? options.model,
			store: new MemoryBrainStore(),
			ingest: options.ingest,
			learning: {
				store: () => new MemoryNeuronStore(),
				understand: options.learning?.understand,
				governance: options.learning?.governance,
			},
			evolution: options.evolution ? {
				enabled: options.evolution.enabled,
				autoEvaluate: options.evolution.autoEvaluate,
				evaluatorSignalThreshold: options.evolution.evaluatorSignalThreshold,
				model: options.evolution.model ?? options.model,
			} : undefined,
		})

		brainRef.current = brain

		// Commentator
		const commentator = new Commentator(
			options.commentatorModel ?? options.model,
			(comment: string) => {
				setState((prev) => ({
					...prev,
					commentary: prev.commentary
						? `${prev.commentary}\n\n${comment}`
						: comment,
				}))
			},
		)
		commentator.attach(brain)
		commentator.setPhase("birth")
		commentatorRef.current = commentator

		// Phase-transition narration: birth begins
		commentator.narrate("The mind is coming into being — analyzing its purpose and deciding how to organize its thinking.")

		// Log ALL brain events to timeline
		;(brain as unknown as { on(fn: (event: { type: string; payload: unknown }) => void): void }).on((event) => {
			timelineRef.current.push({ t: Date.now() - startTimeRef.current, event: event.type, payload: event.payload as Record<string, unknown> })
		})

		// Wire up brain events → React state
		const eventTypes = [
			"brain:init:started",
			"brain:init:completed",
			"brain:init:config:generated",
			"brain:neuron:added",
			"brain:neuron:removed",
			"neuron:init:started",
			"neuron:observe:started",
			"neuron:observe:thinking",
			"neuron:observed",
			"neuron:observe:dismissed",
			"neuron:synthesize:started",
			"neuron:synthesized",
			"neuron:health:updated",
			"neuron:query:started",
			"neuron:query:completed",
			"brain:inject:started",
			"brain:inject:completed",
			"brain:inject:batch:started",
			"brain:inject:batch:completed",
			"brain:signal:received",
			"evaluator:evaluation:started",
			"evaluator:evaluation:completed",
			"evolution:action:executed",
		]

		for (const eventType of eventTypes) {
			(brain as unknown as { on(event: string, fn: (payload: Record<string, unknown>) => void): void }).on(eventType, (payload: Record<string, unknown>) => {
				addEvent(eventType, payload)

				// Activity label
				const activity = activityFromEvent(eventType, payload, brain)
				if (activity) {
					setState((prev) => ({ ...prev, activity }))
				}

				// Per-neuron tracking
				const neuronId = payload.neuronId as string | undefined
				if (neuronId) {
					const isInternal = isInternalNeuron(brain, neuronId)

					switch (eventType) {
						case "neuron:observe:started":
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "observing" })
							}
							break
						case "neuron:observe:thinking":
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "thinking" })
							}
							break
						case "neuron:observed":
							incrementMetric(neuronId, "observations")
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "idle" })
							}
							break
						case "neuron:observe:dismissed":
							incrementMetric(neuronId, "dismissals")
							break
						case "neuron:synthesize:started":
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "synthesizing" })
							}
							break
						case "neuron:synthesized":
							incrementMetric(neuronId, "syntheses")
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "idle" })
							}
							break
						case "neuron:query:started":
							incrementMetric(neuronId, "queries")
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "querying" })
							}
							break
						case "neuron:query:completed":
							if (!isInternal) {
								patchNeuron(neuronId, { activity: "idle" })
							}
							break
						case "neuron:health:updated":
							if (!isInternal) {
								patchNeuron(neuronId, {
									health: {
										activation: (payload.activation as number) ?? 0.5,
										status: (payload.status as string) ?? "active",
									},
								})
							}
							break
					}
				}

				// Structural changes → sync neuron list
				if (
					eventType === "brain:init:completed" ||
					eventType === "brain:neuron:added" ||
					eventType === "brain:neuron:removed" ||
					eventType === "evolution:action:executed"
				) {
					syncNeurons(brain)
				}

				// Phase transitions for commentator
				if (eventType === "brain:inject:started") {
					commentatorRef.current?.setPhase("injection")
				}
				if (eventType === "brain:inject:completed") {
					commentatorRef.current?.setPhase("idle")
				}
				if (eventType === "evaluator:evaluation:started") {
					commentatorRef.current?.setPhase("evolution")
				}
				if (eventType === "evaluator:evaluation:completed" || eventType === "evolution:action:executed") {
					commentatorRef.current?.setPhase("idle")
				}

				// Injection batch progress
				if (eventType === "brain:inject:started") {
					setState((prev) => ({
						...prev,
						injectionProgress: prev.injectionProgress
							? {
								...prev.injectionProgress,
								batchCount: payload.batchCount as number,
							}
							: prev.injectionProgress,
					}))
				}
				if (eventType === "brain:inject:batch:completed") {
					setState((prev) => ({
						...prev,
						injectionProgress: prev.injectionProgress
							? {
								...prev.injectionProgress,
								batchIndex: (payload.batchIndex as number) + 1,
							}
							: prev.injectionProgress,
					}))
				}
			})
		}

		// Initialize
		try {
			await retryAsync(() => brain.initialize(), 3)
			syncNeurons(brain)
			commentator.setPhase("idle")

			// Phase-transition narration: brain ready
			commentator.narrate(
				`${brainContext(brain)}\nThe mind is fully formed and ready. All areas of focus are in place.`,
			)

			setState((prev) => ({ ...prev, phase: "ready" }))
		} catch (err) {
			console.error("[useBrain] Init failed:", err)
			setState((prev) => ({ ...prev, phase: "error", activity: String(err) }))
		}
	}, [addEvent, patchNeuron, incrementMetric])

	const syncNeurons = (brain: import("@unbody/adapt").Brain) => {
		const neuronMap = brain.neurons
		const newNeurons: Neuron[] = []
		for (const [id, neuron] of neuronMap) {
			if (neuron.name.startsWith("__internal")) continue
			newNeurons.push({
				id,
				name: neuron.name,
				type: neuron.type,
				description: neuron.description,
				understandingSize: 0,
				activity: "idle",
				metrics: { ...defaultMetrics },
				health: { ...defaultHealth },
			})
		}
		setState((prev) => {
			// Preserve existing metrics for neurons that already exist
			const merged = newNeurons.map((newN) => {
				const existing = prev.neurons.find((n) => n.id === newN.id)
				if (existing) {
					return { ...newN, activity: existing.activity, metrics: existing.metrics, health: existing.health }
				}
				return newN
			})
			return { ...prev, neurons: merged }
		})
	}

	const inject = useCallback(async (dataSources: DataSource[]) => {
		const brain = brainRef.current
		if (!brain) return

		// Phase-transition narration: injection phase begins
		commentatorRef.current?.narrate(
			`Now it's time to learn. ${dataSources.length} source${dataSources.length > 1 ? "s" : ""} of information ${dataSources.length > 1 ? "are" : "is"} about to flow in: ${dataSources.map((s) => s.label).join(", ")}.`,
		)

		for (let i = 0; i < dataSources.length; i++) {
			const source = dataSources[i]
			setState((prev) => ({
				...prev,
				injectionProgress: {
					sourceIndex: i,
					sourceCount: dataSources.length,
					sourceLabel: source.label,
					sourceSummary: source.summary || source.description,
					itemCount: source.items.length,
					batchIndex: 0,
					batchCount: 0,
				},
			}))

			// Give commentator source context
			commentatorRef.current?.setSourceContext(source.label, source.summary || source.description)

			// Source-transition narration
			if (i > 0) {
				commentatorRef.current?.narrate(
					`Moving on to source ${i + 1} of ${dataSources.length}: "${source.label}".`,
				)
			}

			const items = source.items.map((item) => ({
				...item.data,
				_id: item.id,
				_label: item.label,
			}))
			await retryAsync(() => brain.inject(items), 3)

			// Pause between sources so UI can breathe
			if (i < dataSources.length - 1) {
				await new Promise((r) => setTimeout(r, 1500))
			}
		}

		// Clear source context
		commentatorRef.current?.setSourceContext("", "")

		setState((prev) => ({
			...prev,
			activity: "Injection complete",
			injectionProgress: null,
		}))

		// Phase-transition narration: all injection done
		commentatorRef.current?.narrate(
			`All sources have been absorbed. The mind is ready to answer questions.`,
		)

		console.log("[Brain Timeline]", JSON.stringify(timelineRef.current.map(e => ({ t: e.t, event: e.event })), null, 2))
	}, [])

	const destroy = useCallback(() => {
		commentatorRef.current?.detach()
		commentatorRef.current = null
		brainRef.current = null
		setState(initialState)
	}, [])

	return {
		state,
		brain: brainRef,
		start,
		inject,
		destroy,
	}
}

function isInternalNeuron(brain: import("@unbody/adapt").Brain, neuronId: string): boolean {
	const neuron = brain.getNeuron(neuronId)
	return neuron?.name?.startsWith("__internal") ?? false
}

function brainContext(brain: import("@unbody/adapt").Brain): string {
	const neurons = brain.neurons
	if (neurons.size === 0) return ""
	const names = Array.from(neurons.values())
		.filter((l) => !l.name.startsWith("__internal"))
		.map((l) => l.name)
		.join(", ")
	return `[Current areas of focus: ${names}]`
}

function activityFromEvent(
	type: string,
	payload: Record<string, unknown>,
	brain: import("@unbody/adapt").Brain,
): string | null {
	switch (type) {
		case "brain:init:started": return "Analyzing prompt..."
		case "brain:init:config:generated": {
			const count = (payload.configs as unknown[])?.length ?? 0
			return `Designing ${count} neurons...`
		}
		case "brain:neuron:added": return `Created "${payload.name}"`
		case "neuron:init:started": {
			const neuronId = payload.neuronId as string
			if (isInternalNeuron(brain, neuronId)) {
				return "Preparing internal systems..."
			}
			const neuron = brain.getNeuron(neuronId)
			return `Setting up "${neuron?.name ?? neuronId}"...`
		}
		case "brain:init:completed": return "Brain ready"
		case "brain:inject:started": return `Injecting ${payload.itemCount} items...`
		case "brain:inject:batch:started": return "Processing batch..."
		case "brain:inject:completed": return "Injection complete"
		case "neuron:observe:started": return null // silent — neuron activity state handles it
		case "neuron:observe:thinking": return null
		case "neuron:observed": return null
		case "neuron:observe:dismissed": return null
		case "neuron:synthesize:started": return null
		case "neuron:synthesized": return null
		case "neuron:query:started": {
			const neuronId = payload.neuronId as string
			if (isInternalNeuron(brain, neuronId)) {
				return "Cross-referencing knowledge..."
			}
			return null
		}
		case "neuron:query:completed": return null
		case "brain:signal:received": return "Signal received"
		case "evaluator:evaluation:started": return "Reflecting..."
		case "evaluator:evaluation:completed": {
			const count = payload.decisionCount as number
			return count > 0 ? `Evolution: ${count} decision(s)` : "Evolution: no changes"
		}
		case "evolution:action:executed": return `Evolving: ${payload.action} on ${(payload.targets as string[])?.join(", ")}`
		default: return null
	}
}

async function retryAsync<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
	let lastError: unknown
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn()
		} catch (err) {
			lastError = err
			console.warn(`[useBrain] Attempt ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : err)
		}
	}
	throw lastError
}
