/**
 * Default values for Brain configuration
 */

export const BRAIN_DEFAULTS = {
	ingest: {
		batchSize: 20,
	},
	learning: {
		synthesize: {
			thresholds: {
				maxObservations: 10,
				maxTokens: 8000,
				minImportance: 0.9,
			},
		},
		query: {
			method: 'tool-based' as const,
		},
		maintenance: {
			strategy: 'cumulative' as const,
			maxTokens: 16000,
		},
	},
} as const
