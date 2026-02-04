/**
 * Evolution Orchestrator - Sequential execution of evolution actions
 */

import type { Brain } from '../class'
import type { EvolutionDecision } from '../evaluator/types'
import { EVOLUTION_ACTIONS } from '../evaluator/types'
import { CreateHandler } from './handlers/create'
import { MergeHandler } from './handlers/merge'
import { SplitHandler } from './handlers/split'
import { UpdateHandler } from './handlers/update'
import { DeleteHandler } from './handlers/delete'
import type { EvolutionActionHandler } from './base-handler'

/**
 * Orchestrates sequential execution of evolution actions
 *
 * Decisions are executed one at a time to avoid conflicts
 * (e.g., updating then deleting the same learner)
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
	 * Execute evolution decisions sequentially
	 *
	 * @param decisions - Array of evolution decisions from Evaluator
	 * @throws If any decision fails to execute
	 */
	async executeDecisions(decisions: EvolutionDecision[]): Promise<void> {
		// Execute sequentially to avoid conflicts
		for (const decision of decisions) {
			const handler = this.handlers.get(decision.action)

			if (!handler) {
				throw new Error(`No handler found for action: ${decision.action}`)
			}

			await handler.execute(decision)
		}
	}

	/**
	 * Execute a single decision directly (for manual evolution API)
	 *
	 * @param decision - Evolution decision to execute
	 * @returns Result of the action execution
	 */
	async executeSingleDecision(decision: EvolutionDecision): Promise<any> {
		const handler = this.handlers.get(decision.action)

		if (!handler) {
			throw new Error(`No handler found for action: ${decision.action}`)
		}

		return handler.execute(decision)
	}
}
