import type { CallSettings, LanguageModel, StreamTextResult, Tool } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import type { TokenUsage } from '../neurons/types'
import { generate, Output, stepCountIs, streamText } from '../llm'
import { buildSynthesisSystemPrompt } from './prompts/prompt.synthesis.system'
import type { BrainAskResult } from './types'

/**
 * Schema for the answer tool — delivers response + metadata in one call
 */
const answerSchema = z.object({
	response: z.string().describe('Your full answer to the question'),
	gaps: z.array(z.string()).describe('Knowledge gaps that could not be answered'),
})

type AnswerParams = z.infer<typeof answerSchema>

/**
 * A specialist the synthesis agent can query
 */
export interface SpecialistDef {
	id: string
	name: string
	description: string
	query: (question: string, options?: CallSettings) => Promise<{
		relevant: boolean
		relevance: number
		confidence: number
		insight: string
		gaps: string
	}>
}

/**
 * Options for synthesis
 */
export interface SynthesisOptions extends CallSettings {
	synthesisDirective?: string
	query: string
	specialists: SpecialistDef[]
	/** Optional consult tools for querying internal neurons during synthesis */
	consultTools?: Record<string, Tool>
}

/**
 * Result from synthesis
 */
export interface SynthesisResult {
	insight: string
	gaps: string[]
	sources: BrainAskResult['sources']
	usage: TokenUsage
	/**
	 * Set when the agent loop didn't reach `answer` cleanly and we had to
	 * recover (or couldn't). Always means something is off (cap reached,
	 * model looping, etc) — surface to the caller.
	 */
	degraded?: {
		reason: 'step_budget_recovered_via_fallback' | 'step_budget_exhausted_no_sources'
		message: string
	}
}

/**
 * Synthesis loop budget. The model is mechanically constrained to the
 * `answer` tool once stepNumber reaches FORCE_ANSWER_AT_STEP — without this,
 * weak models can burn the whole budget on querySpecialist calls and
 * return empty insights (#12). MAX leaves a recovery window after the
 * force kicks in.
 */
const MAX_SYNTHESIS_STEPS = 12
const FORCE_ANSWER_AT_STEP = 10

/**
 * Tracked specialist query result (for source building)
 */
interface SpecialistQueryRecord {
	id: string
	relevance: number
	confidence: number
	insight: string
}

/**
 * Synthesize an answer by querying specialists on demand.
 *
 * The LLM decides which specialists to query, what to ask each,
 * and when it has enough to answer. No pre-fetching.
 */
