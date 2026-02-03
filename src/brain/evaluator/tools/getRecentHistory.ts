/**
 * Tool for fetching recent evaluation history
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { EvolutionHistoryEntry } from '../types'

const getRecentHistoryParams = z.object({})

export type GetRecentHistoryParams = z.infer<typeof getRecentHistoryParams>

/**
 * Create getRecentHistory tool with evaluator history context
 *
 * Returns last N evaluation decision sets from in-memory log.
 * Prevents the evaluator from repeating bad decisions.
 */
export function createGetRecentHistoryTool(
	history: EvolutionHistoryEntry[],
) {
	return tool({
		description:
			'Fetch recent evaluation history — past decisions made by this evaluator. ' +
			'Use this to check if you recently acted on a learner, to avoid repeating bad decisions.',
		inputSchema: getRecentHistoryParams,
		execute: async () => {
			return history
		},
	})
}
