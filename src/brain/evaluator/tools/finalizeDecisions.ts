/**
 * Done tool for finalizing evolution decisions
 */

import { z } from 'zod'
import { tool } from '../../../llm'
import { EVOLUTION_ACTIONS } from '../types'

const evolutionDecisionSchema = z.object({
	action: z
		.enum([
			EVOLUTION_ACTIONS.create,
			EVOLUTION_ACTIONS.merge,
			EVOLUTION_ACTIONS.split,
			EVOLUTION_ACTIONS.update,
			EVOLUTION_ACTIONS.delete,
		])
		.describe('The evolution action to take'),
	reasoning: z.string().describe('Why this decision is needed (1-2 sentences)'),
	guidance: z
		.string()
		.describe(
			'Natural language guidance for the action handler to execute this decision',
		),
	targets: z
		.array(z.string())
		.describe(
			'Affected neuron IDs (empty array for create, one or more for other actions)',
		),
})

const finalizeDecisionsParams = z.object({
	decisions: z
		.array(evolutionDecisionSchema)
		.describe(
			'Array of evolution decisions. Empty array if no changes needed.',
		),
})

export type FinalizeDecisionsParams = z.infer<typeof finalizeDecisionsParams>

/**
 * Done tool for returning final decisions
 *
 * No execute function - this is a "done tool" that signals
 * the LLM has finished reasoning and returns structured output.
 */
export const finalizeDecisions = tool({
	description:
		'Finalize your evaluation and return the evolution decisions. ' +
		'Call this after investigating the signals and determining what actions are needed. ' +
		'Return an empty decisions array if no changes are warranted.',
	inputSchema: finalizeDecisionsParams,
	// No execute — done tool
})
