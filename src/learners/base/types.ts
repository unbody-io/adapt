/**
 * Shared types for all learner types
 *
 * SharedLearnerEventMap defines the events that BaseLearner emits.
 * Understanding-specific fields use `unknown` since each learner type
 * has a different understanding shape (string, ListItem[], etc.).
 */

import type { LanguageModel } from 'ai'
import type { ResolvedCascadableConfig } from '../../types/config'
import type {
	LearnerHealth,
	LearnerOrigin,
	LearnerStatus,
	Significance,
	TokenUsage,
} from '../types'

/**
 * Thresholds that trigger the understand phase
 */
export interface UnderstandThresholds {
	maxObservations?: number
	maxTokens?: number
	minImportance?: number
}

/**
 * Base resolved config — common fields shared across all learner types.
 *
 * Each subclass config extends this and adds type-specific fields (e.g. governance).
 */
export interface BaseResolvedConfig extends ResolvedCascadableConfig {
	instructions: string
	id: string
	origin: LearnerOrigin
	observer: { model: LanguageModel; blueprintModel: LanguageModel }
	understand: {
		model: LanguageModel
		blueprintModel: LanguageModel
		thresholds: Required<UnderstandThresholds>
	}
	query: { model: LanguageModel }
}

/**
 * Input shape for BaseLearner.update() — all fields optional.
 *
 * Type-specific fields (like governance) pass through via the index signature
 * and are handled by each subclass's applyTypeSpecificUpdates().
 */
export interface BaseLearnerUpdateInput {
	id?: string
	name?: string
	description?: string
	origin?: LearnerOrigin
	model?: LanguageModel
	blueprintModel?: LanguageModel
	instructions?: string
	focus?: string
	observer?: { model?: LanguageModel; blueprintModel?: LanguageModel }
	understand?: {
		model?: LanguageModel
		blueprintModel?: LanguageModel
		thresholds?: UnderstandThresholds
	}
	query?: { model?: LanguageModel }
	health?: Partial<LearnerHealth>
}

/**
 * Usage data for events (partial — LLM calls may not report all fields)
 */
export interface EventUsage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

/**
 * Event map shared across all learner types
 *
 * BaseLearner extends TypedEmitter<SharedLearnerEventMap>.
 * Understanding-typed fields use `unknown` — consumers can narrow
 * based on the concrete learner type if needed.
 */
export interface SharedLearnerEventMap {
	// Init
	'learner:init:started': { learnerId: string }
	'learner:init:completed': {
		learnerId: string
		systemPrompt: string
		usage: TokenUsage
	}
	'learner:init:failed': { learnerId: string; error: string }

	// Observe phase
	'learner:observe:started': { learnerId: string; itemCount: number }
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
	'learner:observe:error': { learnerId: string; error: unknown }

	// Synthesize phase (event names preserved for backward compat)
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
		newUnderstanding: unknown
		previousUnderstanding: unknown
		significance: Significance
		evolution: string
		usage?: EventUsage
	}
	'learner:synthesize:dismissed': {
		learnerId: string
		output: string
		usage?: EventUsage
	}
	'learner:synthesize:error': { learnerId: string; error: unknown }

	// Learn errors
	'learner:learn:failed': { learnerId: string; error: string }

	// Query
	'learner:query:started': { learnerId: string; query: string }
	'learner:query:completed': {
		learnerId: string
		insight: string
		relevant: boolean
		relevance: number
		confidence: number
		gaps: string[]
		usage: TokenUsage
	}
	'learner:query:failed': { learnerId: string; error: string }
	'learner:query:thinking': {
		learnerId: string
		thoughts: string[]
		usage: TokenUsage
	}

	// Health
	'learner:health:updated': {
		learnerId: string
		activation: number
		status: LearnerStatus
		previousStatus?: LearnerStatus
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

	// Config updates
	'learner:config:updated': {
		learnerId: string
		changedFields: string[]
		config: unknown
	}
	'learner:prompts:regenerated': {
		learnerId: string
		observePrompt: string
		understandPrompt: string
	}
	'learner:understanding:set': {
		learnerId: string
		understanding: unknown
	}
}
