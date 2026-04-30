/**
 * Text understand phase
 *
 * Updates understanding based on buffered observations.
 * Uses identity generation + system prompt pattern.
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { generate, Output, stepCountIs, tool } from '../../../llm'
import type { Significance } from '../../types'
import type { Strategy } from '../strategies'
import { understandAdjustPromptTemplate } from './prompts/adjust'
import { understandIdentityPromptTemplate } from './prompts/identity'
import { understandSystemPromptTemplate } from './prompts/system'
import { understandUserPromptTemplate } from './prompts/user'
import type { UnderstandIdentity } from './schema.identity'
import { understandIdentitySchema } from './schema.identity'
import { understandOutputSchema } from './schema.output'
import type {
	UnderstandCallbacks,
	UnderstandContext,
	UnderstandOutput,
} from './types'

/**
 * Result from understand init
 */
export interface UnderstandInitResult {
	identity: UnderstandIdentity
	systemPrompt: string
}

/**
 * Initialize text understand phase - generates identity and system prompt
 */
export async function initUnderstand(
	model: LanguageModel,
	instructions: string,
	strategy: Strategy,
): Promise<UnderstandInitResult> {
	const prompt = understandIdentityPromptTemplate(instructions)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: understandIdentitySchema }),
		repairSchema: understandIdentitySchema,
	})

	const systemPrompt = understandSystemPromptTemplate(identity, strategy)

	return { identity, systemPrompt }
}

/**
 * Adjust text understand phase — evolves identity from a directive
 *
 * Unlike initUnderstand (which generates from scratch), this shows the LLM
 * the current identity so it can make incremental adjustments.
 *
 * @param model - Language model to use
 * @param directive - Natural language directive describing what to change
 * @param newInstructions - The already-resolved new instructions
 * @param currentIdentity - The current understand identity
 * @param strategy - The synthesis strategy
 * @returns Adjusted identity and system prompt
 */
export async function adjustUnderstand(
	model: LanguageModel,
	directive: string,
	newInstructions: string,
	currentIdentity: UnderstandIdentity,
	strategy: Strategy,
): Promise<UnderstandInitResult> {
	const prompt = understandAdjustPromptTemplate(
		directive,
		newInstructions,
		currentIdentity,
	)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: understandIdentitySchema }),
		repairSchema: understandIdentitySchema,
	})

	const systemPrompt = understandSystemPromptTemplate(identity, strategy)

	return { identity, systemPrompt }
}

/**
 * Execute text understand phase
 */
export async function understand(
	model: LanguageModel,
	systemPrompt: string,
	context: UnderstandContext,
	callbacks?: UnderstandCallbacks,
): Promise<UnderstandOutput> {
	try {
		const prompt = understandUserPromptTemplate(
			context.currentUnderstanding,
			context.observations,
		)

		const result = await generate({
			model,
			system: systemPrompt,
			prompt,
			output: Output.object({ schema: understandOutputSchema }),
			repairSchema: understandOutputSchema,
		})

		// Emit thinking if available
		if (callbacks?.onThinking && result.reasoning) {
			const thoughts = result.reasoning.map((r: { text: string }) => r.text)
			callbacks.onThinking(thoughts)
		}

		const data = result.output
		if (data.status === 'synthesized') {
			return {
				status: 'synthesized',
				newUnderstanding: data.newUnderstanding ?? '',
				significance: data.significance ?? 'routine',
				evolution: data.evolution ?? '',
				reasoning: data.reasoning,
				usage: result.usage,
			}
		} else {
			return {
				status: 'dismissed',
				output: data.output ?? 'No changes needed',
				usage: result.usage,
			}
		}
	} catch (error) {
		return {
			status: 'error',
			output: null,
			error,
		}
	}
}

// ── Adjust understanding content (agentic tool-based) ──────────────────────

const ADJUST_MAX_STEPS = 15

interface AdjustUnderstandingResult {
	status: 'synthesized' | 'dismissed'
	newUnderstanding: string
	evolution: string
	significance: Significance
}

/**
 * Adjust existing understanding content via a directive using agentic editing tools.
 * The model reads its understanding, reasons about what to change, and uses tools
 * to make surgical edits — or rewrites entirely for major restructuring.
 */
