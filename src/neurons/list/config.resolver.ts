/**
 * ListNeuron config resolver
 */

import { nanoid } from 'nanoid'
import type { ParentModels } from '../../types/config'
import { cascade } from '../../utils/cascade'
import { LIST_NEURON_DEFAULTS } from './config.defaults'
import type { ListNeuronConfig, ResolvedListNeuronConfig } from './types'

export function resolveListNeuronConfig(
	config: ListNeuronConfig,
	parentModels?: ParentModels,
): ResolvedListNeuronConfig {
	const model = config.model ?? parentModels?.model
	if (!model) {
		throw new Error('ListNeuron requires a model')
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
		observeInstructions: config.observeInstructions ?? null,
		understandInstructions: config.understandInstructions ?? null,
		id: config.id ?? `neuron_${nanoid()}`,
		origin: config.origin ?? LIST_NEURON_DEFAULTS.origin,
		observer: {
			model: cascade(config.observer?.model, model),
			blueprintModel: cascade(config.observer?.blueprintModel, blueprintModel),
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
					LIST_NEURON_DEFAULTS.understand.thresholds.maxObservations,
				maxTokens:
					config.understand?.thresholds?.maxTokens ??
					LIST_NEURON_DEFAULTS.understand.thresholds.maxTokens,
				minImportance:
					config.understand?.thresholds?.minImportance ??
					LIST_NEURON_DEFAULTS.understand.thresholds.minImportance,
			},
		},
		query: {
			model: cascade(config.query?.model, model),
		},
		governance: {
			deduplication:
				config.governance?.deduplication ??
				LIST_NEURON_DEFAULTS.governance.deduplication,
			maxItems:
				config.governance?.maxItems ?? LIST_NEURON_DEFAULTS.governance.maxItems,
			pruning:
				config.governance?.pruning ?? LIST_NEURON_DEFAULTS.governance.pruning,
		},
	}
}
