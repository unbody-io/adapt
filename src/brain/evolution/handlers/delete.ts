/**
 * Delete action handler - removes learner from Brain
 */

import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { DeleteActionResult } from '../types'

/**
 * Handler for 'delete' evolution action
 *
 * Removes a learner from the Brain. No LLM call needed.
 */
export class DeleteHandler extends EvolutionActionHandler<DeleteActionResult> {
	async execute(decision: EvolutionDecision): Promise<DeleteActionResult> {
		this.emitActionStarted(decision)

		try {
			const deletedIds: string[] = []

			for (const learnerId of decision.targets) {
				const learner = this.brain.learners.get(learnerId)

				if (!learner) {
					console.warn(`Delete: Learner ${learnerId} not found, skipping`)
					continue
				}

				// Remove from Brain
				this.brain.__removeLearner(learnerId)

				deletedIds.push(learnerId)
			}

			const actionResult: DeleteActionResult = {
				deletedLearnerIds: deletedIds,
			}

			this.emitActionExecuted(decision, actionResult)

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			this.emitActionFailed(decision, err)
			throw new Error(`Delete action failed: ${err.message}`)
		}
	}
}
