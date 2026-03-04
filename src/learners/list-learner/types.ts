/**
 * Types for ListLearner
 *
 * A learner that maintains understanding as a structured collection of items.
 */

import type { LanguageModel } from 'ai'
import type { CascadableConfig } from '../../types/config'
import type { BaseLearnerState } from '../base/state'
import type { BaseResolvedConfig, UnderstandThresholds } from '../base/types'
import type { EventsFromMap } from '../../types/events'
import type {
	LearnerHealth,
	LearnerOrigin,
	Significance,
} from '../types'
import type { SharedLearnerEventMap } from '../base/types'
import type { Store } from '../stores'
import type { UnderstandIdentity } from './understand'

// ── Core types ─────────────────────────────────────────────────────────────

export interface ListItem {
	id: string
	data: Record<string, unknown>
	metadata: {
		confidence: number
		touchCount: number
		firstSeen: string
		lastUpdated: string
		signals: string[]
	}
}

export type ListOperation =
	| {
			type: 'add'
			item: {
				data: Record<string, unknown>
				metadata?: Partial<ListItem['metadata']>
			}
	  }
	| {
			type: 'update'
			id: string
			changes: {
				data?: Record<string, unknown>
				metadata?: Partial<ListItem['metadata']>
			}
	  }
	| {
			type: 'remove'
			id: string
			reason: string
	  }

// ── List governance ────────────────────────────────────────────────────────

export interface ListGovernanceConfig {
	/** Deduplication mode */
	deduplication?: 'strict' | 'none'
	/** Max items before pruning */
	maxItems?: number
	/** How to prune when maxItems exceeded */
	pruning?: 'oldest' | 'least-confident' | 'none'
}

export interface ResolvedListGovernanceConfig {
	deduplication: 'strict' | 'none'
	maxItems: number
	pruning: 'oldest' | 'least-confident' | 'none'
}

// ── Event map ──────────────────────────────────────────────────────────────

export interface ListLearnerEventMap extends SharedLearnerEventMap {
	'learner:synthesized': {
		learnerId: string
		newUnderstanding: ListItem[]
		previousUnderstanding: ListItem[]
		significance: Significance
		evolution: string
		usage?: {
			inputTokens?: number
			outputTokens?: number
			totalTokens?: number
		}
	}
	'learner:config:updated': {
		learnerId: string
		changedFields: string[]
		config: ResolvedListLearnerConfig
	}
	'learner:understanding:set': {
		learnerId: string
		understanding: ListItem[]
	}
}

export type ListLearnerEvent = EventsFromMap<ListLearnerEventMap>

// ── Config ─────────────────────────────────────────────────────────────────

export interface ListLearnerConfig extends CascadableConfig {
	/** Default model for all operations */
	model: LanguageModel
	/** Natural language instructions for what items this learner tracks */
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
	/** Injected store */
	store: Store
	/** List-specific governance (dedup, maxItems, pruning) */
	governance?: ListGovernanceConfig
	/** Observer phase configuration */
	observer?: { model?: LanguageModel; blueprintModel?: LanguageModel }
	/** Understand phase configuration */
	understand?: {
		model?: LanguageModel
		blueprintModel?: LanguageModel
		thresholds?: UnderstandThresholds
	}
	/** Query phase configuration */
	query?: { model?: LanguageModel }
	/** Health configuration (Living Brain) */
	health?: Partial<LearnerHealth>
	/** Skip observation phase — data goes directly to understanding buffer */
	skipObservation?: boolean
}

// ── Resolved config ────────────────────────────────────────────────────────

export interface ResolvedListLearnerConfig extends BaseResolvedConfig {
	governance: ResolvedListGovernanceConfig
}

export interface ListLearnerUpdateResult {
	changedFields: string[]
	config: ResolvedListLearnerConfig
}

// ── State ──────────────────────────────────────────────────────────────────

export interface ListLearnerState extends BaseLearnerState {
	understand_identity: UnderstandIdentity | null
	governance: ResolvedListGovernanceConfig
}
