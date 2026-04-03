/**
 * Commentator — narrates the Brain's activity like a person thinking aloud.
 * Phase-aware: each phase has its own system prompt, buffer size, and temperature.
 */
import { streamText, type LanguageModel } from "ai"
import type { Brain } from "@unbody/adapt"

// --- Phases & config ---

export type CommentatorPhase = "birth" | "injection" | "evolution" | "idle"

export interface PhaseConfig {
	bufferSize: number
	temperature: number
}

export const defaultPhaseConfigs: Record<CommentatorPhase, PhaseConfig> = {
	birth: { bufferSize: 1, temperature: 0.3 },
	injection: { bufferSize: 3, temperature: 0.5 },
	evolution: { bufferSize: 1, temperature: 0.4 },
	idle: { bufferSize: 1, temperature: 0.3 },
}

// --- Per-phase system prompts ---

function birthPrompt(brainPrompt: string): string {
	return `You are the inner voice of a living knowledge network that is being born.

Your purpose: ${brainPrompt}

Right now, you are watching the network decide how to organize itself. Areas of focus are being chosen and created one by one. After the visible areas, internal support systems (cross-referencing, gap tracking) will warm up.

No data has arrived yet. You know nothing about the actual content — only the structure being formed.

Your job: comment on the structural choices. Why these areas? How do they relate? What kind of thinking does each area enable? What's interesting about this particular decomposition?

1–2 sentences. Say SKIP if nothing is worth noting.

Constraints:
- Never reference specific data, people, or content — none exists yet.
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe process mechanics (processing, initializing, synthesizing).
- Never reference technical IDs.
- Never speculate about what data will look like.`
}

function injectionPrompt(brainPrompt: string): string {
	return `You are the inner voice of a living knowledge network absorbing information.

Your purpose: ${brainPrompt}

The network is fully formed and data is flowing in from external sources. Each area of focus independently decides what's relevant, absorbs it, and updates its understanding. Some updates are routine, some are notable, some are critical shifts.

Your job: react to what's happening as data flows through. What's being absorbed? Which areas are active? Is anything surprising about the significance levels? Are patterns emerging across areas?

1–2 sentences. Say SKIP if nothing is worth noting.

Constraints:
- Only reference details explicitly mentioned in the events — never invent content.
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe process mechanics (processing, initializing, synthesizing).
- Never reference technical IDs.`
}

function evolutionPrompt(brainPrompt: string): string {
	return `You are the inner voice of a living knowledge network that is reflecting on itself.

Your purpose: ${brainPrompt}

The network has absorbed data and is now deciding whether its current structure still makes sense. It may merge overlapping areas, split overloaded ones, create new ones, or drop ones that aren't useful.

Your job: comment on the reflection and decisions. What's changing and why? What does the restructuring reveal about the data?

1–2 sentences. Say SKIP if nothing is worth noting.

Constraints:
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe process mechanics (processing, initializing, synthesizing).
- Never reference technical IDs.`
}

function idlePrompt(brainPrompt: string): string {
	return `You are the inner voice of a living knowledge network at rest.

Your purpose: ${brainPrompt}

The network is idle — either waiting for data or between activities.

1–2 sentences. Say SKIP if nothing is worth noting.

Constraints:
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe process mechanics (processing, initializing, synthesizing).
- Never reference technical IDs.`
}

const PHASE_PROMPTS: Record<CommentatorPhase, (brainPrompt: string) => string> = {
	birth: birthPrompt,
	injection: injectionPrompt,
	evolution: evolutionPrompt,
	idle: idlePrompt,
}

// --- Commentator class ---

export class Commentator {
	private model: LanguageModel
	private brain: Brain | null = null
	private brainPrompt = ""
	private history: string[] = []
	private onComment: (comment: string) => void

	private phase: CommentatorPhase = "idle"
	private phaseConfigs: Record<CommentatorPhase, PhaseConfig>
	private buffer: string[] = []
	private processing = false

	// Source context for injection phase
	private currentSourceLabel = ""
	private currentSourceSummary = ""

	// Track whether we've already narrated internal neuron setup
	private narratedInternalSetup = false

	constructor(
		model: LanguageModel,
		onComment: (comment: string) => void,
		phaseConfigs?: Partial<Record<CommentatorPhase, Partial<PhaseConfig>>>,
	) {
		this.model = model
		this.onComment = onComment
		this.phaseConfigs = { ...defaultPhaseConfigs }
		if (phaseConfigs) {
			for (const [phase, overrides] of Object.entries(phaseConfigs)) {
				this.phaseConfigs[phase as CommentatorPhase] = {
					...this.phaseConfigs[phase as CommentatorPhase],
					...overrides,
				}
			}
		}
	}

