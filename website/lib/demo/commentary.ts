/**
 * Commentary — maps Brain events to human-readable commentary strings.
 * No LLM calls. Pure functions.
 */
import type { Brain } from "@unbody/adapt"

// --- Internal neuron definitions (always the same four) ---

export const INTERNAL_NEURONS: Record<string, { name: string; description: string }> = {
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

export function isInternalNeuron(id: string): boolean {
	return id in INTERNAL_NEURONS
}

export function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s
}

function resolveName(brain: Brain, id: string): string {
	const neuron = brain.getNeuron(id)
	if (neuron?.name) return neuron.name
	if (neuron?.description) return `the one tracking ${neuron.description.slice(0, 60)}`
	return "an unnamed area"
}

// --- Event → commentary mapping ---

export interface CommentaryResult {
	text: string
	/** Priority events (evaluator, evolution) should never be dropped from the queue */
	priority?: boolean
	/** Where this commentary should appear */
	category: "progress" | "evolution"
}

/**
 * Returns a commentary string for the given event, or null if the event
 * should be silent (not shown in the commentary panel).
 */
export function commentaryFromEvent(
	type: string,
	payload: Record<string, unknown>,
	brain: Brain,
	flags: { narratedInternalSetup: boolean },
): CommentaryResult | null {
	switch (type) {
		// --- Birth ---

		case "brain:init:config:generated": {
			const configs = (payload.configs as Array<{ name: string; description: string }>)
				.filter((c) => !c.name.startsWith("__internal"))
			const areas = configs.map((c) => c.name).join(", ")
			return { text: `Choosing ${configs.length} areas of focus: ${areas}.`, category: "progress" }
		}

		case "brain:neuron:added": {
			const name = payload.name as string
			if (name?.startsWith("__internal")) return null
			const neuronId = payload.neuronId as string
			const neuron = brain.getNeuron(neuronId)
			const desc = neuron?.description
			const instructions = payload.instructions as string | undefined
			const detail = desc || instructions?.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim()
			return {
				text: `Setting up ${name}${detail ? ` — ${truncate(detail, 150)}` : ""}.`,
				category: "progress",
			}
		}

		case "neuron:init:started": {
			const neuronId = payload.neuronId as string
			if (!isInternalNeuron(neuronId)) return null
			if (flags.narratedInternalSetup) return null
			flags.narratedInternalSetup = true
			return {
				text: "Deeper layers forming — global understanding, pattern tracking, gap detection.",
				category: "progress",
			}
		}

		case "brain:init:completed":
			return { text: "All areas active and ready.", category: "progress" }

		// --- Injection: the star ---

		case "neuron:synthesized": {
			const neuronId = payload.neuronId as string
			if (isInternalNeuron(neuronId)) return null
			const evolution = payload.evolution as string | undefined
			if (!evolution) return null
			return { text: evolution, category: "progress" }
		}

		// --- Injection: signals ---

		case "brain:signal:received": {
			const source = payload.source as string
			// Only show user-initiated signals, not internal system signals
			if (!source.startsWith("user:")) return null
			const label = source.replace(/^user:/, "")
			const description = payload.description as string
			return { text: `Signal from ${label}: "${truncate(description, 200)}"`, category: "evolution" }
		}

		// --- Injection: health changes ---

		case "neuron:health:updated": {
			const neuronId = payload.neuronId as string
			if (isInternalNeuron(neuronId)) return null
			const status = payload.status as string
			const previousStatus = payload.previousStatus as string | undefined
			if (!previousStatus || previousStatus === status) return null
			const name = resolveName(brain, neuronId)
			return { text: `${name}: ${previousStatus} → ${status}`, category: "progress" }
		}

		// --- Evaluator ---

		case "evaluator:evaluation:started": {
			const signalCount = payload.signalCount as number
			return {
				text: `Pausing to reflect on ${signalCount} signal${signalCount !== 1 ? "s" : ""}...`,
				priority: true,
				category: "evolution",
			}
		}

		case "evaluator:evaluation:completed": {
			const decisionCount = payload.decisionCount as number
			if (decisionCount > 0) {
				const decisions = (payload.decisions as Array<{ action: string; reasoning: string }>)
					.map((d) => `${d.action} — ${d.reasoning}`)
					.join("; ")
				return {
					text: `Reorganizing: ${decisions}`,
					priority: true,
					category: "evolution",
				}
			}
			const reasoning = payload.reasoning as string | undefined
			return {
				text: `Reflected — current structure works fine.${reasoning ? ` ${reasoning}` : ""}`,
				priority: true,
				category: "evolution",
			}
		}

		// --- Evolution actions ---

		case "evolution:action:executed": {
			const action = payload.action as string
			const reasoning = payload.reasoning as string
			const targets = (payload.targets as string[])
				.map((id) => resolveName(brain, id))
				.join(", ")
			const result = payload.result as Record<string, unknown> | undefined
			const newNames = (result?.newNeuronIds as string[] | undefined)
				?.map((id) => resolveName(brain, id))
				.join(", ")

			const templates: Record<string, string> = {
				create: `New area: ${newNames}. ${reasoning}`,
				merge: `Combined ${targets} into ${newNames}. ${reasoning}`,
				split: `Split ${targets} into ${newNames}. ${reasoning}`,
				delete: `Dropped ${targets}. ${reasoning}`,
				update: `Reshaped ${targets}. ${reasoning}`,
			}

			return {
				text: templates[action] ?? `Changed ${targets}.`,
				priority: true,
				category: "evolution",
			}
		}

		default:
			return null
	}
}
