/**
 * Tool for asking a specialist a direct question
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const querySpecialistParams = z.object({
	id: z.string().describe('The specialist (learner) ID to query'),
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
			const learner = brain.learners.get(id)
			if (!learner) {
				throw new Error(`Specialist "${id}" not found`)
			}

			const result = await learner.query(question)
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
