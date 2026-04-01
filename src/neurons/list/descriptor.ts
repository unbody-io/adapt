/**
 * List neuron type descriptor — static metadata for Brain's evolution system.
 */

import { z } from 'zod'
import type { NeuronTypeDescriptor } from '../types'
import { ListNeuron } from './class'
import type { ListNeuronConfig } from './types'

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

export const listNeuronDescriptor: NeuronTypeDescriptor = {
	type: 'list',

	description: `LIST neurons track structured collections of discrete items.
Best for: entities, catalogs, inventories, tools/technologies used, specific preferences as countable items.
- governance: { deduplication?: "strict" | "none", maxItems?: number, pruning?: "oldest" | "least-confident" | "none" }
  - Defaults are sensible (strict dedup, 200 maxItems, oldest pruning) — omit unless specific needs.`,

	factory(config: Record<string, unknown>) {
		return new ListNeuron(config as unknown as ListNeuronConfig)
	},

	mergeUnderstandingSchema: z
		.array(listItemSchema)
		.describe(
			'Merged list of items combining knowledge from all source neurons',
		),

	splitUnderstandingSchema: z
		.array(listItemSchema)
		.describe('List items for this split neuron'),
}
