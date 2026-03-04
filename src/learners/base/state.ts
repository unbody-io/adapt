/**
 * Learner state types
 *
 * The state object is the single source of truth for all learner config and runtime data.
 * Cached in memory as `this.state`, backed by `store.state`.
 *
 * Models are stored as { provider, modelId } in the store and resolved to live
 * LanguageModel instances in the cache via the transform layer.
 */

import type { LanguageModel } from 'ai'
import type { ObserveIdentity } from '../observer'
import type { LearnerHealth, LearnerMetrics, LearnerOrigin } from '../types'

// ── Model types ─────────────────────────────────────────────────────────────

/**
 * Model reference as stored in the store (serializable).
 * Extracted from LanguageModel.provider and LanguageModel.modelId.
 */
export interface StoredModelRef {
	provider: string
	modelId: string
}

/**
 * All model slots a learner uses.
 * In the cache: live LanguageModel instances.
 * In the store: serialized as Record<string, StoredModelRef>.
 */
export interface ModelSlots {
	default: LanguageModel
	blueprint: LanguageModel
	observer: LanguageModel
	observer_blueprint: LanguageModel
	understand: LanguageModel
	understand_blueprint: LanguageModel
	query: LanguageModel
}

// ── State types ─────────────────────────────────────────────────────────────

/**
 * Base learner state — shared across all learner types.
 *
 * Everything that gets cached in `this.state` and persisted to `store.state`.
 * Understanding is NOT here — it lives in `store.understanding` (not cached).
 *
 * What stays outside state (not serializable or immutable):
 * - `id` — immutable learner identity
 * - `store` — the store reference itself
 * - `initPromise` — internal lazy-init promise
 * - `queryMethod` — runtime query method instance
 */
export interface BaseLearnerState {
	// Semantic identity
	instructions: string
	name: string
	description: string
	focus: string | null
	origin: LearnerOrigin

	// Models (live LanguageModel in cache; StoredModelRef in store)
	models: ModelSlots

	// LLM-generated artifacts (null before init)
	observe_identity: ObserveIdentity | null
	observe_prompt: string | null
	understand_prompt: string | null
	understand_identity: unknown
	observation_schema: Record<string, unknown> | null
	understanding_schema: Record<string, unknown> | null

	// Phase config
	thresholds: {
		maxObservations: number
		maxTokens: number
		minImportance: number
	}

	// Runtime
	health: LearnerHealth
	metrics: LearnerMetrics
	stagnation_signal_fired: boolean
	dismissal_signal_fired: boolean

	// Skip observation phase — data goes directly to buffer
	skipObservation: boolean
}

// ── Transform types ─────────────────────────────────────────────────────────

/**
 * Serialize/deserialize pair for a single state key.
 * Keys not in the transforms registry pass through as-is (identity transform).
 */
export interface StateTransform {
	serialize: (value: unknown) => unknown
	deserialize: (value: unknown) => unknown
}

// ── Serialization helpers ───────────────────────────────────────────────────

/**
 * Extract a StoredModelRef from a LanguageModel.
 * Handles both object models (V2/V3 with provider + modelId) and string models.
 */
export function toStoredModelRef(model: LanguageModel): StoredModelRef {
	if (typeof model === 'string') {
		// String format: "provider:modelId" or just a model name
		const colonIdx = model.indexOf(':')
		if (colonIdx > 0) {
			return { provider: model.slice(0, colonIdx), modelId: model.slice(colonIdx + 1) }
		}
		return { provider: 'unknown', modelId: model }
	}
	return { provider: model.provider, modelId: model.modelId }
}

/**
 * Serialize all model slots for store persistence
 */
export function serializeModelSlots(
	models: ModelSlots,
): Record<string, StoredModelRef> {
	return Object.fromEntries(
		Object.entries(models).map(([key, model]) => [
			key,
			toStoredModelRef(model),
		]),
	)
}
