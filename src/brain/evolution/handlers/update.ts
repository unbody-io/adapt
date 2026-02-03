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
 * Processes each target in each decision sequentially.
 * A single decision can target multiple learners (same guidance applied per-learner).
 */
export class UpdateHandler extends EvolutionActionHandler<UpdateActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<UpdateActionResult> {
		const allUpdatedLearnerIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				for (const learnerId of decision.targets) {
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
						repairSchema: updateOutputSchema,
					})

					const { updates } = result.output

					// Adapt flat thresholds to nested synthesize.thresholds shape
					const { thresholds, ...rest } = updates
					const adapted = {
						...rest,
						...(thresholds ? { synthesize: { thresholds } } : {}),
					}

					await (learner as TextLearner).update(adapted)

					if (updates.name) {
						this.brain.__updateLearnerName(learnerId, updates.name)
					}

					allUpdatedLearnerIds.push(learnerId)
				}

				const actionResult: UpdateActionResult = {
					updatedLearnerIds: [...decision.targets],
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
				continue
			}
		}

		return { updatedLearnerIds: allUpdatedLearnerIds }
	}
}
