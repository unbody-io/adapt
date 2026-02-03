/**
 * Brain config resolver
 *
 * Resolves BrainConfig to ResolvedBrainConfig by applying
 * cascade logic for models and defaults for other values.
 */

import type { LanguageModel } from 'ai'
import { cascade } from '../utils/cascade'
import { BRAIN_DEFAULTS } from './config.defaults'
import type {
	BrainConfig,
	LearningConfig,
	ResolvedBrainConfig,
	ResolvedLearningConfig,
} from './types'

/**
 * Resolve learning config with model cascade
 */
function resolveLearningConfig(
	config: LearningConfig | undefined,
	parentModel: LanguageModel,
	parentBlueprintModel: LanguageModel,
): ResolvedLearningConfig {
	const model = config?.model ?? parentModel
	// blueprintModel cascade: local override > parent blueprintModel > local model
	const blueprintModel = config?.blueprintModel ?? parentBlueprintModel

	return {
		model,
		blueprintModel,
		observe: {
			model: cascade(config?.observe?.model, model),
			blueprintModel: cascade(config?.observe?.blueprintModel, blueprintModel),
		},
		synthesize: {
			model: cascade(config?.synthesize?.model, model),
			blueprintModel: cascade(
				config?.synthesize?.blueprintModel,
				blueprintModel,
			),
			thresholds: {
				maxObservations:
					config?.synthesize?.thresholds?.maxObservations ??
					BRAIN_DEFAULTS.learning.synthesize.thresholds.maxObservations,
				maxTokens:
					config?.synthesize?.thresholds?.maxTokens ??
					BRAIN_DEFAULTS.learning.synthesize.thresholds.maxTokens,
				minImportance:
					config?.synthesize?.thresholds?.minImportance ??
					BRAIN_DEFAULTS.learning.synthesize.thresholds.minImportance,
			},
		},
		query: {
			model: cascade(config?.query?.model, model),
			method: config?.query?.method ?? BRAIN_DEFAULTS.learning.query.method,
		},
		maintenance: {
			strategy:
				config?.maintenance?.strategy ??
				BRAIN_DEFAULTS.learning.maintenance.strategy,
			maxTokens:
				config?.maintenance?.maxTokens ??
				BRAIN_DEFAULTS.learning.maintenance.maxTokens,
		},
	}
}

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
		learning: resolveLearningConfig(config.learning, model, blueprintModel),
	}
}
