/**
 * Tool for fetching learner activity data during evaluation
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const getLearnerActivityParams = z.object({
	learnerIds: z
		.array(z.string())
		.describe('Array of learner IDs to fetch activity for'),
})

export type GetLearnerActivityParams = z.infer<typeof getLearnerActivityParams>

/**
 * Create getLearnerActivity tool with brain context
 *
 * Returns ingestion metrics and buffered observations per learner.
 * Mechanical — surfaces stored data without interpretation.
 */
export function createGetLearnerActivityTool(brain: Brain) {
	return tool({
		description:
			'Fetch ingestion metrics and recent observations for specified learners. ' +
			'Use this to investigate dismissal patterns — see what data a learner is capturing or rejecting.',
		inputSchema: getLearnerActivityParams,
		execute: async ({ learnerIds }) => {
			const result: Record<string, unknown> = {}

			for (const id of learnerIds) {
				const learner = brain.learners.get(id)
				if (learner) {
					result[id] = learner.getActivity()
				} else {
					result[id] = '(learner not found)'
				}
			}

			return result
		},
	})
}