export async function synthesize(
	model: LanguageModel,
	options: SynthesisOptions,
): Promise<SynthesisResult> {
	const { synthesisDirective, query, specialists, consultTools, ...generateOptions } = options

	// Build specialist menu for tool description
	const specialistMenu = specialists
		.map((s) => `- ${s.id}: ${s.description || s.name}`)
		.join('\n')

	const specialistIds = new Set(specialists.map((s) => s.id))
	const specialistMap = new Map(specialists.map((s) => [s.id, s]))

	const queriedSpecialists: SpecialistQueryRecord[] = []
	// Refuse exact (id, question) repeats — eval showed weak models burning
	// 30-120 specialist calls against a 10-specialist menu by re-asking the
	// same questions. The error result nudges the model toward answering
	// or trying a different angle (#12).
	const askedKeys = new Set<string>()

	const querySpecialist = tool({
		description: `Query a specialist. Each sees one dimension of the knowledge.\n\n${specialistMenu}`,
		inputSchema: z.object({
			id: z.string().describe('Specialist ID to query'),
			question: z.string().describe('What to ask this specialist'),
		}),
		execute: async ({ id, question }) => {
			if (!specialistIds.has(id)) {
				return { error: `Unknown specialist: ${id}. Available: ${[...specialistIds].join(', ')}` }
			}
			const key = `${id}|${question.trim().toLowerCase()}`
			if (askedKeys.has(key)) {
				return {
					error: `Already asked "${id}" this exact question. Either ask a sharper follow-up, query a different specialist, or call \`answer\` with what you have.`,
				}
			}
			askedKeys.add(key)
			const specialist = specialistMap.get(id)!
			const result = await specialist.query(question, generateOptions)
			if (result.relevant) {
				queriedSpecialists.push({
					id,
					relevance: result.relevance,
					confidence: result.confidence,
					insight: result.insight,
				})
			}
			return {
				relevant: result.relevant,
				insight: result.insight,
				gaps: result.gaps || undefined,
			}
		},
	})

	const hasConsultTools = consultTools && Object.keys(consultTools).length > 0
	const system = buildSynthesisSystemPrompt(hasConsultTools, synthesisDirective)

	// `answer` has no execute fn — per ai-sdk loop-control docs, calling a
	// tool without an execute auto-terminates the loop. We pull the call
	// args from result.toolCalls / onStepFinish below.
	const answer = tool({
		description: 'Deliver your final answer and signal completion.',
		inputSchema: answerSchema,
	})

	const allTools: Record<string, Tool> = {
		querySpecialist,
		answer,
		...(hasConsultTools ? consultTools : {}),
	}

	const totalUsage: TokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	}

	let answerResult: AnswerParams | null = null
	let stepNum = 0

	console.log(`[synthesis] query: "${query.slice(0, 80)}"`)
	console.log(`[synthesis] specialists: ${specialists.map((s) => s.id).join(', ')}`)
	const t0 = Date.now()

	const result = await generate({
		model,
		system,
		prompt: query,
		tools: allTools,
		toolChoice: 'required',
		stopWhen: stepCountIs(MAX_SYNTHESIS_STEPS),
		prepareStep: ({ stepNumber }) => {
			// Force the model to call `answer` once we approach the cap.
			// activeTools removes `querySpecialist` from the menu so the
			// only legal action is to commit to a final answer.
			if (stepNumber >= FORCE_ANSWER_AT_STEP) {
				return {
					toolChoice: { type: 'tool', toolName: 'answer' },
					activeTools: ['answer'],
				}
			}
			return {}
		},
		onStepFinish: ({ text, usage, toolCalls }) => {
			stepNum++
			const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
			if (usage?.inputTokens != null && usage?.outputTokens != null) {
				totalUsage.inputTokens += usage.inputTokens
				totalUsage.outputTokens += usage.outputTokens
				totalUsage.totalTokens += usage.totalTokens ?? 0
			}
			// Log reasoning/text if present
			if (text) {
				console.log(`[synthesis] step ${stepNum} (${elapsed}s) reasoning: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`)
			}
			if (toolCalls) {
				for (const tc of toolCalls) {
					console.log(`[synthesis] step ${stepNum} (${elapsed}s) tool: ${tc.toolName}${tc.toolName === 'querySpecialist' ? ` → ${(tc.input as { id: string }).id}: "${(tc.input as { question: string }).question.slice(0, 100)}"` : ''}`)
					if (tc.toolName === 'answer') {
						answerResult = tc.input as AnswerParams
					}
				}
			}
		},
		...generateOptions,
	})

	console.log(`[synthesis] done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${stepNum} steps, ${totalUsage.totalTokens} tokens`)

	// Check final step for tool calls
	for (const tc of result.toolCalls) {
		if (tc.toolName === 'answer' && 'input' in tc) {
			answerResult = tc.input as AnswerParams
		}
	}

	const sources = queriedSpecialists.map((r) => ({
		neuronId: r.id,
		relevance: r.relevance,
		confidence: r.confidence,
		insight: r.insight,
	}))

	// Recovery path: prepareStep should make this nearly impossible, but if
	// the loop still ended without `answer` (transient error on the forced
	// step, etc), salvage via synthesizeDirect over the material we already
	// paid for. Better than returning ''.
	if (!answerResult) {
		if (queriedSpecialists.length > 0) {
			console.log(`[synthesis] step budget exhausted without answer — falling back to synthesizeDirect over ${queriedSpecialists.length} specialist(s)`)
			const fallback = await synthesizeDirect(model, {
				...generateOptions,
				synthesisDirective,
				query,
				specialistResults: queriedSpecialists.map((r) => ({
					id: r.id,
					relevance: r.relevance,
					confidence: r.confidence,
					insight: r.insight,
					gaps: '',
				})),
			})
			return {
				insight: fallback.insight,
				gaps: fallback.gaps,
				sources,
				usage: {
					inputTokens: totalUsage.inputTokens + fallback.usage.inputTokens,
					outputTokens: totalUsage.outputTokens + fallback.usage.outputTokens,
					totalTokens: totalUsage.totalTokens + fallback.usage.totalTokens,
				},
				degraded: {
					reason: 'step_budget_recovered_via_fallback',
					message: `Agent loop ended without calling answer; recovered via direct synthesis over ${queriedSpecialists.length} specialist result(s).`,
				},
			}
		}
		return {
			insight: '',
			gaps: [],
			sources,
			usage: totalUsage,
			degraded: {
				reason: 'step_budget_exhausted_no_sources',
				message: 'Agent loop ended without calling answer and no specialists were queried.',
			},
		}
	}

	return {
		insight: answerResult.response,
		gaps: answerResult.gaps,
		sources,
		usage: totalUsage,
	}
}

