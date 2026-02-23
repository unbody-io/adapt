/**
 * Default values for TextLearner configuration
 */

import type { UnderstandThresholds } from '../base/types'
import type { Strategy } from './strategies'

export const TEXT_LEARNER_DEFAULTS = {
	origin: 'developer' as const,
	understand: {
		thresholds: {
			maxObservations: 10,
			maxTokens: 8000,
			minImportance: 0.5,
		} satisfies Required<UnderstandThresholds>,
	},
	governance: {
		strategy: 'cumulative' as Strategy,
		maxTokens: 16000,
	},
} as const
