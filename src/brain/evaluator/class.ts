/**
 * Evaluator: Decision-making component for Living Brain evolution
 *
 * Buffers signals from learners and external sources, then uses LLM
 * with tools to investigate and determine what evolution actions
 * (create, merge, split, update, delete) are needed.
 *
 * Tool-based approach:
 * - LLM receives signals + learner metadata (lightweight context)
 * - LLM can call getUnderstandings() to fetch learner knowledge as needed
 * - LLM calls finalizeDecisions() when done investigating
 */

import { TypedEmitter } from '../../types/events'
import { generate, stepCountIs } from '../../llm'
import { evaluatorSystemPrompt } from './prompt.system'
import { evaluationPromptTemplate } from './prompt.template.evaluation'
import {
	createGetUnderstandingsTool,
	createGetLearnerActivityTool,
	createGetRecentHistoryTool,
	finalizeDecisions,
	type FinalizeDecisionsParams,
} from './tools'
import type {
	Signal,
	EvolutionDecision,
	EvolutionHistoryEntry,
	EvaluatorEventMap,
} from './types'
import type { Brain } from '../class'

const MAX_EVALUATION_STEPS = 10

export class Evaluator extends TypedEmitter<EvaluatorEventMap> {
	private signals: Signal[] = []
	private history: EvolutionHistoryEntry[] = []
	private isEvaluating = false
	private readonly threshold: number
	private readonly brain: Brain
	includeUnderstanding = true

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

		if (this.isEvaluating) return

		// Auto-evaluate: bypass signals trigger immediately, otherwise wait for threshold
		if (
			signal.bypass ||
			(this.signals.length >= this.threshold &&
			this.brain.config.evolution.autoEvaluate)
		) {
			this.isEvaluating = true
			this.evaluate('auto')
				.catch((error) => {
					this.emit('evaluator:evaluation:failed', {
						error: error instanceof Error ? error.message : String(error),
					})
				})
				.finally(() => {
					this.isEvaluating = false
				})
		}
	}

	/**
	 * Evaluate buffered signals and generate evolution decisions
	 *
	 * Uses tool-based approach:
	 * 1. LLM sees signals + learner metadata
	 * 2. LLM calls getUnderstandings() to investigate as needed
	 * 3. LLM calls finalizeDecisions() to return decisions
	 *
	 * @returns Array of evolution decisions (can be empty)
	 */
	async evaluate(source: 'auto' | 'manual' = 'manual'): Promise<EvolutionDecision[]> {
		if (this.signals.length === 0) {
			return []
		}

		this.emit('evaluator:evaluation:started', {
			signalCount: this.signals.length,
		})

		try {
			// Build context for LLM
			const context = await this.buildContext()

			// Create tools with brain context
			const getUnderstandings = createGetUnderstandingsTool(this.brain)
			const getLearnerActivity = createGetLearnerActivityTool(this.brain)
			const getRecentHistory = createGetRecentHistoryTool(this.history)
			const tools = {
				getUnderstandings,
				getLearnerActivity,
				getRecentHistory,
				finalizeDecisions,
			}

			// Call LLM with tools
			const result = await generate({
				model: this.brain.config.blueprintModel,
				system: evaluatorSystemPrompt,
				prompt: this.formatEvaluationPrompt(context),
				tools,
				toolChoice: 'required',
				stopWhen: stepCountIs(MAX_EVALUATION_STEPS),
			})

			// Extract decisions from finalizeDecisions tool call
			// Check both result.toolCalls and steps (multi-step scenarios)
			let finalizeCall = result.toolCalls.find(
				(c) => c.toolName === 'finalizeDecisions',
			)

			if (!finalizeCall) {
				for (const step of result.steps) {
					const call = step.toolCalls.find(
						(c) => c.toolName === 'finalizeDecisions',
					)
					if (call) {
						finalizeCall = call
						break
					}
				}
			}

			let decisions: EvolutionDecision[] = []
			if (finalizeCall && 'input' in finalizeCall) {
				const params = finalizeCall.input as FinalizeDecisionsParams
				decisions = params.decisions
			}

			this.emit('evaluator:evaluation:completed', {
				source,
				decisionCount: decisions.length,
				decisions,
			})

			// Record history (capped at 10)
			const historyEntry: EvolutionHistoryEntry = {
				timestamp: new Date(),
				decisions: decisions.map((d) => ({
					action: d.action,
					targets: d.targets,
					reasoning: d.reasoning,
				})),
			}
			this.history.push(historyEntry)
			if (this.history.length > 10) this.history.shift()

			// Persist to brain store
			await this.brain.store.evolution.add({
				id: `eval_${Date.now()}`,
				decisions: historyEntry.decisions,
				source,
				created_at: historyEntry.timestamp.toISOString(),
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
	 * Restore a history entry from persisted store
	 */
	restoreHistoryEntry(entry: EvolutionHistoryEntry): void {
		this.history.push(entry)
		if (this.history.length > 10) this.history.shift()
	}

	/**
	 * Build context object for evaluation
	 */
	private async buildContext() {
		const learners = await Promise.all(
			Array.from(this.brain.learners.values()).map(async (learner) => {
				const health = learner.getHealth()
				const metrics = learner.getMetrics()
				const understanding = await learner.getUnderstanding()
				return {
					id: learner.id,
					name: learner.id,
					type: learner.type,
					purpose: this.extractPurpose(learner.instructions),
					understandingSize: String(understanding).length,
					health: {
						activation: health.activation,
						status: health.status,
						lastAccessed: health.lastAccessed,
					},
					metrics: {
						queryCount: metrics.query.count,
						dismissalRate: metrics.ingestion.dismissalRate,
						synthesisCount: metrics.ingestion.synthesisCount,
						observationsSinceLastSynthesis:
							metrics.ingestion.observationsSinceLastSynthesis,
					},
				}
			}),
		)

		return {
			brain: {
				prompt: this.brain.prompt,
				learnerCount: this.brain.learners.size,
			},
			includeUnderstanding: this.includeUnderstanding,
			learners,
		}
	}

	/**
	 * Format the evaluation prompt with signals and context
	 */
	private formatEvaluationPrompt(
		context: Awaited<ReturnType<typeof this.buildContext>>,
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
