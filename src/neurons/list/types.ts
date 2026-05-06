/**
 * Types for ListNeuron
 *
 * A neuron that maintains understanding as a structured collection of items.
 */

import type { AdaptRepairOptions, LanguageModel } from '../../llm'
import type { NeuronStore } from '../../stores'
import type { CascadableConfig } from '../../types/config'
import type { EventsFromMap } from '../../types/events'
import type { BaseNeuronState } from '../base/state'
import type {
	BaseResolvedConfig,
	SharedNeuronEventMap,
	UnderstandThresholds,
} from '../base/types'
import type { NeuronHealth, NeuronOrigin, Significance } from '../types'
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

export interface ListNeuronEventMap extends SharedNeuronEventMap {
	'neuron:synthesized': {
		neuronId: string
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
	'neuron:config:updated': {
		neuronId: string
		changedFields: string[]
		config: ResolvedListNeuronConfig
	}
	'neuron:understanding:set': {
		neuronId: string
		understanding: ListItem[]
	}
}

export type ListNeuronEvent = EventsFromMap<ListNeuronEventMap>

// ── Config ─────────────────────────────────────────────────────────────────

export interface ListNeuronConfig extends CascadableConfig, AdaptRepairOptions {
	/** Default model for all operations */
	model: LanguageModel
	/** Natural language instructions for what items this neuron tracks */
	instructions: string
	/** Optional focus areas to narrow observation filtering */
	focus?: string
	/** Optional unique identifier */
	id?: string
	/** Optional display name */
	name?: string
	/** Optional description of neuron purpose */
	description?: string
	/** How the neuron was created */
	origin?: NeuronOrigin
	/** Injected store */
	store: NeuronStore
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
	health?: Partial<NeuronHealth>
	/** Skip observation phase — data goes directly to understanding buffer */
	skipObservation?: boolean
	/** Custom observation schema — skips LLM generation when provided */
	observationSchema?: Record<string, unknown>
	/** Custom understanding schema — skips LLM generation when provided */
	understandingSchema?: Record<string, unknown>
}

// ── Resolved config ────────────────────────────────────────────────────────

export interface ResolvedListNeuronConfig extends BaseResolvedConfig {
	governance: ResolvedListGovernanceConfig
}

export interface ListNeuronUpdateResult {
	changedFields: string[]
	config: ResolvedListNeuronConfig
}

// ── State ──────────────────────────────────────────────────────────────────

export interface ListNeuronState extends BaseNeuronState {
	understand_identity: UnderstandIdentity | null
	governance: ResolvedListGovernanceConfig
}
