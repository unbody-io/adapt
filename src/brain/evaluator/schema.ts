/**
 * Zod schemas for Evaluator LLM outputs
 */

import { z } from 'zod'
import { EVOLUTION_ACTIONS } from './types'

/**
 * Schema for evolution decisions output by LLM
 */
export const evolutionDecisionsSchema = z.object({
	decisions: z
		.array(
			z.object({
				action: z
					.enum([
						EVOLUTION_ACTIONS.create,
						EVOLUTION_ACTIONS.merge,
						EVOLUTION_ACTIONS.split,
						EVOLUTION_ACTIONS.update,
						EVOLUTION_ACTIONS.delete,
					])
					.describe('The evolution action to take'),
				reasoning: z
					.string()
					.describe('Why this decision is needed (1-2 sentences)'),
				guidance: z
					.string()
					.describe(
						'Natural language guidance for the LLM action handler to execute this decision',
					),
				targets: z
					.array(z.string())
					.describe(
						'Affected neuron IDs (empty array for create action, one or more IDs for other actions)',
					),
			}),
		)
		.describe(
			'Array of 0 to N evolution decisions. Return empty array if no changes needed.',
		),
})

export type EvolutionDecisionsOutput = z.infer<typeof evolutionDecisionsSchema>
