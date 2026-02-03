/**
 * Observe phase - direct method
 *
 * Extracts what's relevant to purpose from data.
 * Uses identity generation + system prompt pattern.
 */

import type { LanguageModel } from 'ai'
import type { ObserveOutput, ObserveContext, ObserveCallbacks } from './types'
import type { ObserveIdentity } from './schema.identity'
import { observeIdentitySchema } from './schema.identity'
import { generateStructuredOutput } from '../../../../../utils'
import { observeOutputSchema } from './schema.output'
import { observeIdentityPromptTemplate } from './prompt.template.identity'
import { observeSystemPromptTemplate } from './prompt.template.system'
import { observeUserPromptTemplate } from './prompt.template.user'

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
 * @returns Generated identity and system prompt
 */
export async function initObserve(
	model: LanguageModel,
	instructions: string,
): Promise<ObserveInitResult> {
	const prompt = observeIdentityPromptTemplate(instructions)

	const { output: identity } = await generateStructuredOutput({
		model,
		prompt,
		schema: observeIdentitySchema,
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

		const result = await generateStructuredOutput({
			model,
			system: systemPrompt,
			prompt,
			schema: observeOutputSchema,
			temperature: 0.2,
		})

		// Emit thinking if available
		if (callbacks?.onThinking && result.reasoning) {
			const thoughts = result.reasoning.map((r) => r.text)
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
