import type { LanguageModel } from 'ai'
import type { Strategy } from './strategies'
import type { BaseLearnerEventMap, LearnerOrigin } from '../types'
import type { EventsFromMap } from '../../types/events'

// Re-export TokenUsage for backwards compatibility
export type { TokenUsage } from '../types'

/**
 * TextLearner event map
 *
 * Currently uses the base learner events without extensions.
 * Can be extended with TextLearner-specific events if needed.
 */
export interface TextLearnerEventMap extends BaseLearnerEventMap {}

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

/**
 * Configuration for creating a TextLearner
 */
export interface TextLearnerConfig {
	/** The language model to use (from AI SDK) */
	model: LanguageModel
	/** Natural language instructions for what this learner tracks and watches for */
	instructions: string
	/** Optional unique identifier */
	id?: string
	/** How the learner was created */
	origin?: LearnerOrigin
	/** Maintenance settings for understanding compression */
	maintenance?: TextLearnerMaintenance
	/** Max estimated tokens for input before chunking (default: 30000) */
	maxInputTokens?: number
}
