/**
 * List learner type descriptor — static metadata for Brain's evolution system.
 */

import { z } from 'zod'
import type { LearnerTypeDescriptor } from '../types'
import { ListLearner } from './class'
import type { ListLearnerConfig } from './types'

const listItemSchema = z.object({
	id: z.string(),
	data: z.record(z.string(), z.unknown()),
	metadata: z.object({
		confidence: z.number(),
		firstSeen: z.string(),
		lastUpdated: z.string(),
		signals: z.array(z.string()),
	}),
})

export const listLearnerDescriptor: LearnerTypeDescriptor = {
	type: 'list',

	description: `LIST learners track structured collections of discrete items.
Best for: entities, catalogs, inventories, tools/technologies used, specific preferences as countable items.
- governance: { deduplication?: "strict" | "none", maxItems?: number, pruning?: "oldest" | "least-confident" | "none" }
  - Defaults are sensible (strict dedup, 200 maxItems, oldest pruning) — omit unless specific needs.`,

	factory(config: Record<string, unknown>) {
		return new ListLearner(config as unknown as ListLearnerConfig)
	},

	mergeUnderstandingSchema: z
		.array(listItemSchema)
		.describe(
			'Merged list of items combining knowledge from all source learners',
		),

	splitUnderstandingSchema: z
		.array(listItemSchema)
		.describe('List items for this split learner'),
}
