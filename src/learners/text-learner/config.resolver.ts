/**
 * TextLearner config resolver
 *
 * Resolves TextLearnerConfig to ResolvedTextLearnerConfig by applying
 * cascade logic for models and defaults for other values.
 */

import { nanoid } from 'nanoid'
import type { ParentModels } from '../../types/config'
import { cascade } from '../../utils/cascade'
import { TEXT_LEARNER_DEFAULTS } from './config.defaults'
import type { ResolvedTextLearnerConfig, TextLearnerConfig } from './types'

/**
 * Resolve TextLearnerConfig to ResolvedTextLearnerConfig
 *
 * @param config - The input config
 * @param parentModels - Optional parent models for cascade (from Brain)
 */
export function resolveTextLearnerConfig(
	config: TextLearnerConfig,
	parentModels?: ParentModels,
): ResolvedTextLearnerConfig {
	// Resolve base models with cascade
	const model = config.model ?? parentModels?.model
	if (!model) {
		throw new Error('TextLearner requires a model')
	}

	// blueprintModel cascade: local override > parent blueprintModel > local model > parent model
	const blueprintModel = cascade(
		config.blueprintModel,
		parentModels?.blueprintModel,
		config.model,
		parentModels?.model,
	)

	return {
		model,
		blueprintModel,
		instructions: config.instructions,
		id: config.id ?? `learner_${nanoid()}`,
		origin: config.origin ?? TEXT_LEARNER_DEFAULTS.origin,
		observe: {
			method: config.observe?.method ?? TEXT_LEARNER_DEFAULTS.observe.method,
			model: cascade(config.observe?.model, model),
			blueprintModel: cascade(config.observe?.blueprintModel, blueprintModel),
		},
		synthesize: {
			method:
				config.synthesize?.method ?? TEXT_LEARNER_DEFAULTS.synthesize.method,
			model: cascade(config.synthesize?.model, model),
			blueprintModel: cascade(
				config.synthesize?.blueprintModel,
				blueprintModel,
			),
			thresholds: {
				maxObservations:
					config.synthesize?.thresholds?.maxObservations ??
					TEXT_LEARNER_DEFAULTS.synthesize.thresholds.maxObservations,
				maxTokens:
					config.synthesize?.thresholds?.maxTokens ??
					TEXT_LEARNER_DEFAULTS.synthesize.thresholds.maxTokens,
				minImportance:
					config.synthesize?.thresholds?.minImportance ??
					TEXT_LEARNER_DEFAULTS.synthesize.thresholds.minImportance,
			},
		},
		query: {
			model: cascade(config.query?.model, model),
			method: config.query?.method ?? TEXT_LEARNER_DEFAULTS.query.method,
		},
		maintenance: {
			strategy:
				config.maintenance?.strategy ??
				TEXT_LEARNER_DEFAULTS.maintenance.strategy,
			maxTokens:
				config.maintenance?.maxTokens ??
				TEXT_LEARNER_DEFAULTS.maintenance.maxTokens,
		},
	}
}
