import type { LanguageModel, CallSettings } from 'ai'
import { z } from 'zod'
import type { LearnerResponse, BrainAskResult } from './types'
import type { TokenUsage } from '../learners/types'
import { generate, Output } from '../llm'
import { buildSynthesisSystemPrompt } from './prompts/prompt.synthesis.system'
import { buildSynthesisUserPrompt } from './prompts/prompt.synthesis.user'

/**
 * Schema for synthesis output
 */
const synthesisOutputSchema = z.object({
	insight: z.string().describe('Unified answer integrating learner insights'),
	gaps: z.array(z.string()).describe('Knowledge gaps from learners'),
})

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>

/**
 * Options for synthesis
 */
export interface SynthesisOptions extends CallSettings {
	brainPrompt: string
	query: string
	responses: LearnerResponse[]
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
 * Synthesize learner responses into unified answer
 */
export async function synthesize(
	model: LanguageModel,
	options: SynthesisOptions,
): Promise<SynthesisResult> {
	const { brainPrompt, query, responses, ...generateOptions } = options

	const system = buildSynthesisSystemPrompt(brainPrompt)
	const prompt = buildSynthesisUserPrompt(query, responses)

	const result = await generate({
		model,
		system,
		prompt,
		output: Output.object({ schema: synthesisOutputSchema }),
		...generateOptions,
	})

	const usage: TokenUsage = {
		inputTokens: result.usage?.inputTokens ?? 0,
		outputTokens: result.usage?.outputTokens ?? 0,
		totalTokens: result.usage?.totalTokens ?? 0,
	}

	// Build sources from relevant responses
	const sources = responses
		.filter((r) => r.relevant)
		.map((r) => ({
			learnerId: r.learnerId,
			confidence: r.confidence,
			insight: r.insight,
		}))

	return {
		insight: result.output.insight,
		gaps: result.output.gaps,
		sources,
		usage,
	}
}