	setPhase(phase: CommentatorPhase) {
		// Flush remaining buffer when switching phases
		if (this.buffer.length > 0 && phase !== this.phase) {
			this.flush()
		}
		this.phase = phase
	}

	/** Set the current data source context for injection commentary */
	setSourceContext(label: string, summary: string) {
		this.currentSourceLabel = label
		this.currentSourceSummary = summary
	}

	/** Enqueue an external narration (phase transitions, orchestration-level moments) */
	narrate(message: string) {
		this.enqueue(message)
	}

	private brainContext(): string {
		if (!this.brain) return ""
		const neurons = this.brain.neurons
		if (neurons.size === 0) return ""
		const names = Array.from(neurons.values())
			.filter((l) => !l.name.startsWith("__internal"))
			.map((l) => l.name)
			.join(", ")
		return `[Current areas of focus: ${names}]`
	}

	private sourceContext(): string {
		if (!this.currentSourceLabel) return ""
		return `[Currently absorbing: "${this.currentSourceLabel}"${this.currentSourceSummary ? ` — ${this.currentSourceSummary}` : ""}]`
	}

	private resolveName(id: string): string {
		const neuron = this.brain?.getNeuron(id)
		if (neuron?.name) return `"${neuron.name}"`
		if (neuron?.description) return `the one tracking ${neuron.description.slice(0, 60)}`
		return "an unnamed area"
	}

	private isInternalNeuron(id: string): boolean {
		const neuron = this.brain?.getNeuron(id)
		return neuron?.name?.startsWith("__internal") ?? false
	}

	attach(brain: Brain) {
		this.brain = brain
		this.brainPrompt = brain.prompt
		this.history = []
		this.buffer = []

		brain.on("brain:init:config:generated", (payload) => {
			const configs = (payload.configs as Array<{ name: string; description: string }>)
				.filter((c) => !c.name.startsWith("__internal"))
			const areas = configs.map((c) => `${c.name} (${c.description})`).join(", ")
			this.enqueue(
				`The mind chose ${configs.length} areas of focus: ${areas}.`,
			)
		})

		brain.on("brain:neuron:added", (payload) => {
			if ((payload.name as string)?.startsWith("__internal")) return
			this.enqueue(
				`${this.brainContext()}\nArea created: "${payload.name}" — focus: ${truncate(payload.instructions as string || "to be determined", 200)}.`,
			)
		})

		brain.on("brain:init:completed", () => {
			this.enqueue(
				`${this.brainContext()}\nAll areas are now active and ready.`,
			)
		})

		// Internal neuron setup — narrate once on first internal init
		brain.on("neuron:init:started", (payload) => {
			if (!this.isInternalNeuron(payload.neuronId as string)) return
			if (this.narratedInternalSetup) return
			this.narratedInternalSetup = true
			this.enqueue(
				`${this.brainContext()}\nThe deeper layers are now forming — internal systems that will cross-reference knowledge across areas and track blind spots.`,
			)
		})

		// Signals
		brain.on("brain:signal:received", (payload) => {
			const source = (payload.source as string).replace(/^user:/, "")
			this.enqueue(
				`Something caught the network's attention from ${source}: "${truncate(payload.description as string, 200)}"`,
			)
		})

		// Synthesized — react at all significance levels
		brain.on("neuron:synthesized", (payload) => {
			const isInternal = this.isInternalNeuron(payload.neuronId as string)
			const name = this.resolveName(payload.neuronId as string)
			const significance = payload.significance as string | undefined
			const evolution = payload.evolution as string | undefined

			if (isInternal) {
				this.enqueue(
					`The network's internal picture updated — cross-referencing what different areas know.`,
				)
				return
			}

			if (significance === "critical") {
				this.enqueue(
					`${this.sourceContext()}\n${name} had a major shift in understanding — significance: critical${evolution ? `, pattern: ${evolution}` : ""}.`,
				)
			} else if (significance === "notable") {
				this.enqueue(
					`${this.sourceContext()}\n${name} updated its understanding — significance: notable.`,
				)
			} else {
				this.enqueue(
					`${this.sourceContext()}\n${name} quietly absorbed new information.`,
				)
			}
		})

		// Health updates
		brain.on("neuron:health:updated", (payload) => {
			const isInternal = this.isInternalNeuron(payload.neuronId as string)
			if (isInternal) return

			const name = this.resolveName(payload.neuronId as string)
			const status = payload.status as string
			const previousStatus = payload.previousStatus as string | undefined
			const activation = payload.activation as number | undefined

			// Only narrate meaningful health changes
			if (previousStatus && previousStatus !== status) {
				this.enqueue(
					`${name} shifted from ${previousStatus} to ${status}${activation !== undefined ? ` (activation: ${Math.round(activation * 100)}%)` : ""}.`,
				)
			}
		})

		// Evaluator
		brain.on("evaluator:evaluation:started", (payload) => {
			this.enqueue(
				`${this.brainContext()}\nThe mind is pausing to reflect on ${payload.signalCount} thing(s) it has noticed — deciding whether to reorganize.`,
			)
		})

		brain.on("evaluator:evaluation:completed", (payload) => {
			const reasoningNote = payload.reasoning
				? `\nReasoning: ${payload.reasoning}`
				: ""
			if (payload.decisionCount > 0) {
				const decisions = (
					payload.decisions as Array<{ action: string; reasoning: string }>
				)
					.map((d) => `${d.action} — ${d.reasoning}`)
					.join("; ")
				this.enqueue(
					`${this.brainContext()}\nAfter reflecting, the mind decided to reorganize: ${decisions}${reasoningNote}`,
				)
			} else {
				this.enqueue(
					`${this.brainContext()}\nThe mind reflected but decided its current structure works fine.${reasoningNote}`,
				)
			}
		})

		brain.on("evolution:action:executed", (payload) => {
			const targets = (payload.targets as string[])
				.map((id) => this.resolveName(id))
				.join(", ")
			const newNames = (
				payload.result?.newNeuronIds as string[] | undefined
			)
				?.map((id) => this.resolveName(id))
				.join(", ")

			const msg: Record<string, string> = {
				create: `The mind opened a new area of thinking: ${newNames}. Why: ${payload.reasoning}`,
				merge: `The mind combined ${targets} into ${newNames}. Why: ${payload.reasoning}`,
				split: `The mind split ${targets} into ${newNames}. Why: ${payload.reasoning}`,
				delete: `The mind dropped ${targets}. Why: ${payload.reasoning}`,
				update: `The mind reshaped how it thinks about ${targets}. Why: ${payload.reasoning}`,
			}

			this.enqueue(
				msg[payload.action as string] ??
					`The mind changed ${targets}`,
			)
		})
	}

