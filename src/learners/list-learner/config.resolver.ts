/**
 * ListLearner config resolver
 */

import { nanoid } from 'nanoid'
import type { ParentModels } from '../../types/config'
import { cascade } from '../../utils/cascade'
import { LIST_LEARNER_DEFAULTS } from './config.defaults'
import type { ListLearnerConfig, ResolvedListLearnerConfig } from './types'

export function resolveListLearnerConfig(
	config: ListLearnerConfig,
	parentModels?: ParentModels,
): ResolvedListLearnerConfig {
	const model = config.model ?? parentModels?.model
	if (!model) {
		throw new Error('ListLearner requires a model')
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
		origin: config.origin ?? LIST_LEARNER_DEFAULTS.origin,
		observe: {
			model: cascade(config.observe?.model, model),
			blueprintModel: cascade(config.observe?.blueprintModel, blueprintModel),
		},
		synthesize: {
			model: cascade(config.synthesize?.model, model),
			blueprintModel: cascade(config.synthesize?.blueprintModel, blueprintModel),
			thresholds: {
				maxObservations:
					config.synthesize?.thresholds?.maxObservations ??
					LIST_LEARNER_DEFAULTS.synthesize.thresholds.maxObservations,
				maxTokens:
					config.synthesize?.thresholds?.maxTokens ??
					LIST_LEARNER_DEFAULTS.synthesize.thresholds.maxTokens,
				minImportance:
					config.synthesize?.thresholds?.minImportance ??
					LIST_LEARNER_DEFAULTS.synthesize.thresholds.minImportance,
			},
		},
		query: {
			model: cascade(config.query?.model, model),
		},
		governance: {
			deduplication:
				config.governance?.deduplication ??
				LIST_LEARNER_DEFAULTS.governance.deduplication,
			maxItems:
				config.governance?.maxItems ??
				LIST_LEARNER_DEFAULTS.governance.maxItems,
			pruning:
				config.governance?.pruning ??
				LIST_LEARNER_DEFAULTS.governance.pruning,
		},
	}
}
