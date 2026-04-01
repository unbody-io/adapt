/**
 * Commentator LLM
 *
 * Narrates the Brain's activity like a person thinking aloud.
 * Streams text token-by-token over SSE.
 */
import { streamText, type LanguageModel } from "ai"
import type { Brain } from "@unbody/adapt"
import type { SSESender } from "./types"

const SYSTEM_PROMPT = `You're watching a mind learn in real time. You observe two things:

1. **What it's learning** — the actual content, themes, patterns, contradictions in the information flowing in. This is the interesting part. React to the substance: "Wait, that's the third time pricing came up — but always from different angles." You're a curious person noticing what's interesting in the data.

2. **How it's reshaping itself** — sometimes the mind decides it needs to reorganize how it thinks. It might split a broad topic into two, merge overlapping ones, create a new focus area, or drop one that isn't useful. When this happens, react to *why* it makes sense (or doesn't), not the mechanics. "Makes sense to separate those — they were pulling in different directions." Never say "specialist" or "restructuring" — talk about it like a mind reorganizing its thinking.

You are not a system monitor. You are a curious, thoughtful person watching something think and learn. Talk about what you notice, what surprises you, what connects to something earlier.

Examples:
- "Pricing keeps coming up, but always from a different angle. Enterprise vs. startup vs. freelancer — three different frustrations."
- "That contradicts what came in earlier about onboarding. Interesting tension."
- "Splitting that into two makes sense — it was trying to track both technical debt and user complaints, and those are really different problems."
- "Someone just pushed it toward sentiment analysis. Curious where that leads."
- "Not sure what to make of this yet."
- "Five updates just came in and they're all circling the same theme — collaboration friction."

Rules:
- 1 sentence, max 2. Keep it tight. Natural and human. No system jargon.
- Never say "specialist", "evaluator", "signal", "restructuring", "evolution", or "neuron". Talk about ideas, topics, and thinking.
- Never narrate process mechanics ("processing", "initializing", "synthesizing").
- Never reference raw IDs or technical identifiers. If you don't know a name, describe what it seems to be about.
- Vary your openings. No "Okay so" or "Ok so".
- SKIP if routine, boring, or nothing new to say. Be selective.
- Connect dots with prior observations. That's the whole point.`

export class Commentator {
	private model: LanguageModel
	private brain: Brain | null = null
	private history: string[] = []
	private broadcast: SSESender
	private queue: Promise<void> = Promise.resolve()
	private fullText = ""

	constructor(model: LanguageModel, broadcast: SSESender) {
		this.model = model
		this.broadcast = broadcast
	}

	private brainContext(): string {
		if (!this.brain) return ""
		const neurons = this.brain.neurons
		if (neurons.size === 0) return ""
		const names = Array.from(neurons.values()).map((l) => l.name).join(", ")
		return `[Current areas of focus: ${names}]`
	}

	private resolveName(id: string): string {
		const neuron = this.brain?.getNeuron(id)
		if (neuron?.name) return `"${neuron.name}"`
		if (neuron?.description) return `the one tracking ${neuron.description.slice(0, 60)}`
		return "an unnamed area"
	}

