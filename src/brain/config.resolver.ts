/**
 * Brain config resolver
 *
 * Resolves BrainConfig to ResolvedBrainConfig by applying
 * cascade logic for models and defaults for other values.
 */

import { BRAIN_DEFAULTS } from './config.defaults'
import type {
	BrainConfig,
	ResolvedBrainConfig,
} from './types'

/**
 * Resolve BrainConfig to ResolvedBrainConfig
 *
 * Applies model cascade and defaults.
 */
export function resolveBrainConfig(config: BrainConfig): ResolvedBrainConfig {
	const model = config.model
	const blueprintModel = config.blueprintModel ?? model

	return {
		prompt: config.prompt,
		model,
		blueprintModel,
		init: {
			model: config.init?.model ?? blueprintModel,
		},
		query: {
			model: config.query?.model ?? model,
		},
		ingest: {
			batchSize: config.ingest?.batchSize ?? BRAIN_DEFAULTS.ingest.batchSize,
		},
		evolution: {
			enabled: config.evolution?.enabled ?? BRAIN_DEFAULTS.evolution.enabled,
			evaluatorSignalThreshold:
				config.evolution?.evaluatorSignalThreshold ??
				BRAIN_DEFAULTS.evolution.evaluatorSignalThreshold,
			autoEvaluate:
				config.evolution?.autoEvaluate ?? BRAIN_DEFAULTS.evolution.autoEvaluate,
		},
	}
}
