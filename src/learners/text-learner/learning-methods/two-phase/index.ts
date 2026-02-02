/**
 * Two-phase learning method
 *
 * Separates observation (capture) from synthesis (understanding update).
 * This reduces understanding degradation by only rewriting during synthesis.
 */

import type { LanguageModel } from 'ai'
import type {
	TwoPhaseConfig,
	LearnOutput,
	LearnOptions,
	LearnCallbacks,
	InitOutput,
} from './types'
import type { ObserveIdentity } from './observe/schema.identity'
import type { SynthesizeIdentity } from './synthesize/schema.identity'
import { ObservationBuffer } from './buffer'
import { initObserve, observe } from './observe'
import { initSynthesize, synthesize } from './synthesize'

/**
 * Two-phase learning method
 *
 * Orchestrates observe → buffer → synthesize flow.
 */
export class TwoPhaseMethod {
	readonly name = 'two-phase'

	private model: LanguageModel
	private config: TwoPhaseConfig
	private buffer: ObservationBuffer

	// Generated during init (identities stored for potential debugging/introspection)
	private _observeIdentity: ObserveIdentity | null = null
	private _synthesizeIdentity: SynthesizeIdentity | null = null
	private observeSystemPrompt: string | null = null
	private synthesizeSystemPrompt: string | null = null

	constructor(model: LanguageModel, config: TwoPhaseConfig) {
		this.model = model
		this.config = config
		this.buffer = new ObservationBuffer()
	}

	/**
	 * Get observe system prompt (null if not initialized)
	 */
	get observePrompt(): string | null {
		return this.observeSystemPrompt
	}

	/**
	 * Get synthesize system prompt (null if not initialized)
	 */
	get synthesizePrompt(): string | null {
		return this.synthesizeSystemPrompt
	}

	/**
	 * Get observe identity (for debugging/introspection)
	 */
	get observeIdentity(): ObserveIdentity | null {
		return this._observeIdentity
	}

	/**
	 * Get synthesize identity (for debugging/introspection)
	 */
	get synthesizeIdentity(): SynthesizeIdentity | null {
		return this._synthesizeIdentity
	}

	/**
	 * Initialize the two-phase method
	 *
	 * Generates identities and system prompts for both phases.
	 * Uses blueprintModel for identity generation (one-time structured output).
	 *
	 * @param instructions - Learner's purpose/instructions
	 */
	async init(instructions: string): Promise<InitOutput> {
		// Use blueprintModel for identity generation (one-time structured output)
		const observeBlueprintModel = this.config.observe.blueprintModel ?? this.model
		const synthesizeBlueprintModel = this.config.synthesize.blueprintModel ?? this.model

		// Initialize both phases
		const [observeResult, synthesizeResult] = await Promise.all([
			initObserve(observeBlueprintModel, instructions),
			initSynthesize(synthesizeBlueprintModel, instructions, this.config.strategy),
		])

		this._observeIdentity = observeResult.identity
		this.observeSystemPrompt = observeResult.systemPrompt
		this._synthesizeIdentity = synthesizeResult.identity
		this.synthesizeSystemPrompt = synthesizeResult.systemPrompt

		return {
			observeSystemPrompt: this.observeSystemPrompt,
			synthesizeSystemPrompt: this.synthesizeSystemPrompt,
		}
	}

