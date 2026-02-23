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

export function resolveTextLearnerConfig(
	config: TextLearnerConfig,
	parentModels?: ParentModels,
): ResolvedTextLearnerConfig {
	const model = config.model ?? parentModels?.model
	if (!model) {
		throw new Error('TextLearner requires a model')
	}

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
		observer: {
			model: cascade(config.observer?.model, model),
			blueprintModel: cascade(
				config.observer?.blueprintModel,
				blueprintModel,
			),
		},
		understand: {
			model: cascade(config.understand?.model, model),
			blueprintModel: cascade(
				config.understand?.blueprintModel,
				blueprintModel,
			),
			thresholds: {
				maxObservations:
					config.understand?.thresholds?.maxObservations ??
					TEXT_LEARNER_DEFAULTS.understand.thresholds.maxObservations,
				maxTokens:
					config.understand?.thresholds?.maxTokens ??
					TEXT_LEARNER_DEFAULTS.understand.thresholds.maxTokens,
				minImportance:
					config.understand?.thresholds?.minImportance ??
					TEXT_LEARNER_DEFAULTS.understand.thresholds.minImportance,
			},
		},
		query: {
			model: cascade(config.query?.model, model),
		},
		governance: {
			strategy:
				config.governance?.strategy ??
				TEXT_LEARNER_DEFAULTS.governance.strategy,
			maxTokens:
				config.governance?.maxTokens ??
				TEXT_LEARNER_DEFAULTS.governance.maxTokens,
		},
	}
}