// ── Direct synthesis (shallow mode) ─────────────────────────────────────────

/**
 * Options for direct synthesis
 */
export interface DirectSynthesisOptions extends CallSettings {
	synthesisDirective?: string
	query: string
	/** Pre-queried specialist results (already resolved) */
	specialistResults: Array<{
		id: string
		relevance: number
		confidence: number
		insight: string
		gaps: string
	}>
	/** Global understanding text (from internal neurons) */
	globalUnderstanding?: string
}

const directAnswerSchema = z.object({
	response: z.string().describe('Your full answer to the question'),
	gaps: z.array(z.string()).describe('Knowledge gaps that could not be answered'),
})

/**
 * Single-shot synthesis — all specialist results already collected.
 * One LLM call, no tools, no agentic loop.
 */
export async function synthesizeDirect(
	model: LanguageModel,
	options: DirectSynthesisOptions,
): Promise<SynthesisResult> {
	const { synthesisDirective, query, specialistResults, globalUnderstanding, ...generateOptions } = options

	const t0 = Date.now()

	// Build context from pre-queried specialists
	const relevant = specialistResults.filter((s) => s.relevance > 0.1)
	console.log(`[synthesis:direct] query: "${query.slice(0, 80)}"`)
	console.log(`[synthesis:direct] ${relevant.length}/${specialistResults.length} relevant specialists`)

	const specialistSections = relevant
		.map((s) => `## ${s.id} (relevance: ${s.relevance}, confidence: ${s.confidence})\n${s.insight}${s.gaps ? `\n\nGaps: ${s.gaps}` : ''}`)
		.join('\n\n')

	const globalSection = globalUnderstanding
		? `\n\n## Global Context\n${globalUnderstanding}`
		: ''

	const directiveSection = synthesisDirective
		? `\n\n${synthesisDirective}`
		: ''

	const system = `You have specialist knowledge below. Synthesize an answer.

Speak from the evidence. If a specialist says "3 times in January," say that — don't smooth it into "frequently." Where specialists conflict, show both sides. Where they're silent, say so.

Never reference your internal structure, sources, confidence scores, or how you arrived at the answer.${directiveSection}

# Specialist Knowledge

${specialistSections}${globalSection}`

	const result = await generate({
		model,
		system,
		prompt: query,
		output: Output.object({ schema: directAnswerSchema }),
		repairSchema: directAnswerSchema,
		...generateOptions,
	})

	const output = result.output as z.infer<typeof directAnswerSchema>
	const usage: TokenUsage = {
		inputTokens: result.usage?.inputTokens ?? 0,
		outputTokens: result.usage?.outputTokens ?? 0,
		totalTokens: result.usage?.totalTokens ?? 0,
	}

	console.log(`[synthesis:direct] done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${usage.totalTokens} tokens`)

	return {
		insight: output.response,
		gaps: output.gaps,
		sources: relevant.map((s) => ({
			neuronId: s.id,
			relevance: s.relevance,
			confidence: s.confidence,
			insight: s.insight,
		})),
		usage,
	}
}

// ── Streaming synthesis (deep mode) ─────────────────────────────────────

