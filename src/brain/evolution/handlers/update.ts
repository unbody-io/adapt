/**
 * Update action handler - updates existing learner configuration
 *
 * Uses both methods for what each is designed for:
 * - learner.adjust(directive) for behavioral evolution (instructions, identity, prompts, schemas)
 * - learner.update({...}) for mechanical config (name, description, thresholds)
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { UpdateActionResult } from '../types'
import { generate } from '../../../llm'
import { updateOutputSchema } from '../schemas/update'
import { updateSystemPrompt } from '../prompt.system.update'
import { updatePromptTemplate } from '../prompt.template.update'

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
						prompt: await updatePromptTemplate(
							decision.guidance,
							learner,
							this.brain.prompt,
						),
						output: Output.object({ schema: updateOutputSchema }),
						repairSchema: updateOutputSchema,
					})

					const { mechanical, behavioral } = result.output

					// Behavioral evolution via adjust() — incremental/adaptive
					if (behavioral && behavioral.trim().length > 0) {
						await learner.adjust(behavioral)
					}

					// Mechanical config via update() — specific field values
					const { thresholds, ...rest } = mechanical
					const hasMechanical =
						rest.name || rest.description || thresholds
					if (hasMechanical) {
						const adapted = {
							...rest,
							...(thresholds ? { understand: { thresholds } } : {}),
						}
						await learner.update(adapted)
					}

					if (mechanical.name) {
						this.brain.__updateLearnerName(learnerId, mechanical.name)
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