	attach(brain: Brain) {
		this.brain = brain
		this.history = []
		this.fullText = ""

		// --- Birth ---

		brain.on("brain:init:config:generated", (payload) => {
			const configs = payload.configs as Array<{
				name: string
				description: string
			}>
			const areas = configs.map((c) => c.name).join(", ")
			this.enqueue("brain:init:config:generated",
				`WHAT HAPPENED: The mind decided to organize around ${configs.length} areas: ${areas}`,
			)
		})

		brain.on("brain:neuron:added", (payload) => {
			this.enqueue("brain:neuron:added",
				`${this.brainContext()}\nWHAT HAPPENED: A new area of thinking opened up — "${payload.name}". It will focus on: ${payload.instructions?.slice(0, 200) || "to be determined"}.`,
			)
		})

		brain.on("brain:init:completed", () => {
			this.enqueue("brain:init:completed",
				`${this.brainContext()}\nWHAT HAPPENED: All areas of thinking are now active and ready to take in information.`,
			)
		})

		// --- Signals ---

		brain.on("brain:signal:received", (payload) => {
			const source = (payload.source as string).replace(/^user:/, "")
			this.enqueue("brain:signal:received",
				`WHAT HAPPENED: External input from ${source}: "${truncate(payload.description as string, 200)}"`,
			)
		})

		// --- Living: Synthesis ---

		brain.on("neuron:synthesized", (payload) => {
			const sig = (payload.significance as unknown as number) ?? 0
			if (sig < 0.4) return

			const name = this.resolveName(payload.neuronId)
			this.enqueue("neuron:synthesized",
				`WHAT HAPPENED: ${name} updated its understanding: ${truncate(stringify(payload.newUnderstanding), 300)}`,
			)
		})

		// --- Living: Evolution ---

		brain.on("evaluator:evaluation:started", (payload) => {
			this.enqueue("evaluator:evaluation:started",
				`${this.brainContext()}\nWHAT HAPPENED: The mind is pausing to reflect on ${payload.signalCount} thing(s) it has noticed — deciding whether to reorganize how it thinks.`,
			)
		})

		brain.on("evaluator:evaluation:completed", (payload) => {
			const reasoningNote = payload.reasoning
				? `\nEVALUATOR REASONING: ${payload.reasoning}`
				: ""
			if (payload.decisionCount > 0) {
				const decisions = (
					payload.decisions as Array<{
						action: string
						reasoning: string
					}>
				)
					.map((d) => `${d.action} — ${d.reasoning}`)
					.join("; ")
				this.enqueue("evaluator:evaluation:completed",
					`${this.brainContext()}\nWHAT HAPPENED: After reflecting, the mind decided to reorganize: ${decisions}${reasoningNote}`,
				)
			} else {
				this.enqueue("evaluator:evaluation:completed",
					`${this.brainContext()}\nWHAT HAPPENED: The mind reflected on recent inputs but decided its current structure works fine.${reasoningNote}`,
				)
			}
		})

		brain.on("evaluator:evaluation:failed", (payload) => {
			this.enqueue("evaluator:evaluation:failed",
				`WHAT HAPPENED: Something went wrong while the mind was reflecting: ${payload.error}`,
			)
		})

		brain.on("evolution:action:started", (payload) => {
			const targets = (payload.targets as string[])
				.map((id) => this.resolveName(id))
				.join(", ")
			this.enqueue("evolution:action:started",
				`${this.brainContext()}\nWHAT HAPPENED: The mind is about to ${payload.action} ${targets}.`,
			)
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
				create: `WHAT HAPPENED: The mind opened a new area of thinking: ${newNames}. Why: ${payload.reasoning}`,
				merge: `WHAT HAPPENED: The mind combined ${targets} into ${newNames}. Why: ${payload.reasoning}`,
				split: `WHAT HAPPENED: The mind split ${targets} into ${newNames}. Why: ${payload.reasoning}`,
				delete: `WHAT HAPPENED: The mind dropped ${targets}. Why: ${payload.reasoning}`,
				update: `WHAT HAPPENED: The mind reshaped how it thinks about ${targets}. Why: ${payload.reasoning}`,
			}

			this.enqueue("evolution:action:executed",
				msg[payload.action as string] ??
					`WHAT HAPPENED: The mind changed ${targets}`,
			)
		})

		brain.on("evolution:action:failed", (payload) => {
			const targets = (payload.targets as string[])
				.map((id) => this.resolveName(id))
				.join(", ")
			this.enqueue("evolution:action:failed",
				`WHAT HAPPENED: The mind tried to ${payload.action} ${targets} but failed: ${payload.error}`,
			)
		})
	}

	private enqueue(eventName: string, eventDescription: string) {
		console.log("[Commentator] Enqueued:", eventName, eventDescription.slice(0, 80))
		this.queue = this.queue
			.then(() => this.processEvent(eventName, eventDescription))
			.catch((err) => console.error("[Commentator] Queue error:", err))
	}

	private async processEvent(eventName: string, eventDescription: string) {
		if (!this.brain) return

		try {
			console.log("[Commentator] Processing:", eventDescription.slice(0, 80))
			const recentHistory = this.history
				.slice(-10)
				.join("\n")

			const prompt = [
				recentHistory
					? `Prior thoughts:\n${recentHistory}\n`
					: "",
				eventDescription,
				"",
				"React naturally, or SKIP:",
			]
				.filter(Boolean)
				.join("\n")

			const { textStream } = streamText({
				model: this.model,
				system: SYSTEM_PROMPT,
				prompt,
				temperature: 0.7,
				maxOutputTokens: 60,
			})

			let accumulated = ""
			let skipped = false

			this.broadcast("commentary:start", { event: eventName })

			for await (const delta of textStream) {
				accumulated += delta

				// Check for SKIP early
				if (accumulated.trim() === "SKIP" || accumulated.trim().startsWith("SKIP")) {
					skipped = true
					break
				}

				// Stream each delta to clients
				this.broadcast("commentary:delta", { delta })
			}

			if (skipped || accumulated.trim() === "") {
				this.broadcast("commentary:cancel", {})
				return
			}

			const content = accumulated.trim()
			console.log("[Commentator] Streamed:", content.slice(0, 100))

			this.broadcast("commentary:end", {})
			this.fullText += (this.fullText ? "\n\n" : "") + content
			this.history.push(content)
		} catch (error) {
			console.error("[Commentator] Error:", error)
		}
	}

	getFullText(): string {
		return this.fullText
	}

	detach() {
		this.brain = null
		this.history = []
		this.fullText = ""
	}
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s
}

function stringify(u: unknown): string {
	if (typeof u === "string") return u
	return JSON.stringify(u)
}
