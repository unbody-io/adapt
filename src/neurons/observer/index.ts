/**
 * Shared observer module — type-agnostic observe phase
 *
 * Extracts what's relevant to purpose from data.
 * Uses identity generation + system prompt pattern.
 * Shared across all neuron types (text, list, etc.).
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { generate, Output } from '../../llm'
import { observeAdjustPromptTemplate } from './prompts/adjust'
import { observeIdentityPromptTemplate } from './prompts/identity'
import { observeSystemPromptTemplate } from './prompts/system'
import { observeUserPromptTemplate } from './prompts/user'
import type { ObserveIdentity } from './schema.identity'
import { observeIdentitySchema } from './schema.identity'
import { observeOutputSchema, buildObserveOutputSchema } from './schema.output'
import type { ObserveCallbacks, ObserveContext, ObserveOutput } from './types'

/**
 * Schema for adjust output — identity fields + resolved instructions
 */
const adjustObserveOutputSchema = observeIdentitySchema.extend({
	instructions: z
		.string()
		.describe('The updated instructions after applying the directive'),
})

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
 * @param instructions - Neuron's purpose/instructions
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
		repairSchema: observeIdentitySchema,
	})

	const systemPrompt = observeSystemPromptTemplate(identity)

	return { identity, systemPrompt }
}

/**
 * Result from observe adjust
 */
export interface AdjustObserveResult {
	newInstructions: string
	identity: ObserveIdentity
	systemPrompt: string
}

/**
 * Adjust observe phase — evolves identity and resolves new instructions from a directive
 *
 * Unlike initObserve (which generates from scratch), this shows the LLM
 * the current state so it can make incremental adjustments.
 *
 * @param model - Language model to use
 * @param directive - Natural language directive describing what to change
 * @param currentInstructions - The neuron's current instructions
 * @param currentIdentity - The current observer identity
 * @param focus - Optional focus areas
 * @returns New instructions, adjusted identity, and system prompt
 */
export async function adjustObserve(
	model: LanguageModel,
	directive: string,
	currentInstructions: string,
	currentIdentity: ObserveIdentity,
	focus?: string,
): Promise<AdjustObserveResult> {
	const prompt = observeAdjustPromptTemplate(
		directive,
		currentInstructions,
		currentIdentity,
		focus,
	)

	const { output } = await generate({
		model,
		prompt,
		output: Output.object({ schema: adjustObserveOutputSchema }),
		repairSchema: adjustObserveOutputSchema,
	})

	const newInstructions = output.instructions
	const identity: ObserveIdentity = {
		identity: output.identity,
		domain: output.domain,
	}

	const systemPrompt = observeSystemPromptTemplate(identity)

	return { newInstructions, identity, systemPrompt }
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
	model: LanguageModel,
	systemPrompt: string,
	context: ObserveContext,
	observationSchema?: Record<string, unknown>,
	callbacks?: ObserveCallbacks,
): Promise<ObserveOutput> {
	try {
		const prompt = observeUserPromptTemplate(context.data)
		const outputSchema = observationSchema
			? buildObserveOutputSchema(observationSchema)
			: observeOutputSchema

		const result = await generate({
			model,
			system: systemPrompt,
			prompt,
			output: Output.object({ schema: outputSchema }),
			repairSchema: outputSchema,
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

// Re-export types and utilities
export type { ObserveIdentity } from './schema.identity'
export { observeIdentitySchema } from './schema.identity'
export { observeOutputSchema } from './schema.output'
export type { ObserveOutput, ObserveContext, ObserveCallbacks, Usage } from './types'
