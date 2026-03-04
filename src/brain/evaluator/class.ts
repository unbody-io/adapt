/**
 * Evaluator: Decision-making component for Living Brain evolution
 *
 * Buffers signals from learners and external sources, then uses LLM
 * with tools to investigate and determine what evolution actions
 * (create, merge, split, update, delete) are needed.
 *
 * Tool-based approach:
 * - LLM receives signals + specialist metadata (lightweight context)
 * - LLM can call inspectSpecialist(), querySpecialist(), consultSystemKnowledge(), etc.
 * - LLM calls finalizeDecisions() when done investigating
 */

import { TypedEmitter } from '../../types/events'
import { generate, stepCountIs } from '../../llm'
import { evaluatorSystemPrompt } from './prompt.system'
import { evaluationPromptTemplate } from './prompt.template.evaluation'
import {
	createInspectSpecialistTool,
	createQuerySpecialistTool,
	createConsultSystemKnowledgeTool,
	createReviewDismissedDataTool,
	createReviewRecentDecisionsTool,
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
		this.maybeEvaluate()
	}

	/**
	 * Start an evaluation if conditions are met and one isn't already running.
	 */
	private maybeEvaluate(): void {
		if (this.isEvaluating) return
		if (this.signals.length === 0) return

		const hasBypass = this.signals.some((s) => s.bypass)
		const meetsThreshold =
			this.signals.length >= this.threshold &&
			this.brain.config.evolution.autoEvaluate

		if (!hasBypass && !meetsThreshold) return

		this.isEvaluating = true
		this.evaluate('auto')
			.catch((error) => {
				this.emit('evaluator:evaluation:failed', {
					error: error instanceof Error ? error.message : String(error),
				})
			})
			.finally(() => {
				this.isEvaluating = false
				// Signals may have arrived during evaluation — check again
				this.maybeEvaluate()
			})
	}

	/**
	 * Evaluate buffered signals and generate evolution decisions
	 *
	 * Uses tool-based approach:
	 * 1. LLM sees signals + specialist metadata
	 * 2. LLM calls tools to investigate as needed
	 * 3. LLM calls finalizeDecisions() to return decisions
	 *
	 * @returns Array of evolution decisions (can be empty)
	 */
	async evaluate(source: 'auto' | 'manual' = 'manual'): Promise<EvolutionDecision[]> {
		if (this.signals.length === 0) {
			return []
		}

		// Snapshot how many signals we're consuming. Signals arriving during
		// the LLM call stay in the buffer for the next evaluation.
		const consumedCount = this.signals.length

		this.emit('evaluator:evaluation:started', {
			signalCount: consumedCount,
		})

		try {
			// Build context for LLM
			const context = await this.buildContext()

			// Create tools with brain context
			const tools = {
				inspectSpecialist: createInspectSpecialistTool(this.brain),
				querySpecialist: createQuerySpecialistTool(this.brain),
				consultSystemKnowledge: createConsultSystemKnowledgeTool(this.brain),
				reviewDismissedData: createReviewDismissedDataTool(this.brain),
				reviewRecentDecisions: createReviewRecentDecisionsTool(this.history),
				finalizeDecisions,
			}

			// Call LLM with tools
			const prompt = this.formatEvaluationPrompt(context)
			const result = await generate({
				model: this.brain.config.blueprintModel,
				system: evaluatorSystemPrompt,
				prompt,
				tools,
				toolChoice: 'auto',
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

			// Remove only consumed signals — preserve any that arrived during evaluation
			this.signals.splice(0, consumedCount)

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
		const learners = Array.from(this.brain.learners.values()).map((learner) => {
			const health = learner.getHealth()
			const metrics = learner.getMetrics()
			return {
				id: learner.id,
				name: learner.name,
				type: learner.type,
				instructions: learner.instructions,
				health: {
					activation: health.activation,
					status: health.status,
				},
				metrics: {
					observationCount: metrics.ingestion.observationCount,
					synthesisCount: metrics.ingestion.synthesisCount,
					dismissalRate: metrics.ingestion.dismissalRate,
					queryCount: metrics.query.count,
				},
			}
		})

		const dismissedBatchCount = await this.brain.store.dismissedBatches.count()

		return {
			brain: {
				prompt: this.brain.prompt,
				evolutionContext: this.brain.evolutionContext,
				learnerCount: this.brain.learners.size,
			},
			learners,
			dismissedBatchCount,
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
}
