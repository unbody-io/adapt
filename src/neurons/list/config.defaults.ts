/**
 * Default values for ListNeuron configuration
 */

import type { UnderstandThresholds } from '../base/types'

export const LIST_NEURON_DEFAULTS = {
	origin: 'developer' as const,
	understand: {
		thresholds: {
			maxObservations: 10,
			maxTokens: 8000,
			minImportance: 0.5,
		} satisfies Required<UnderstandThresholds>,
	},
	governance: {
		deduplication: 'strict' as const,
		maxItems: 200,
		pruning: 'oldest' as const,
	},
} as const
