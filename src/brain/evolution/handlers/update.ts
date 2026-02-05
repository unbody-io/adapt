/**
 * Update action handler - updates existing learner configuration
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { UpdateActionResult } from '../types'
import type { TextLearner } from '../../../learners/text-learner/class'
import { generate } from '../../../llm'
import { updateOutputSchema } from '../schemas/update'
import { updateSystemPrompt } from '../prompt.system.update'
import { updatePromptTemplate } from '../prompt.template.update'

/**
 * Handler for 'update' evolution action
 *
 * Processes each update decision sequentially.
 */
export class UpdateHandler extends EvolutionActionHandler<UpdateActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<UpdateActionResult> {
		const allUpdatedLearnerIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				if (decision.targets.length !== 1) {
					throw new Error('Update requires exactly 1 learner')
				}

				const learnerId = decision.targets[0]
				const learner = this.brain.learners.get(learnerId)

				if (!learner) {
					throw new Error(`Learner ${learnerId} not found`)
				}

				const result = await generate({
					model: this.brain.config.model,
					system: updateSystemPrompt,
					prompt: updatePromptTemplate(
						decision.guidance,
						learner as TextLearner,
						this.brain.prompt,
					),
					output: Output.object({ schema: updateOutputSchema }),
				})

				const { updates } = result.output

				await (learner as TextLearner).update(updates)

				if (updates.name) {
					this.brain.__updateLearnerName(learnerId, updates.name)
				}

				allUpdatedLearnerIds.push(learnerId)

				const actionResult: UpdateActionResult = {
					updatedLearnerIds: [learnerId],
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
				throw new Error(`Update action failed: ${err.message}`)
			}
		}

		return { updatedLearnerIds: allUpdatedLearnerIds }
	}
}
