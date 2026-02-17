/**
 * Observe phase - direct method
 *
 * Extracts what's relevant to purpose from data.
 * Uses identity generation + system prompt pattern.
 */

import type { LanguageModel } from 'ai'
import { generate, Output } from '../../../../../llm'
import { observeIdentityPromptTemplate } from './prompt.template.identity'
import { observeSystemPromptTemplate } from './prompt.template.system'
import { observeUserPromptTemplate } from './prompt.template.user'
import type { ObserveIdentity } from './schema.identity'
import { observeIdentitySchema } from './schema.identity'
import { observeOutputSchema } from './schema.output'
import type { ObserveCallbacks, ObserveContext, ObserveOutput } from './types'

/**
 * Result from observe init
 */
export interface ObserveInitResult {
	identity: ObserveIdentity
	systemPrompt: string
}

/**
 * Initialize observe phase - generates identity and system prompt
 *
 * @param model - Language model to use
 * @param instructions - Learner's purpose/instructions
 * @param focus - Optional focus areas to narrow observation filtering
 * @returns Generated identity and system prompt
 */
export async function initObserve(
	model: LanguageModel,
	instructions: string,
	focus?: string,
): Promise<ObserveInitResult> {
	const prompt = observeIdentityPromptTemplate(instructions, focus)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: observeIdentitySchema }),
	})

	const systemPrompt = observeSystemPromptTemplate(identity)

	return { identity, systemPrompt }
}

/**
 * Execute observe phase
 *
 * @param model - Language model to use
 * @param systemPrompt - Pre-generated system prompt
 * @param context - Observe context (data, etc.)
 * @param callbacks - Optional callbacks for observability
 * @returns Observe output
 */
export async function observe(
	model: LanguageModel,
	systemPrompt: string,
	context: ObserveContext,
	callbacks?: ObserveCallbacks,
): Promise<ObserveOutput> {
	try {
		const prompt = observeUserPromptTemplate(context.data)

		const result = await generate({
			model,
			system: systemPrompt,
			prompt,
			output: Output.object({ schema: observeOutputSchema }),
			temperature: 0.2,
		})

		// Emit thinking if available
		if (callbacks?.onThinking && result.reasoning) {
			const thoughts = result.reasoning.map((r: { text: string }) => r.text)
			callbacks.onThinking(thoughts)
		}

		const data = result.output
		if (data.status === 'observed') {
			return {
				status: 'observed',
				output: data.output,
				importance: data.importance ?? 0.5,
				usage: result.usage,
			}
		} else {
			return {
				status: 'dismissed',
				output: data.output,
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

// Re-export types and utilities
export type { ObserveIdentity } from './schema.identity'
export { observeIdentitySchema } from './schema.identity'
export { observeOutputSchema } from './schema.output'
