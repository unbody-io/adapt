import type { LanguageModel } from 'ai'
import type {
	CascadableConfig,
	ResolvedCascadableConfig,
} from '../../types/config'
import type { EventsFromMap } from '../../types/events'
import type {
	BaseLearnerEventMap,
	LearnerOrigin,
	Significance,
	TokenUsage,
} from '../types'
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

/**
 * Usage data for events
 */
export interface EventUsage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

/**
 * TextLearner event map
 *
 * Extends base events with two-phase learning events.
 */
export interface TextLearnerEventMap extends BaseLearnerEventMap {
	// Observe phase events
	'learner:observe:started': {
		learnerId: string
		itemCount: number
	}
	'learner:observe:thinking': {
		learnerId: string
		thoughts: string[]
		usage: TokenUsage
	}
	'learner:observed': {
		learnerId: string
		output: string[]
		importance: number
		bufferCount: number
		usage?: EventUsage
	}
	'learner:observe:dismissed': {
		learnerId: string
		output: string[]
		usage?: EventUsage
	}
	'learner:observe:error': {
		learnerId: string
		error: unknown
	}

	// Synthesize phase events
	'learner:synthesize:started': {
		learnerId: string
		observationCount: number
	}
	'learner:synthesize:thinking': {
		learnerId: string
		thoughts: string[]
		usage: TokenUsage
	}
	'learner:synthesized': {
		learnerId: string
		newUnderstanding: string
		previousUnderstanding: string
		significance: Significance
		evolution: string
		usage?: EventUsage
	}
	'learner:synthesize:dismissed': {
		learnerId: string
		output: string
		usage?: EventUsage
	}
	'learner:synthesize:error': {
		learnerId: string
		error: unknown
	}

	// Learn phase errors
	'learner:learn:failed': {
		learnerId: string
		error: string
	}

	// Query phase events
	'learner:query:thinking': {
		learnerId: string
		thoughts: string[]
		usage: TokenUsage
	}

	// Signal events (Living Brain)
	'learner:signal': {
		learnerId: string
		description: string
		timestamp: Date
		metrics?: {
			dismissalRate?: number
			avgRelevance?: number
			avgConfidence?: number
			gapCount?: number
			bufferCount?: number
			activation?: number
		}
	}

	// Config update events (Living Brain)
	'learner:config:updated': {
		learnerId: string
		changedFields: string[]
		config: ResolvedTextLearnerConfig
	}

	'learner:prompts:regenerated': {
		learnerId: string
		observePrompt: string
		synthesizePrompt: string
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
