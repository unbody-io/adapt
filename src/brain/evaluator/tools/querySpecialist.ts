/**
 * Tool for asking a specialist a direct question
 */

import { z } from 'zod'
import { tool } from '../../../llm'
import type { Brain } from '../../class'

const querySpecialistParams = z.object({
	id: z.string().describe('The specialist (neuron) ID to query'),
	question: z.string().describe('The question to ask the specialist'),
})

/**
 * Create querySpecialist tool with brain context.
 *
 * Asks a specialist a targeted question instead of dumping raw understanding.
 */
export function createQuerySpecialistTool(brain: Brain) {
	return tool({
		description:
			'Ask a specialist a direct question — get a targeted answer instead of raw knowledge.',
		inputSchema: querySpecialistParams,
		execute: async ({ id, question }) => {
			const neuron = brain.neurons.get(id)
			if (!neuron) {
				throw new Error(`Specialist "${id}" not found`)
			}

			const result = await neuron.query(question)
			return {
				relevant: result.relevant,
				relevance: result.relevance,
				confidence: result.confidence,
				insight: result.insight,
				gaps: result.gaps,
			}
		},
	})
}
