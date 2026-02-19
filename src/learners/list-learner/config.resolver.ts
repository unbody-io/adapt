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
					LIST_LEARNER_DEFAULTS.understand.thresholds.maxObservations,
				maxTokens:
					config.understand?.thresholds?.maxTokens ??
					LIST_LEARNER_DEFAULTS.understand.thresholds.maxTokens,
				minImportance:
					config.understand?.thresholds?.minImportance ??
					LIST_LEARNER_DEFAULTS.understand.thresholds.minImportance,
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
