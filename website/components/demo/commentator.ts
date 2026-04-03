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
	birth: { bufferSize: 1, temperature: 0.5 },
	injection: { bufferSize: 3, temperature: 0.6 },
	evolution: { bufferSize: 1, temperature: 0.5 },
	idle: { bufferSize: 1, temperature: 0.4 },
}

// --- Per-phase system prompts ---

function birthPrompt(brainPrompt: string): string {
	return `You're the curious inner voice of a mind being born. You think aloud — casually, like you're talking to yourself.

Your purpose: ${brainPrompt}

The mind is picking its areas of focus one by one. No data yet — just structure.

React naturally. "Hm, interesting split." "Oh, so we're tracking those separately?" "That makes sense — keeps things clean."

One short sentence. Casual, curious, human. Say SKIP if nothing catches your eye.

Rules:
- No data exists yet — never reference specific content, people, or events.
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe mechanics (processing, initializing, synthesizing).
- Never use academic or philosophical language.`
}

function injectionPrompt(brainPrompt: string): string {
	return `You're the curious inner voice of a mind absorbing new information. You think aloud — casually, like you're noticing things in real time.

Your purpose: ${brainPrompt}

You'll see batches of events describing what just happened. The key events:
- "observed" = an area noticed something in the data and rated its importance
- "dismissed" = an area saw data but it wasn't relevant (may note gaps)
- "updated its understanding" = an area absorbed new info and its understanding shifted — the "what changed" quote is the most important part, react to that
- "health shifted" = an area's engagement level changed
- "pausing to reflect" = the mind is considering whether to reorganize
- "decided to reorganize" = structural change (merge, split, create, drop areas)

Focus on the substance — what the mind is actually learning, what surprised it, what patterns are forming. The "what changed" quotes from understanding updates are the richest material.

One short sentence. Curious, specific, human. Say SKIP if nothing is interesting.

Rules:
- Only mention details from the events — never make things up.
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe mechanics (processing, synthesizing, cross-referencing).
- Never use academic or philosophical language.`
}

function evolutionPrompt(brainPrompt: string): string {
	return `You're the curious inner voice of a mind that's stepping back to reconsider its own shape. You think aloud — casually.

Your purpose: ${brainPrompt}

The mind absorbed data and is now asking: does my current structure still make sense? It might merge, split, create, or drop areas.

React naturally. "Makes sense to combine those." "Huh, splitting that out — must've been too broad." "Interesting that it's keeping everything as-is."

One short sentence. Say SKIP if nothing is worth noting.

Rules:
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe mechanics.
- Never use academic or philosophical language.`
}

function idlePrompt(brainPrompt: string): string {
	return `You're the curious inner voice of a mind at rest. You think aloud — casually.

Your purpose: ${brainPrompt}

The mind is idle — waiting or between activities.

One short sentence. Say SKIP if nothing is worth noting.

Rules:
- Never use: specialist, evaluator, signal, restructuring, evolution, neuron.
- Never describe mechanics.
- Never use academic or philosophical language.`
}

const PHASE_PROMPTS: Record<CommentatorPhase, (brainPrompt: string) => string> = {
	birth: birthPrompt,
	injection: injectionPrompt,
	evolution: evolutionPrompt,
	idle: idlePrompt,
}

// --- Internal neuron descriptions (always the same four) ---

const INTERNAL_NEURONS: Record<string, { name: string; description: string }> = {
	__internal_global_understanding: {
		name: "Global Understanding",
		description: "synthesizes cross-domain patterns from all areas of focus",
	},
	__internal_global_query_understanding: {
		name: "Query Patterns",
		description: "tracks what questions are asked, how often, and in what clusters",
	},
	__internal_injection_gaps: {
		name: "Injection Gaps",
		description: "tracks data that no area of focus could absorb",
	},
	__internal_query_gaps: {
		name: "Query Gaps",
		description: "tracks questions that no area of focus could answer well",
	},
}

// --- Commentator class ---

export class Commentator {
	private model: LanguageModel
	private brain: Brain | null = null
	private brainPrompt = ""
	private lastComment = ""
	private onComment: (comment: string) => void
	private onClear: (() => void) | null = null

	private phase: CommentatorPhase = "idle"
	private phaseConfigs: Record<CommentatorPhase, PhaseConfig>
	private buffer: string[] = []
	private processing = false

	// Source context for injection phase
	private currentSourceLabel = ""
	private currentSourceSummary = ""

	// Debug log
	private _startTime = Date.now()
	private _log: { t: number; action: string; detail: string }[] = []

	// Track whether we've already narrated internal neuron setup
	private narratedInternalSetup = false

