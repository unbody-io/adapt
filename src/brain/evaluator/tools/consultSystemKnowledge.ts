/**
 * Tool for consulting the network's self-knowledge (internal learners)
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const consultSystemKnowledgeParams = z.object({
	question: z.string().describe('What to ask the network\'s self-knowledge'),
})

export type ConsultSystemKnowledgeParams = z.infer<typeof consultSystemKnowledgeParams>

/**
 * Create consultSystemKnowledge tool with brain context.
 *
 * Wraps brain.consult() — queries all internal learners that have knowledge
 * and synthesizes a response. The evaluator sees this as the network's
 * self-awareness, not as individual internal learners.
 */
export function createConsultSystemKnowledgeTool(brain: Brain) {
	return tool({
		description:
			'Ask the network\'s self-knowledge — what patterns, gaps, or tensions exist across the whole system.',
		inputSchema: consultSystemKnowledgeParams,
		execute: async ({ question }) => {
			return brain.consult(question)
		},
	})
}
