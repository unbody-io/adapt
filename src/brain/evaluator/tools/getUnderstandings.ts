/**
 * Tool for fetching learner understandings during evaluation
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const getUnderstandingsParams = z.object({
	learnerIds: z
		.array(z.string())
		.describe('Array of learner IDs to fetch understanding for'),
})

export type GetUnderstandingsParams = z.infer<typeof getUnderstandingsParams>

/**
 * Create getUnderstandings tool with brain context
 *
 * This is a factory because the tool needs access to the brain
 * to fetch learner understandings.
 */
export function createGetUnderstandingsTool(brain: Brain) {
	return tool({
		description:
			'Fetch the accumulated understanding (knowledge) for specified learners. ' +
			'Use this to investigate why a learner is struggling - check if topic is exhausted, ' +
			'compare understandings to detect overlap, or see what knowledge exists.',
		inputSchema: getUnderstandingsParams,
		execute: async ({ learnerIds }) => {
			const result: Record<string, string> = {}

			for (const id of learnerIds) {
				const learner = brain.learners.get(id)
				if (learner) {
					const understanding = learner.getUnderstanding()
					result[id] = understanding || '(no understanding accumulated yet)'
				} else {
					result[id] = '(learner not found)'
				}
			}

			return result
		},
	})
}