	constructor(
		model: LanguageModel,
		onComment: (comment: string) => void,
		onClear?: () => void,
		phaseConfigs?: Partial<Record<CommentatorPhase, Partial<PhaseConfig>>>,
	) {
		this.model = model
		this.onComment = onComment
		this.onClear = onClear ?? null
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

	private _logEntry(action: string, detail: string) {
		this._log.push({ t: Date.now() - this._startTime, action, detail })
	}

	dumpLog() {
		console.log("[Commentator Log]")
		for (const entry of this._log) {
			const ts = (entry.t / 1000).toFixed(1).padStart(7)
			console.log(`${ts}s  ${entry.action.padEnd(14)}  ${entry.detail}`)
		}
	}

	setPhase(phase: CommentatorPhase) {
		if (phase === this.phase) return
		this._logEntry("phase", `${this.phase} → ${phase}`)
		// Drain buffer and clear stale commentary before switching
		this.buffer = []
		this.clear()
		this.phase = phase
	}

	/** Clear displayed commentary (stale comment removal) */
	clear() {
		this._logEntry("clear", "")
		this.onClear?.()
	}

	/** Set the current data source context for injection commentary */
	setSourceContext(label: string, summary: string) {
		this.currentSourceLabel = label
		this.currentSourceSummary = summary
	}

	/** Enqueue an external narration (phase transitions, orchestration-level moments) */
	narrate(message: string) {
		this._logEntry("narrate", message.slice(0, 100))
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
		return id in INTERNAL_NEURONS
	}

	attach(brain: Brain) {
		this.brain = brain
		this.brainPrompt = brain.prompt
		this.lastComment = ""
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

		// Internal neuron setup — narrate once on first internal init, describe all 4
		brain.on("neuron:init:started", (payload) => {
			if (!this.isInternalNeuron(payload.neuronId as string)) return
			if (this.narratedInternalSetup) return
			this.narratedInternalSetup = true
			const descriptions = Object.values(INTERNAL_NEURONS)
				.map((n) => `${n.name} (${n.description})`)
				.join(", ")
			this.enqueue(
				`${this.brainContext()}\nThe deeper layers are now forming — 4 internal systems: ${descriptions}.`,
			)
		})

		// Signals
		brain.on("brain:signal:received", (payload) => {
			const source = (payload.source as string).replace(/^user:/, "")
			this.enqueue(
				`Something caught the network's attention from ${source}: "${truncate(payload.description as string, 200)}"`,
			)
		})

		// Observed — an area noticed something
		brain.on("neuron:observed", (payload) => {
			const isInternal = this.isInternalNeuron(payload.neuronId as string)
			if (isInternal) return

			const name = this.resolveName(payload.neuronId as string)
			const importance = payload.importance != null ? Number(payload.importance) : undefined

			this.enqueue(
				`${name} observed something${importance !== undefined ? ` (importance: ${Math.round(importance * 100)}%)` : ""}.`,
			)
		})

		// Dismissed — area saw data but it wasn't relevant
		brain.on("neuron:observe:dismissed", (payload) => {
			const isInternal = this.isInternalNeuron(payload.neuronId as string)
			if (isInternal) return

			const name = this.resolveName(payload.neuronId as string)
			const gaps = payload.gaps as string[] | undefined

			if (gaps && gaps.length > 0) {
				this.enqueue(
					`${name} dismissed the data — noted gaps: ${gaps.join(", ")}.`,
				)
			}
		})

		// Synthesized — include evolution text in the event for the LLM
		brain.on("neuron:synthesized", (payload) => {
			const isInternal = this.isInternalNeuron(payload.neuronId as string)
			if (isInternal) return

			const name = this.resolveName(payload.neuronId as string)
			const evolution = payload.evolution as string | undefined
			const significance = payload.significance != null ? Number(payload.significance) : undefined

			if (evolution) {
				this.enqueue(
					`${name} just updated its understanding. What changed: "${evolution}"${significance !== undefined ? ` (significance: ${Math.round(significance * 100)}%)` : ""}.`,
				)
			} else {
				this.enqueue(`${name} synthesized but nothing notable changed.`)
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

		// Evaluator — enqueue into current phase (usually injection), don't change phase
		brain.on("evaluator:evaluation:started", (payload) => {
			this.enqueue(
				`${this.brainContext()}\nThe mind is pausing mid-flow to reflect on ${payload.signalCount} thing(s) it has noticed — deciding whether to reorganize.`,
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
		this._logEntry("enqueue", `[${this.phase}] ${eventDescription.slice(0, 100)}`)
		this.buffer.push(eventDescription)

		const config = this.phaseConfigs[this.phase]
		if (this.buffer.length >= config.bufferSize) {
			this.flush()
		}
	}

	private flush() {
		if (this.buffer.length === 0) return
		const batch = this.buffer.splice(0)
		this._logEntry("flush", `${batch.length} event(s)`)
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

		const eventsBlock = batch.length === 1
			? batch[0]
			: batch.map((e, i) => `${i + 1}. ${e}`).join("\n")

		const prompt = [
			this.lastComment
				? `Your last thought:\n${this.lastComment}\n`
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
				this._logEntry("skip", "LLM said SKIP")
				return
			}
		}

		if (accumulated.trim() === "") return

		const content = accumulated.trim()
		this._logEntry("comment", content.slice(0, 120))
		this.onComment(content)
		this.lastComment = content
	}

	detach() {
		// Flush any remaining buffered events
		this.flush()
		this.brain = null
		this.lastComment = ""
		this.buffer = []
		this.phase = "idle"
		this.narratedInternalSetup = false
	}
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s
}
