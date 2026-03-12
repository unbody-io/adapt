/**
 * Brain state types
 *
 * The state object is the single source of truth for all persisted Brain data.
 * Cached in memory as `this.state`, backed by `store.state`.
 * Same pattern as BaseLearnerState — everything persisted, stateTransforms
 * handle the serialization boundary for non-serializable types (models).
 *
 * What lives in state (persisted):
 * - prompt — brain identity/purpose
 * - models — all model slots (live LanguageModel in cache; { provider, modelId } in store)
 * - ingest — batch size config
 * - evolution — evolution system config + runtime counters
 *
 * What stays outside state (not serializable, immutable, or runtime-only):
 * - store — the persistence layer itself
 * - learners Map — live instances, rebuilt from store.learners on restore
 * - evaluator, orchestrator — rebuilt on init
 * - autoSetup — constructor config, only affects first init
 * - learnerStoreFactory — constructor config, factory function
 * - configLearners — constructor config, only affects first init
 */

import type { LanguageModel } from 'ai'
import type { PromptContext } from './prompts/prompt.decompose-brain-prompt'

// ── Model types ─────────────────────────────────────────────────────────────

/**
 * Model reference as stored in the store (serializable).
 */
export interface StoredBrainModelRef {
	provider: string
	modelId: string
}

/**
 * All model slots a Brain uses.
 * In the cache: live LanguageModel instances.
 * In the store: serialized as Record<string, StoredBrainModelRef>.
 */
export interface BrainModelSlots {
	default: LanguageModel
	blueprint: LanguageModel
	init: LanguageModel
	query: LanguageModel
	evolution: LanguageModel
}

// ── State types ─────────────────────────────────────────────────────────────

/**
 * Persisted Brain state — backed by store.state.
 * Single source of truth for all Brain config and runtime data.
 */
export interface BrainState {
	// Identity
	prompt: string

	// LLM-extracted context from brain prompt (null before init)
	promptContext: PromptContext | null

	// Models (LanguageModel in cache; StoredBrainModelRef in store)
	models: BrainModelSlots

	// Ingest config
	ingest: {
		batchSize: number
	}

	// Evolution config + runtime counters
	evolution: {
		enabled: boolean
		evaluatorSignalThreshold: number
		autoEvaluate: boolean
		coverageGap: {
			relevanceThreshold: number
			gapCountThreshold: number
			windowSize: number
		}
	}

}

// ── Transform types ─────────────────────────────────────────────────────────

/**
 * Serialize/deserialize pair for a single state key.
 * Keys not in the transforms map pass through as-is.
 */
export interface BrainStateTransform {
	serialize: (value: unknown) => unknown
	deserialize: (value: unknown) => unknown
}

// ── Serialization helpers ───────────────────────────────────────────────────

/**
 * Extract a StoredBrainModelRef from a LanguageModel.
 */
export function toBrainModelRef(model: LanguageModel): StoredBrainModelRef {
	if (typeof model === 'string') {
		const colonIdx = model.indexOf(':')
		if (colonIdx > 0) {
			return { provider: model.slice(0, colonIdx), modelId: model.slice(colonIdx + 1) }
		}
		return { provider: 'unknown', modelId: model }
	}
	return { provider: model.provider, modelId: model.modelId }
}

/**
 * Serialize all brain model slots for store persistence.
 */
export function serializeBrainModelSlots(
	models: BrainModelSlots,
): Record<string, StoredBrainModelRef> {
	return Object.fromEntries(
		Object.entries(models).map(([key, model]) => [
			key,
			toBrainModelRef(model),
		]),
	)
}

/**
 * Create initial BrainState from resolved config values.
 */
export function createInitialBrainState(config: {
	prompt: string
	model: LanguageModel
	blueprintModel: LanguageModel
	initModel: LanguageModel
	queryModel: LanguageModel
	evolutionModel: LanguageModel
	batchSize: number
	evolution: BrainState['evolution']
}): BrainState {
	return {
		prompt: config.prompt,
		promptContext: null,
		models: {
			default: config.model,
			blueprint: config.blueprintModel,
			init: config.initModel,
			query: config.queryModel,
			evolution: config.evolutionModel,
		},
		ingest: {
			batchSize: config.batchSize,
		},
		evolution: config.evolution,
	}
}
