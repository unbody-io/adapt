/**
 * Evaluator: Decision-making component for Living Brain evolution
 *
 * Buffers signals from learners and external sources, then uses LLM
 * to determine what evolution actions (create, merge, split, adjust, delete)
 * are needed to improve system effectiveness.
 */

import { Output } from 'ai'
import { TypedEmitter } from '../../types/events'
import { generate } from '../../llm'
import { evaluatorSystemPrompt } from './prompt.system'
import { evaluationPromptTemplate } from './prompt.template.evaluation'
import { evolutionDecisionsSchema } from './schema'
import type {
	Signal,
	EvolutionDecision,
	EvaluatorEventMap,
} from './types'
import type { Brain } from '../class'

export class Evaluator extends TypedEmitter<EvaluatorEventMap> {
	private signals: Signal[] = []
	private readonly threshold: number
	private readonly brain: Brain

	constructor(brain: Brain, threshold: number = 5) {
		super()
		this.brain = brain
		this.threshold = threshold
	}

	/**
	 * Receive a signal from a learner or external source
	 */
	signal(signal: Signal): void {
		this.signals.push(signal)

		// Auto-evaluate when threshold reached (if enabled)
		if (
			this.signals.length >= this.threshold &&
			this.brain.config.evolution.autoEvaluate
		) {
			// Fire and forget - don't block signal emission
			this.evaluate().catch((error) => {
				this.emit('evaluator:evaluation:failed', {
					error: error instanceof Error ? error.message : String(error),
				})
			})
		}
	}

	/**
	 * Evaluate buffered signals and generate evolution decisions
	 *
	 * @returns Array of evolution decisions (can be empty)
	 */
	async evaluate(): Promise<EvolutionDecision[]> {
		if (this.signals.length === 0) {
			return []
		}

		this.emit('evaluator:evaluation:started', {
			signalCount: this.signals.length,
		})

		try {
			// Build context for LLM
			const context = this.buildContext()

			// Call LLM to generate decisions
			const result = await generate({
				model: this.brain.config.model,
				system: evaluatorSystemPrompt,
				prompt: this.formatEvaluationPrompt(context),
				output: Output.object({ schema: evolutionDecisionsSchema }),
			})

			const decisions = result.output.decisions

			this.emit('evaluator:evaluation:completed', {
				decisionCount: decisions.length,
				decisions,
			})

			// Clear signal buffer after successful evaluation
			this.signals = []

			return decisions
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)

			this.emit('evaluator:evaluation:failed', {
				error: errorMessage,
			})

			throw new Error(`Evaluator evaluation failed: ${errorMessage}`)
		}
	}

	/**
	 * Get current signal buffer (for debugging/monitoring)
	 */
	getSignals(): Signal[] {
		return [...this.signals]
	}

	/**
	 * Clear signal buffer (for manual control)
	 */
	clearSignals(): void {
		this.signals = []
	}

	/**
	 * Build context object for evaluation
	 */
	private buildContext() {
		return {
			brain: {
				prompt: this.brain.prompt,
				learnerCount: this.brain.learners.size,
			},
			learners: Array.from(this.brain.learners.values()).map((learner) => {
				const governance = learner.getGovernance()
				return {
					id: learner.id,
					name: learner.id, // Use ID as name for now
					purpose: this.extractPurpose(learner.instructions),
					governance: {
						activation: governance.activation,
						status: governance.status,
						lastAccessed: governance.lastAccessed,
						retrievalCount: governance.retrievalCount,
						successRate: governance.successRate,
					},
				}
			}),
		}
	}

	/**
	 * Format the evaluation prompt with signals and context
	 */
	private formatEvaluationPrompt(
		context: ReturnType<typeof this.buildContext>,
	): string {
		return evaluationPromptTemplate(context, this.signals)
	}

	/**
	 * Extract the first line or sentence from instructions as purpose
	 */
	private extractPurpose(instructions: string): string {
		// Try to get first sentence or first line
		const firstLine = instructions.split('\n')[0]
		const firstSentence = firstLine.split(/[.!?]/)[0]
		return firstSentence.trim() || firstLine.trim()
	}
}
