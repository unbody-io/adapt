/**
 * Text understand phase
 *
 * Updates understanding based on buffered observations.
 * Uses identity generation + system prompt pattern.
 */

import type { LanguageModel } from 'ai'
import { generate, Output } from '../../../llm'
import type { Strategy } from '../strategies'
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

export type { UnderstandIdentity } from './schema.identity'
export { understandIdentitySchema } from './schema.identity'
export { understandOutputSchema } from './schema.output'
