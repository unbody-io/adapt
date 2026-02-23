import type { LanguageModel } from 'ai'
import type { CascadableConfig } from '../../types/config'
import type { BaseResolvedConfig, UnderstandThresholds } from '../base/types'
import type { EventsFromMap } from '../../types/events'
import type {
	LearnerOrigin,
	Significance,
} from '../types'
import type { SharedLearnerEventMap } from '../base/types'
import type { Store } from '../stores'
import type { Strategy } from './strategies'

/**
 * TextLearner event map
 *
 * Extends SharedLearnerEventMap with narrowed types for text-specific fields.
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

export type TextLearnerEvent = EventsFromMap<TextLearnerEventMap>

// ── Governance ──────────────────────────────────────────────────────────────

export interface TextGovernanceConfig {
	/** How understanding evolves over time */
	strategy: Strategy
	/** Max tokens before governance kicks in (for cumulative/decay) */
	maxTokens?: number
}

export interface ResolvedGovernanceConfig {
	strategy: Strategy
	maxTokens: number
}

// ── Query ───────────────────────────────────────────────────────────────────

export interface QueryConfig {
	/** Optional model override for query phase */
	model?: LanguageModel
}

// ── TextLearner Config (input) ──────────────────────────────────────────────

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
	/** Injected store (defaults to MemoryStore if not provided) */
	store?: Store
	/** Governance settings for understanding management */
	governance?: TextGovernanceConfig
	/** Observer phase configuration */
	observer?: { model?: LanguageModel; blueprintModel?: LanguageModel }
	/** Understand phase configuration */
	understand?: {
		model?: LanguageModel
		blueprintModel?: LanguageModel
		thresholds?: UnderstandThresholds
	}
	/** Query phase configuration */
	query?: QueryConfig
	/** Health configuration (Living Brain) */
	health?: Partial<import('../types').LearnerHealth>
}

// ── Resolved Config ─────────────────────────────────────────────────────────

export interface ResolvedTextLearnerConfig extends BaseResolvedConfig {
	governance: ResolvedGovernanceConfig
}

export interface TextLearnerUpdateResult {
	changedFields: string[]
	config: ResolvedTextLearnerConfig
}