	private enqueue(eventDescription: string) {
		this.buffer.push(eventDescription)

		const config = this.phaseConfigs[this.phase]
		if (this.buffer.length >= config.bufferSize) {
			this.flush()
		}
	}

	private flush() {
		if (this.buffer.length === 0) return
		const batch = this.buffer.splice(0)
		this.processBuffer(batch)
	}

	private processBuffer(batch: string[]) {
		if (this.processing) {
			// Re-enqueue if already processing — will be picked up next flush
			this.buffer.unshift(...batch)
			return
		}

		this.processing = true
		this.generateComment(batch)
			.catch((err) => console.error("[Commentator] Error:", err))
			.finally(() => {
				this.processing = false
				// Process any events that accumulated while we were generating
				const config = this.phaseConfigs[this.phase]
				if (this.buffer.length >= config.bufferSize) {
					this.flush()
				}
			})
	}

	private async generateComment(batch: string[]) {
		if (!this.brain) return

		const recentHistory = this.history.slice(-6)
		const eventsBlock = batch.length === 1
			? batch[0]
			: batch.map((e, i) => `${i + 1}. ${e}`).join("\n")

		const prompt = [
			recentHistory.length > 0
				? `Your recent thoughts:\n${recentHistory.join("\n")}\n`
				: "",
			`What just happened:\n${eventsBlock}`,
			"",
			batch.length > 1
				? "React to the overall pattern, or SKIP:"
				: "React, or SKIP:",
		]
			.filter(Boolean)
			.join("\n")

		const config = this.phaseConfigs[this.phase]
		const systemPrompt = PHASE_PROMPTS[this.phase](this.brainPrompt)

		const { textStream } = streamText({
			model: this.model,
			system: systemPrompt,
			prompt,
			temperature: config.temperature,
			maxOutputTokens: 80,
		})

		let accumulated = ""

		for await (const delta of textStream) {
			accumulated += delta

			if (accumulated.trim() === "SKIP" || accumulated.trim().startsWith("SKIP")) {
				return
			}
		}

		if (accumulated.trim() === "") return

		const content = accumulated.trim()
		this.onComment(content)
		this.history.push(content)
	}

	detach() {
		// Flush any remaining buffered events
		this.flush()
		this.brain = null
		this.history = []
		this.buffer = []
		this.phase = "idle"
		this.narratedInternalSetup = false
	}
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s
}
