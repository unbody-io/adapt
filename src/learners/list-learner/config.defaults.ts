/**
 * Default values for ListLearner configuration
 */

import type { SynthesizeThresholds } from '../base/learning-method'

export const LIST_LEARNER_DEFAULTS = {
	origin: 'developer' as const,
	synthesize: {
		thresholds: {
			maxObservations: 10,
			maxTokens: 8000,
			minImportance: 0.5,
		} satisfies Required<SynthesizeThresholds>,
	},
	governance: {
		deduplication: 'strict' as const,
		maxItems: 200,
		pruning: 'oldest' as const,
	},
	health: {
		signalThresholds: {
			maxDismissalRate: 0.8,
			minConfidence: 0.3,
			maxObservationsWithoutSynthesis: 100,
		},
	},
} as const
