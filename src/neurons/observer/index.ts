/**
 * Shared observer module — type-agnostic observe phase
 *
 * Extracts what's relevant to purpose from data.
 * Uses deterministic 3-layer system prompt assembly.
 * Shared across all neuron types (text, list, etc.).
 */

import {
	type AdaptLLMPlugin,
	type AdaptRepairOptions,
	generate,
	type LanguageModel,
	Output,
} from '../../llm'
import { observeSystemPromptTemplate } from './prompts/system'
import { observeUserPromptTemplate } from './prompts/user'
import { buildObserveOutputSchema, observeOutputSchema } from './schema.output'
import type { ObserveCallbacks, ObserveContext, ObserveOutput } from './types'

/**
 * Result from observe init
 */
export interface ObserveInitResult {
	systemPrompt: string
}

/**
 * Initialize observe phase deterministically.
 */
export function initObserve(instructions: string): ObserveInitResult {
	return { systemPrompt: observeSystemPromptTemplate(instructions) }
}

/**
 * Execute observe phase
 *
 * @param model - Language model to use
 * @param systemPrompt - Pre-generated system prompt
 * @param context - Observe context (data, etc.)
 * @param observationSchema - Optional JSON Schema for structured observation output
 * @param callbacks - Optional callbacks for observability
 * @returns Observe output
 */
export async function observe(
	llm: AdaptLLMPlugin,
	model: LanguageModel,
	systemPrompt: string,
	context: ObserveContext,
	observationSchema?: Record<string, unknown>,
	callbacks?: ObserveCallbacks,
	repairOptions?: AdaptRepairOptions,
): Promise<ObserveOutput> {
	try {
		const prompt = observeUserPromptTemplate(context.data)
		const outputSchema = observationSchema
			? buildObserveOutputSchema(observationSchema)
			: observeOutputSchema

		const result = await generate({
			llm,
			model,
			system: systemPrompt,
			prompt,
			output: Output.object({ schema: outputSchema }),
			repairSchema: outputSchema,
			temperature: 0.2,
			...repairOptions,
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
				gaps: data.gaps ?? [],
				usage: result.usage,
			}
		} else {
			return {
				status: 'dismissed',
				output: data.output,
				gaps: data.gaps ?? [],
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

export { observeOutputSchema } from './schema.output'
export type {
	ObserveCallbacks,
	ObserveContext,
	ObserveOutput,
	Usage,
} from './types'
