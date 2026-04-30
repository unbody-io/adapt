/**
 * Tool for reviewing recent evolution decisions
 */

import { z } from 'zod'
import { tool } from '../../../llm'
import type { EvolutionHistoryEntry } from '../types'

const reviewRecentDecisionsParams = z.object({})

export type ReviewRecentDecisionsParams = z.infer<
	typeof reviewRecentDecisionsParams
>

/**
 * Create reviewRecentDecisions tool with evaluator history context.
 *
 * Returns last N evaluation decision sets from in-memory log.
 * Prevents repeating work.
 */
export function createReviewRecentDecisionsTool(
	history: EvolutionHistoryEntry[],
) {
	return tool({
		description:
			'See what evolution decisions were made recently — prevents repeating work.',
		inputSchema: reviewRecentDecisionsParams,
		execute: async () => {
			return history
		},
	})
}
