/**
 * Synthesize phase - direct method
 *
 * Updates understanding based on buffered observations.
 * Uses identity generation + system prompt pattern.
 */

import type { LanguageModel } from 'ai'
import { generate, Output } from '../../../../../llm'
import type { Strategy } from '../../../strategies'
import { synthesizeIdentityPromptTemplate } from './prompt.template.identity'
import { synthesizeSystemPromptTemplate } from './prompt.template.system'
import { synthesizeUserPromptTemplate } from './prompt.template.user'
import type { SynthesizeIdentity } from './schema.identity'
import { synthesizeIdentitySchema } from './schema.identity'
import { synthesizeOutputSchema } from './schema.output'
import type {
	SynthesizeCallbacks,
	SynthesizeContext,
	SynthesizeOutput,
} from './types'

/**
 * Result from synthesize init
 */
export interface SynthesizeInitResult {
	identity: SynthesizeIdentity
	systemPrompt: string
}

/**
 * Initialize synthesize phase - generates identity and system prompt
 *
 * @param model - Language model to use
 * @param instructions - Learner's purpose/instructions
 * @param strategy - Understanding maintenance strategy
 * @returns Generated identity and system prompt
 */
export async function initSynthesize(
	model: LanguageModel,
	instructions: string,
	strategy: Strategy,
): Promise<SynthesizeInitResult> {
	const prompt = synthesizeIdentityPromptTemplate(instructions)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: synthesizeIdentitySchema }),
	})

	const systemPrompt = synthesizeSystemPromptTemplate(identity, strategy)

	return { identity, systemPrompt }
}

/**
 * Execute synthesize phase
 *
 * @param model - Language model to use
 * @param systemPrompt - Pre-generated system prompt
 * @param context - Synthesize context (understanding, observations, etc.)
 * @param callbacks - Optional callbacks for observability
 * @returns Synthesize output
 */
export async function synthesize(
	model: LanguageModel,
	systemPrompt: string,
	context: SynthesizeContext,
	callbacks?: SynthesizeCallbacks,
): Promise<SynthesizeOutput> {
	try {
		const prompt = synthesizeUserPromptTemplate(
			context.currentUnderstanding,
			context.observations,
		)

		const result = await generate({
			model,
			system: systemPrompt,
			prompt,
			output: Output.object({ schema: synthesizeOutputSchema }),
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

// Re-export types and utilities
export type { SynthesizeIdentity } from './schema.identity'
export { synthesizeIdentitySchema } from './schema.identity'
export { synthesizeOutputSchema } from './schema.output'
