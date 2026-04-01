import type { LanguageModel } from 'ai'
import type { CascadableConfig } from '../../types/config'
import type { BaseNeuronState } from '../base/state'
import type { BaseResolvedConfig, UnderstandThresholds } from '../base/types'
import type { EventsFromMap } from '../../types/events'
import type {
	NeuronOrigin,
	Significance,
} from '../types'
import type { SharedNeuronEventMap } from '../base/types'
import type { NeuronStore } from '../../stores'
import type { Strategy } from './strategies'
import type { UnderstandIdentity } from './understand'

/**
 * TextNeuron event map
 *
 * Extends SharedNeuronEventMap with narrowed types for text-specific fields.
 */
export interface TextNeuronEventMap extends SharedNeuronEventMap {
	'neuron:synthesized': {
		neuronId: string
		newUnderstanding: string
		previousUnderstanding: string
		significance: Significance
		evolution: string
		usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
	}
	'neuron:config:updated': {
		neuronId: string
		changedFields: string[]
		config: ResolvedTextNeuronConfig
	}
	'neuron:understanding:set': {
		neuronId: string
		understanding: string
	}
}

export type TextNeuronEvent = EventsFromMap<TextNeuronEventMap>

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

// ── TextNeuron Config (input) ──────────────────────────────────────────────

export interface TextNeuronConfig extends CascadableConfig {
	/** Default model for all operations */
	model: LanguageModel
	/** Natural language instructions for what this neuron tracks and watches for */
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
	health?: Partial<import('../types').NeuronHealth>
	/** Skip observation phase — data goes directly to understanding buffer */
	skipObservation?: boolean
	/** Custom observation schema — skips LLM generation when provided */
	observationSchema?: Record<string, unknown>
	/** Custom understanding schema — skips LLM generation when provided */
	understandingSchema?: Record<string, unknown>
}

// ── Resolved Config ─────────────────────────────────────────────────────────

export interface ResolvedTextNeuronConfig extends BaseResolvedConfig {
	governance: ResolvedGovernanceConfig
}

export interface TextNeuronUpdateResult {
	changedFields: string[]
	config: ResolvedTextNeuronConfig
}

// ── State ──────────────────────────────────────────────────────────────────

export interface TextNeuronState extends BaseNeuronState {
	understand_identity: UnderstandIdentity | null
	governance: ResolvedGovernanceConfig
}
