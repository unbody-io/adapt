/**
 * Default values for TextLearner configuration
 */

import type { Strategy } from './strategies'
import type { QueryMethodName } from './query-methods/types'
import type { SynthesizeThresholds } from './learning-methods/types'

export const TEXT_LEARNER_DEFAULTS = {
	origin: 'developer' as const,
	observe: {
		method: 'direct' as const,
	},
	synthesize: {
		method: 'direct' as const,
		thresholds: {
			maxObservations: 10,
			maxTokens: 8000,
			minImportance: 0.9,
		} satisfies Required<SynthesizeThresholds>,
	},
	query: {
		method: 'tool-based' as QueryMethodName,
	},
	maintenance: {
		strategy: 'cumulative' as Strategy,
		maxTokens: 16000,
	},
} as const
