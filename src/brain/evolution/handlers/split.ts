/**
 * Split action handler - divides one learner into multiple focused learners
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { SplitActionResult } from '../types'
import type { TextLearner } from '../../../learners/text-learner/class'
import { generate } from '../../../llm'
import { splitOutputSchema } from '../schemas/split'
import { splitSystemPrompt } from '../prompt.system.split'
import { splitPromptTemplate } from '../prompt.template.split'
import { createCompleteConfig } from '../utils'

/**
 * Handler for 'split' evolution action
 *
 * Divides a single learner into multiple focused learners by:
 * 1. Analyzing the learner's scope and identifying natural divisions
 * 2. Generating focused configs for each split learner
 * 3. Distributing understanding across the new learners
 * 4. Creating new learners and deleting the original
 */
export class SplitHandler extends EvolutionActionHandler<SplitActionResult> {
	async execute(decision: EvolutionDecision): Promise<SplitActionResult> {
		this.emitActionStarted(decision)

		try {
			// Validate targets
			if (decision.targets.length !== 1) {
				throw new Error('Split requires exactly 1 learner')
			}

			const learnerId = decision.targets[0]
			const learner = this.brain.learners.get(learnerId)

			if (!learner) {
				throw new Error(`Learner ${learnerId} not found`)
			}

			// Generate split configs and understandings via LLM
			const result = await generate({
				model: this.brain.config.model,
				system: splitSystemPrompt,
				prompt: splitPromptTemplate(
					decision.guidance,
					learner as TextLearner,
					this.brain.prompt,
				),
				output: Output.object({ schema: splitOutputSchema }),
			})

			const { learners: splitConfigs } = result.output

			// Create new learners from split configs
			const newLearnerIds: string[] = []

			for (const config of splitConfigs) {
				const completeConfig = createCompleteConfig({
					name: config.name,
					description: config.description,
					instructions: config.instructions,
				})
				const newLearner =
					await this.brain.createLearnerFromConfig(completeConfig)

				// Set understanding for each split learner
				newLearner.setUnderstanding(config.understanding)

				newLearnerIds.push(newLearner.id)
			}

			// Delete original learner
			this.brain.__removeLearner(learnerId)

			const actionResult: SplitActionResult = {
				newLearnerIds,
				deletedLearnerIds: [learnerId],
			}

			this.emitActionExecuted(decision, actionResult)

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			this.emitActionFailed(decision, err)
			throw new Error(`Split action failed: ${err.message}`)
		}
	}
}
