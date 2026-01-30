import type { LanguageModel } from 'ai'
import type { Strategy } from './strategies'
import type { EvolutionEntry, LearnerOrigin, TokenUsage } from '../types'

// Re-export TokenUsage for backwards compatibility
export type { TokenUsage } from '../types'

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
 * Event emitted when an operation starts
 */
export interface LearnerStartEvent {
	operation: 'ingest' | 'ask'
	input: unknown
	understanding: string
}

/**
 * Event emitted after each agent step
 */
export interface LearnerStepEvent {
	/** Which operation triggered this step */
	operation: 'ingest' | 'ask'
	/** Step number (0-indexed) */
	stepNumber: number
	/** Tool calls made in this step (if any) */
	toolCalls?: Array<{
		toolName: string
		input: unknown
	}>
	/** Text generated in this step (if any) */
	text?: string
	/** Token usage for this step */
	usage?: TokenUsage
	/** Why this step finished */
	finishReason: string
}

/**
 * Event emitted when an operation completes
 */
export interface LearnerEndEvent {
	operation: 'ingest' | 'ask'
	/** Total steps taken */
	totalSteps: number
	/** Aggregated token usage */
	usage?: TokenUsage
	/** Duration in milliseconds */
	durationMs: number
	/** Whether the operation succeeded */
	success: boolean
	/** Error message if failed */
	error?: string
	/** Evolution entry for ingest operations (included when understanding changes) */
	entry?: EvolutionEntry
}

/**
 * Event emitted when system prompt initialization completes
 */
export interface LearnerInitializedEvent {
	/** The synthesized system prompt */
	systemPrompt: string
	/** Duration of initialization in milliseconds */
	durationMs: number
}

/**
 * Event emitted when system prompt initialization fails
 */
export interface LearnerInitErrorEvent {
	/** Error that occurred during initialization */
	error: Error
	/** Duration before failure in milliseconds */
	durationMs: number
}

/**
 * Callbacks for observing learner operations
 */
export interface LearnerObserver {
	/** Called when system prompt is synthesized (first ingest call) */
	onInitialized?: (event: LearnerInitializedEvent) => void | Promise<void>
	/** Called if system prompt synthesis fails */
	onInitError?: (event: LearnerInitErrorEvent) => void | Promise<void>
	/** Called when an operation starts */
	onStart?: (event: LearnerStartEvent) => void | Promise<void>
	/** Called after each agent step */
	onStep?: (event: LearnerStepEvent) => void | Promise<void>
	/** Called when an operation completes */
	onEnd?: (event: LearnerEndEvent) => void | Promise<void>
}

/**
 * Callback type for step events (simplified single-callback observer)
 */
export type OnStepCallback = (event: LearnerStepEvent) => void | Promise<void>

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
	/** Callback fired after each agent step (simplified observability) */
	onStep?: OnStepCallback
	/** Full observer for lifecycle events (start, step, end) */
	observer?: LearnerObserver
}