/**
 * Stream an agentic synthesis — same tools as synthesize(), returns raw StreamTextResult.
 * Consumer sees querySpecialist tool-call/tool-result events in fullStream.
 */
export function synthesizeStream(
	model: LanguageModel,
	options: SynthesisOptions,
): StreamTextResult<any, any> {
	const { synthesisDirective, query, specialists, consultTools, ...generateOptions } = options

	const specialistMenu = specialists
		.map((s) => `- ${s.id}: ${s.description || s.name}`)
		.join('\n')

	const specialistIds = new Set(specialists.map((s) => s.id))
	const specialistMap = new Map(specialists.map((s) => [s.id, s]))

	const askedKeys = new Set<string>()

	const querySpecialist = tool({
		description: `Query a specialist. Each sees one dimension of the knowledge.\n\n${specialistMenu}`,
		inputSchema: z.object({
			id: z.string().describe('Specialist ID to query'),
			question: z.string().describe('What to ask this specialist'),
		}),
		execute: async ({ id, question }) => {
			if (!specialistIds.has(id)) {
				return { error: `Unknown specialist: ${id}. Available: ${[...specialistIds].join(', ')}` }
			}
			const key = `${id}|${question.trim().toLowerCase()}`
			if (askedKeys.has(key)) {
				return {
					error: `Already asked "${id}" this exact question. Either ask a sharper follow-up, query a different specialist, or call \`answer\` with what you have.`,
				}
			}
			askedKeys.add(key)
			const specialist = specialistMap.get(id)!
			const result = await specialist.query(question, generateOptions)
			return {
				relevant: result.relevant,
				insight: result.insight,
				gaps: result.gaps || undefined,
			}
		},
	})

	const hasConsultTools = consultTools && Object.keys(consultTools).length > 0
	const system = buildSynthesisSystemPrompt(hasConsultTools, synthesisDirective)

	// No execute fn — see synthesize() above.
	const answer = tool({
		description: 'Deliver your final answer and signal completion.',
		inputSchema: answerSchema,
	})

	const allTools: Record<string, Tool> = {
		querySpecialist,
		answer,
		...(hasConsultTools ? consultTools : {}),
	}

	return streamText({
		model,
		system,
		prompt: query,
		tools: allTools,
		toolChoice: 'required',
		stopWhen: stepCountIs(MAX_SYNTHESIS_STEPS),
		prepareStep: ({ stepNumber }) => {
			if (stepNumber >= FORCE_ANSWER_AT_STEP) {
				return {
					toolChoice: { type: 'tool', toolName: 'answer' },
					activeTools: ['answer'],
				}
			}
			return {}
		},
		...generateOptions,
	})
}

// ── Streaming synthesis (direct/shallow mode) ───────────────────────────

/**
 * Stream a single-shot synthesis — all specialist results already collected.
 * Plain text output (no structured JSON) so textStream gives the consumer raw answer text.
 */
export function synthesizeDirectStream(
	model: LanguageModel,
	options: DirectSynthesisOptions,
): StreamTextResult<any, any> {
	const { synthesisDirective, query, specialistResults, globalUnderstanding, ...generateOptions } = options

	const relevant = specialistResults.filter((s) => s.relevance > 0.1)

	const specialistSections = relevant
		.map((s) => `## ${s.id} (relevance: ${s.relevance}, confidence: ${s.confidence})\n${s.insight}${s.gaps ? `\n\nGaps: ${s.gaps}` : ''}`)
		.join('\n\n')

	const globalSection = globalUnderstanding
		? `\n\n## Global Context\n${globalUnderstanding}`
		: ''

	const directiveSection = synthesisDirective
		? `\n\n${synthesisDirective}`
		: ''

	const system = `You have specialist knowledge below. Synthesize an answer.

Speak from the evidence. If a specialist says "3 times in January," say that — don't smooth it into "frequently." Where specialists conflict, show both sides. Where they're silent, say so.

Never reference your internal structure, sources, confidence scores, or how you arrived at the answer.${directiveSection}

# Specialist Knowledge

${specialistSections}${globalSection}`

	return streamText({
		model,
		system,
		prompt: query,
		...generateOptions,
	})
}
