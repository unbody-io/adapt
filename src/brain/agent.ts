import type { CallSettings, LanguageModel, Tool } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import type { TokenUsage } from '../learners/types'
import { generate, hasToolCall, Output, stepCountIs } from '../llm'
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
	/** Optional consult tools for querying internal learners during synthesis */
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
}

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

	const answer = tool({
		description: 'Deliver your final answer and signal completion.',
		inputSchema: answerSchema,
		execute: async (params) => params,
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
		stopWhen: [hasToolCall('answer'), stepCountIs(12)],
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

	return {
		insight: answerResult?.response || '',
		gaps: answerResult?.gaps ?? [],
		sources: queriedSpecialists.map((r) => ({
			learnerId: r.id,
			relevance: r.relevance,
			confidence: r.confidence,
			insight: r.insight,
		})),
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
	/** Global understanding text (from internal learners) */
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
			learnerId: s.id,
			relevance: s.relevance,
			confidence: s.confidence,
			insight: s.insight,
		})),
		usage,
	}
}
