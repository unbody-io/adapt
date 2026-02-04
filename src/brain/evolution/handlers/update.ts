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
 * Updates a learner's configuration based on guidance by:
 * 1. Analyzing the learner's current state and metrics
 * 2. Generating appropriate config updates via LLM
 * 3. Applying updates (with prompt regeneration if instructions change)
 */
export class UpdateHandler extends EvolutionActionHandler<UpdateActionResult> {
	async execute(decision: EvolutionDecision): Promise<UpdateActionResult> {
		this.emitActionStarted(decision)

		try {
			// Validate targets
			if (decision.targets.length !== 1) {
				throw new Error('Update requires exactly 1 learner')
			}

			const learnerId = decision.targets[0]
			const learner = this.brain.learners.get(learnerId)

			if (!learner) {
				throw new Error(`Learner ${learnerId} not found`)
			}

			// Generate config updates via LLM
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

			// Apply updates using TextLearner.update() method
			await (learner as TextLearner).update(updates)

			// Update Brain's learnerNames map if name changed
			if (updates.name) {
				this.brain.__updateLearnerName(learnerId, updates.name)
			}

			const actionResult: UpdateActionResult = {
				updatedLearnerIds: [learnerId],
			}

			this.emitActionExecuted(decision, actionResult)

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			this.emitActionFailed(decision, err)
			throw new Error(`Update action failed: ${err.message}`)
		}
	}
}
