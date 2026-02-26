/**
 * Evolution Orchestrator - Groups decisions by action and dispatches to handlers
 */

import type { Brain } from '../class'
import type { EvolutionDecision } from '../evaluator/types'
import { EVOLUTION_ACTIONS } from '../evaluator/types'
import { isInternalLearnerId } from '../internal-learners'
import { CreateHandler } from './handlers/create'
import { MergeHandler } from './handlers/merge'
import { SplitHandler } from './handlers/split'
import { UpdateHandler } from './handlers/update'
import { DeleteHandler } from './handlers/delete'
import type { EvolutionActionHandler } from './base-handler'
import type { AggregatedEvolutionResult, EvolutionActionResult } from './types'

/**
 * Orchestrates evolution action execution
 *
 * Groups decisions by action type and dispatches each group to its handler.
 */
export class EvolutionOrchestrator {
	private handlers: Map<string, EvolutionActionHandler>

	constructor(brain: Brain) {
		this.handlers = new Map<string, EvolutionActionHandler>([
			[EVOLUTION_ACTIONS.create, new CreateHandler(brain)],
			[EVOLUTION_ACTIONS.merge, new MergeHandler(brain)],
			[EVOLUTION_ACTIONS.split, new SplitHandler(brain)],
			[EVOLUTION_ACTIONS.update, new UpdateHandler(brain)],
			[EVOLUTION_ACTIONS.delete, new DeleteHandler(brain)],
		])
	}

	/**
	 * Execute evolution decisions grouped by action type
	 *
	 * @param decisions - Array of evolution decisions from Evaluator
	 * @returns Aggregated results from all handlers
	 */
	async executeDecisions(decisions: EvolutionDecision[]): Promise<AggregatedEvolutionResult> {
		// Filter out decisions targeting internal learners (protected from evolution)
		const filtered = decisions.filter(
			(d) => !d.targets.some(isInternalLearnerId),
		)

		const aggregated: AggregatedEvolutionResult = {
			created: [],
			updated: [],
			deleted: [],
			merged: [],
			split: [],
		}

		const grouped = new Map<string, EvolutionDecision[]>()

		for (const decision of filtered) {
			const group = grouped.get(decision.action) ?? []
			group.push(decision)
			grouped.set(decision.action, group)
		}

		for (const [action, group] of grouped) {
			const handler = this.handlers.get(action)
			if (!handler) continue

			try {
				const result: EvolutionActionResult = await handler.execute(group)
				this.aggregateResult(aggregated, action, result)
			} catch {
				// Individual handler failures are already emitted via emitActionFailed
			}
		}

		return aggregated
	}

	/**
	 * Execute a single decision directly (for manual evolution API)
	 *
	 * @param decision - Evolution decision to execute
	 * @returns Result of the action execution
	 */
	async executeSingleDecision(decision: EvolutionDecision): Promise<any> {
		// Protect internal learners from evolution
		if (decision.targets.some(isInternalLearnerId)) {
			throw new Error('Cannot evolve internal learners')
		}

		const handler = this.handlers.get(decision.action)

		if (!handler) {
			throw new Error(`No handler found for action: ${decision.action}`)
		}

		return handler.execute([decision])
	}

	private aggregateResult(
		aggregated: AggregatedEvolutionResult,
		action: string,
		result: EvolutionActionResult,
	): void {
		if ('newLearnerIds' in result) {
			if (action === EVOLUTION_ACTIONS.create) {
				aggregated.created.push(...result.newLearnerIds)
			} else if (action === EVOLUTION_ACTIONS.merge) {
				aggregated.merged.push(...result.newLearnerIds)
			} else if (action === EVOLUTION_ACTIONS.split) {
				aggregated.split.push(...result.newLearnerIds)
			}
		}
		if ('updatedLearnerIds' in result) {
			aggregated.updated.push(...result.updatedLearnerIds)
		}
		if ('deletedLearnerIds' in result) {
			aggregated.deleted.push(...result.deletedLearnerIds)
		}
	}
}
