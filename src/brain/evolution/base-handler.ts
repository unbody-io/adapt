/**
 * Base class for evolution action handlers
 */

import type { Brain } from '../class'
import type { EvolutionDecision } from '../evaluator/types'
import type { EvolutionActionResult } from './types'
import { TypedEmitter } from '../../types/events'

/**
 * Abstract base class for all evolution action handlers
 *
 * Each handler implements the execute() method to perform a specific evolution action
 * (create, merge, split, adjust, delete) using the guidance from an EvolutionDecision.
 */
export abstract class EvolutionActionHandler<
	TResult extends EvolutionActionResult = EvolutionActionResult,
> extends TypedEmitter<{}> {
	protected brain: Brain

	constructor(brain: Brain) {
		super()
		this.brain = brain
	}

	/**
	 * Execute the evolution action
	 *
	 * @param decision - The evolution decision with guidance and targets
	 * @returns Result of the action execution
	 */
	abstract execute(decision: EvolutionDecision): Promise<TResult>

	/**
	 * Emit action started event
	 */
	protected emitActionStarted(decision: EvolutionDecision): void {
		this.brain.__emitEvolutionEvent('evolution:action:started', {
			action: decision.action,
			targets: decision.targets,
			timestamp: new Date(),
		})
	}

	/**
	 * Emit action executed event
	 */
	protected emitActionExecuted(
		decision: EvolutionDecision,
		result: TResult,
	): void {
		this.brain.__emitEvolutionEvent('evolution:action:executed', {
			action: decision.action,
			reasoning: decision.reasoning,
			guidance: decision.guidance,
			targets: decision.targets,
			timestamp: new Date(),
			result,
		})
	}

	/**
	 * Emit action failed event
	 */
	protected emitActionFailed(decision: EvolutionDecision, error: Error): void {
		this.brain.__emitEvolutionEvent('evolution:action:failed', {
			action: decision.action,
			targets: decision.targets,
			error: error.message,
			timestamp: new Date(),
		})
	}
}