	/**
	 * Learn from data
	 *
	 * Observes data, buffers observations, and synthesizes when thresholds met.
	 *
	 * @param learnerId - Learner's unique identifier
	 * @param instructions - Learner's purpose/instructions
	 * @param currentUnderstanding - Current understanding
	 * @param data - Data to learn from
	 * @param options - Learn options (forceSynthesize, etc.)
	 * @param callbacks - Callbacks for observability
	 */
	async learn(
		learnerId: string,
		instructions: string,
		currentUnderstanding: string,
		data: unknown[],
		options?: LearnOptions,
		callbacks?: LearnCallbacks,
	): Promise<LearnOutput> {
		if (!this.observeSystemPrompt || !this.synthesizeSystemPrompt) {
			throw new Error('TwoPhaseMethod not initialized. Call init() first.')
		}

		const observeModel = this.config.observe.model ?? this.model
		const synthesizeModel = this.config.synthesize.model ?? this.model

		// Handle forceSynthesize with empty data — skip observe, go straight to synthesis
		if (options?.forceSynthesize && data.length === 0 && this.buffer.count > 0) {
			const observations = this.buffer.getTexts()
			const synthesizeResult = await synthesize(
				synthesizeModel,
				this.synthesizeSystemPrompt,
				{ learnerId, instructions, currentUnderstanding, observations },
				{ onThinking: callbacks?.onSynthesizeThinking },
			)

			this.buffer.clear()

			if (synthesizeResult.status === 'error') {
				return { status: 'synthesize:error', error: synthesizeResult.error }
			}
			if (synthesizeResult.status === 'dismissed') {
				return { status: 'synthesize:dismissed', output: synthesizeResult.output }
			}
			return {
				status: 'synthesized',
				newUnderstanding: synthesizeResult.newUnderstanding,
				significance: synthesizeResult.significance,
				evolution: synthesizeResult.evolution,
				reasoning: synthesizeResult.reasoning,
			}
		}

		// Phase 1: Observe
		const observeResult = await observe(
			observeModel,
			this.observeSystemPrompt,
			{ learnerId, instructions, data },
			{ onThinking: callbacks?.onObserveThinking },
		)

		// Handle observe outcomes
		if (observeResult.status === 'error') {
			return {
				status: 'observe:error',
				error: observeResult.error,
			}
		}

		if (observeResult.status === 'dismissed') {
			return {
				status: 'observe:dismissed',
				output: observeResult.output,
			}
		}

		// Buffer the observation
		this.buffer.add({
			text: observeResult.output,
			importance: observeResult.importance,
		})

		// Check if synthesis should happen
		const shouldSynthesize =
			options?.forceSynthesize ||
			this.buffer.shouldSynthesize(this.config.synthesize.thresholds)

		if (!shouldSynthesize) {
			return {
				status: 'observed',
				output: observeResult.output,
			}
		}

		// Phase 2: Synthesize
		const observations = this.buffer.getTexts()
		const synthesizeResult = await synthesize(
			synthesizeModel,
			this.synthesizeSystemPrompt,
			{ learnerId, instructions, currentUnderstanding, observations },
			{ onThinking: callbacks?.onSynthesizeThinking },
		)

		// Clear buffer after synthesis
		this.buffer.clear()

		// Handle synthesize outcomes
		if (synthesizeResult.status === 'error') {
			return {
				status: 'synthesize:error',
				error: synthesizeResult.error,
			}
		}

		if (synthesizeResult.status === 'dismissed') {
			return {
				status: 'synthesize:dismissed',
				output: synthesizeResult.output,
			}
		}

		return {
			status: 'synthesized',
			newUnderstanding: synthesizeResult.newUnderstanding,
			significance: synthesizeResult.significance,
			evolution: synthesizeResult.evolution,
			reasoning: synthesizeResult.reasoning,
		}
	}

	/**
	 * Get current buffer state (for debugging/observability)
	 */
	getBufferState(): {
		count: number
		avgImportance: number
		totalTokens: number
	} {
		return {
			count: this.buffer.count,
			avgImportance: this.buffer.avgImportance,
			totalTokens: this.buffer.totalTokens,
		}
	}

	/**
	 * Get all buffered observations (for debugging/observability)
	 */
	getBufferedObservations(): Array<{ text: string; importance: number }> {
		return this.buffer.getAll()
	}
}

// Re-export types
export type {
	TwoPhaseConfig,
	LearnOutput,
	LearnOptions,
	LearnCallbacks,
	InitOutput,
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
} from './types'

export type { ObserveOutput, ObserveContext } from './observe/types'
export type { SynthesizeOutput, SynthesizeContext } from './synthesize/types'
export type { ObserveIdentity } from './observe/schema.identity'
export type { SynthesizeIdentity } from './synthesize/schema.identity'
