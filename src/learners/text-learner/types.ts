import type { LanguageModel } from 'ai'
import type {
	CascadableConfig,
	ResolvedCascadableConfig,
} from '../../types/config'
import type { EventsFromMap } from '../../types/events'
import type {
	LearnerOrigin,
	Significance,
} from '../types'
import type { SharedLearnerEventMap } from '../base/types'
import type {
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
} from './learning-methods/types'
import type { QueryMethodName } from './query-methods/types'
import type { Strategy } from './strategies'

// Re-export TokenUsage for backwards compatibility
export type { TokenUsage } from '../types'

// Re-export learning method types
export type {
	LearnOutput,
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
} from './learning-methods/types'

// Re-export query method types
export type { QueryMethodName, QueryResult } from './query-methods/types'

// Re-export EventUsage from base
export type { EventUsage } from '../base/types'

/**
 * TextLearner event map
 *
 * Extends SharedLearnerEventMap with narrowed types for text-specific fields.
 * At runtime, BaseLearner emits using SharedLearnerEventMap (understanding = unknown).
 * This type narrows understanding fields to string for consumers that know
 * they're working with a TextLearner.
 */
export interface TextLearnerEventMap extends SharedLearnerEventMap {
	'learner:synthesized': {
		learnerId: string
		newUnderstanding: string
		previousUnderstanding: string
		significance: Significance
		evolution: string
		usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
	}
	'learner:config:updated': {
		learnerId: string
		changedFields: string[]
		config: ResolvedTextLearnerConfig
	}
	'learner:understanding:set': {
		learnerId: string
		understanding: string
	}
}

/**
 * Union type of all TextLearner events
 */
export type TextLearnerEvent = EventsFromMap<TextLearnerEventMap>

/**
 * Maintenance configuration for TextLearner
 */
export interface TextLearnerMaintenance {
	/** How understanding evolves over time */
	strategy: Strategy
	/** Max tokens before maintenance kicks in (for cumulative/decay) */
	maxTokens?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query phase configuration
 */
export interface QueryConfig {
	/** Optional model override for query phase */
	model?: LanguageModel
	/** Query method to use */
	method?: QueryMethodName
}

/**
 * Resolved query config
 */
export interface ResolvedQueryConfig {
	model: LanguageModel
	method: QueryMethodName
}

// ─────────────────────────────────────────────────────────────────────────────
// TextLearner Config (input)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a TextLearner
 */
export interface TextLearnerConfig extends CascadableConfig {
	/** Default model for all operations */
	model: LanguageModel
	/** Natural language instructions for what this learner tracks and watches for */
	instructions: string
	/** Optional focus areas to narrow observation filtering */
	focus?: string
	/** Optional unique identifier */
	id?: string
	/** Optional display name */
	name?: string
	/** Optional description of learner purpose */
	description?: string
	/** How the learner was created */
	origin?: LearnerOrigin
	/** Maintenance settings for understanding compression */
	maintenance?: TextLearnerMaintenance
	/** Observe phase configuration */
	observe?: Partial<ObserveConfig>
	/** Synthesize phase configuration */
	synthesize?: Partial<SynthesizeConfig>
	/** Query phase configuration */
	query?: QueryConfig
	/** Governance configuration (Living Brain) */
	governance?: Partial<import('../types').LearnerGovernance>
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved TextLearner Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved observe config
 */
export interface ResolvedObserveConfig {
	method: 'direct'
	model: LanguageModel
	blueprintModel: LanguageModel
}

/**
 * Resolved synthesize config
 */
export interface ResolvedSynthesizeConfig {
	method: 'direct'
	model: LanguageModel
	blueprintModel: LanguageModel
	thresholds: Required<SynthesizeThresholds>
}

/**
 * Resolved maintenance config
 */
export interface ResolvedMaintenanceConfig {
	strategy: Strategy
	maxTokens: number
}

/**
 * Fully resolved TextLearner config
 */
export interface ResolvedTextLearnerConfig extends ResolvedCascadableConfig {
	instructions: string
	id: string
	origin: LearnerOrigin
	maintenance: ResolvedMaintenanceConfig
	observe: ResolvedObserveConfig
	synthesize: ResolvedSynthesizeConfig
	query: ResolvedQueryConfig
}

/**
 * Result from TextLearner.update()
 */
export interface TextLearnerUpdateResult {
	changedFields: string[]
	config: ResolvedTextLearnerConfig
}

/**
 * Default thresholds for synthesis triggers
 */
export const DEFAULT_THRESHOLDS: SynthesizeThresholds = {
	maxObservations: 10,
	maxTokens: 8000,
	minImportance: 0.5,
}
