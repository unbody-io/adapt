import type { LanguageModel } from 'ai'
import { hasToolCall, stepCountIs, tool, ToolLoopAgent } from 'ai'
import { z } from 'zod'

/**
 * Schema for individual learner response (input to synthesis)
 */
const learnerResponseSchema = z.object({
	learnerId: z.string(),
	name: z.string(),
	relevant: z.boolean(),
	confidence: z.number(),
	insight: z.string(),
	gaps: z.array(z.string()),
})

/**
 * Call options for the synthesis agent
 */
export const synthesisCallOptionsSchema = z.object({
	query: z.string(),
	brainPrompt: z.string(),
	responses: z.array(learnerResponseSchema),
})

export type SynthesisCallOptions = z.infer<typeof synthesisCallOptionsSchema>

/**
 * Schema for the synthesize done tool
 */
const synthesizeSchema = z.object({
	insight: z.string().describe('Unified answer integrating all learner insights'),
	gaps: z.array(z.string()).describe('Aggregated knowledge gaps from all learners'),
})

export type SynthesizeParams = z.infer<typeof synthesizeSchema>

/**
 * Done tool for synthesis - stops the agent loop
 */
const synthesize = tool({
	description: 'Finalize the response with a synthesized answer integrating all learner insights',
	inputSchema: synthesizeSchema,
	// No execute function - stops the agent loop when called
})

/**
 * Build instructions for the synthesis agent
 */
function buildSynthesisInstructions(options: SynthesisCallOptions): string {
	const relevantResponses = options.responses.filter((r) => r.relevant)
	const irrelevantResponses = options.responses.filter((r) => !r.relevant)

	return `You are synthesizing responses from multiple specialized learners into a unified answer.

══════════════════════════════════════════════════════════════════════════════
BRAIN CONTEXT
══════════════════════════════════════════════════════════════════════════════
${options.brainPrompt}

══════════════════════════════════════════════════════════════════════════════
USER QUERY
══════════════════════════════════════════════════════════════════════════════
${options.query}

══════════════════════════════════════════════════════════════════════════════
LEARNER RESPONSES
══════════════════════════════════════════════════════════════════════════════
${
	relevantResponses.length > 0
		? relevantResponses
				.map(
					(r) => `[${r.name}] (confidence: ${(r.confidence * 100).toFixed(0)}%)
${r.insight}
${r.gaps.length > 0 ? `Gaps: ${r.gaps.join(', ')}` : ''}`,
				)
				.join('\n\n')
		: '(No learners had relevant insights)'
}

${
	irrelevantResponses.length > 0
		? `\nLearners without relevant insights: ${irrelevantResponses.map((r) => r.name).join(', ')}`
		: ''
}

══════════════════════════════════════════════════════════════════════════════
YOUR TASK
══════════════════════════════════════════════════════════════════════════════

Synthesize a unified answer that:
1. Integrates insights from all relevant learners
2. Weighs by confidence — higher confidence insights are more reliable
3. Resolves conflicts by noting them if significant
4. Acknowledges gaps in knowledge

Call the synthesize tool with your final answer.`
}

/**
 * Create the synthesis agent for combining learner responses
 */
export function createSynthesisAgent(model: LanguageModel) {
	return new ToolLoopAgent({
		model,
		callOptionsSchema: synthesisCallOptionsSchema,
		tools: { synthesize },
		toolChoice: 'required' as const,

		prepareCall: ({ options, ...settings }) => ({
			...settings,
			instructions: buildSynthesisInstructions(options),
		}),

		stopWhen: [stepCountIs(5), hasToolCall('synthesize')],
	})
}

export type SynthesisAgent = ReturnType<typeof createSynthesisAgent>