export async function adjustUnderstandingContent(
	model: LanguageModel,
	directive: string,
	currentUnderstanding: string,
	instructions: string,
): Promise<AdjustUnderstandingResult> {
	// In-memory buffer the tools operate on
	let buffer = currentUnderstanding

	const tools = {
		readUnderstanding: tool({
			description: 'See the full current understanding text.',
			inputSchema: z.object({}),
			execute: async () => ({ text: buffer }),
		}),

		searchUnderstanding: tool({
			description:
				'Search for passages in the understanding. Returns exact text snippets that can be passed directly to removeSection or replaceSection.',
			inputSchema: z.object({
				query: z.string().describe('Text or pattern to search for'),
			}),
			execute: async (params) => {
				// Split into chunks by newlines first, then by sentences within each line
				const chunks: string[] = []
				for (const line of buffer.split('\n')) {
					if (!line.trim()) continue
					// Split long lines into sentences, but keep short lines whole
					const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
					if (sentences.length > 1) {
						chunks.push(...sentences)
					} else {
						chunks.push(line)
					}
				}
				const q = params.query.toLowerCase()
				const matches = chunks.filter((c) => c.toLowerCase().includes(q))
				return {
					matchCount: matches.length,
					matches,
				}
			},
		}),

		replaceSection: tool({
			description: 'Find and replace a section of text in the understanding.',
			inputSchema: z.object({
				oldText: z.string().describe('The exact text to find and replace'),
				newText: z.string().describe('The replacement text'),
			}),
			execute: async (params) => {
				if (!buffer.includes(params.oldText)) {
					return { success: false, error: 'oldText not found in understanding' }
				}
				buffer = buffer.replace(params.oldText, params.newText)
				return { success: true }
			},
		}),

		removeSection: tool({
			description: 'Remove a section of text from the understanding.',
			inputSchema: z.object({
				text: z.string().describe('The exact text to remove'),
			}),
			execute: async (params) => {
				if (!buffer.includes(params.text)) {
					return { success: false, error: 'Text not found in understanding' }
				}
				buffer = buffer.replace(params.text, '').replace(/\n{3,}/g, '\n\n')
				return { success: true }
			},
		}),

		insertSection: tool({
			description:
				'Insert text relative to an anchor point in the understanding.',
			inputSchema: z.object({
				position: z
					.enum(['before', 'after'])
					.describe('Insert before or after the anchor'),
				anchor: z
					.string()
					.describe('The existing text to position relative to'),
				newText: z.string().describe('The text to insert'),
			}),
			execute: async (params) => {
				if (!buffer.includes(params.anchor)) {
					return {
						success: false,
						error: 'Anchor text not found in understanding',
					}
				}
				if (params.position === 'before') {
					buffer = buffer.replace(
						params.anchor,
						`${params.newText}\n${params.anchor}`,
					)
				} else {
					buffer = buffer.replace(
						params.anchor,
						`${params.anchor}\n${params.newText}`,
					)
				}
				return { success: true }
			},
		}),

		complete: tool({
			description: 'Call when done adjusting. Summarize what changed.',
			inputSchema: z.object({
				evolution: z
					.string()
					.describe('Brief description of what changed and why'),
				significance: z
					.enum(['routine', 'notable', 'critical'])
					.describe('How significant are these changes'),
				reasoning: z
					.string()
					.optional()
					.describe('Key reasoning behind the decisions'),
			}),
			// No execute — terminal tool
		}),
	}

	interface CompleteInput {
		evolution: string
		significance: string
		reasoning?: string
	}
	let completeResult: CompleteInput | null = null

	const result = await generate({
		model,
		system: `You are the memory of a node that tracks "${instructions}".

Your understanding is hard-won knowledge built from real observations. Treat it as valuable — make only the minimal, surgical changes needed to honor the directive.

Rules:
- Use removeSection or replaceSection for precise edits. Pass exact text from the understanding below — character for character.
- Preserve everything the directive doesn't explicitly ask to change.
- If the directive asks for something already present, call complete with no changes.
- "No change needed" is a valid and preferred outcome when the knowledge already satisfies the directive.

Here is your current understanding:
<understanding>
${currentUnderstanding}
</understanding>`,
		prompt: directive,
		tools,
		toolChoice: 'required' as const,
		stopWhen: stepCountIs(ADJUST_MAX_STEPS),
		onStepFinish: ({ toolCalls }) => {
			if (toolCalls) {
				for (const tc of toolCalls) {
					if (tc.toolName === 'complete') {
						completeResult = tc.input as CompleteInput
					}
				}
			}
		},
	})

	// Check final step for complete tool call
	const completeCall = result.toolCalls.find((c) => c.toolName === 'complete')
	if (completeCall && 'input' in completeCall) {
		completeResult = completeCall.input as CompleteInput
	}

	// If understanding didn't change, treat as dismissed
	if (buffer === currentUnderstanding) {
		return {
			status: 'dismissed',
			newUnderstanding: currentUnderstanding,
			evolution: completeResult?.evolution ?? 'No changes needed',
			significance: 'routine',
		}
	}

	return {
		status: 'synthesized',
		newUnderstanding: buffer,
		evolution: completeResult?.evolution ?? 'Understanding adjusted',
		significance: (completeResult?.significance as Significance) ?? 'routine',
	}
}

export type { UnderstandIdentity } from './schema.identity'
export { understandIdentitySchema } from './schema.identity'
export { understandOutputSchema } from './schema.output'
