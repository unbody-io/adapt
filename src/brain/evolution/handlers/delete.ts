/**
 * Delete action handler - removes learner from Brain
 */

import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { DeleteActionResult } from '../types'

/**
 * Handler for 'delete' evolution action
 *
 * Processes each delete decision sequentially. No LLM call needed.
 */
export class DeleteHandler extends EvolutionActionHandler<DeleteActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<DeleteActionResult> {
		const allDeletedIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				const deletedIds: string[] = []

				for (const learnerId of decision.targets) {
					const learner = this.brain.learners.get(learnerId)

					if (!learner) {
						console.warn(
							`Delete: Learner ${learnerId} not found, skipping`,
						)
						continue
					}

					this.brain.__removeLearner(learnerId)

					deletedIds.push(learnerId)
				}

				allDeletedIds.push(...deletedIds)

				const actionResult: DeleteActionResult = {
					deletedLearnerIds: deletedIds,
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
				continue
			}
		}

		return { deletedLearnerIds: allDeletedIds }
	}
}
