/**
 * Tool for reviewing dismissed data sitting in the buffer
 */

import { z } from 'zod'
import { tool } from '../../../llm'
import type { Brain } from '../../class'

const reviewDismissedDataParams = z.object({})

export type ReviewDismissedDataParams = z.infer<
	typeof reviewDismissedDataParams
>

/**
 * Create reviewDismissedData tool with brain context.
 *
 * Shows what data is sitting unprocessed — topics and how long they've been waiting.
 */
export function createReviewDismissedDataTool(brain: Brain) {
	return tool({
		description:
			"See what data is sitting unprocessed — topics and how long they've been waiting.",
		inputSchema: reviewDismissedDataParams,
		execute: async () => {
			const records = await brain.store.dismissedBatches.list()
			return records.map((r) => ({
				batchId: r.id,
				gaps: r.gaps,
				timestamp: r.timestamp,
				retryCount: r.retryCount,
				status: r.status,
			}))
		},
	})
}
