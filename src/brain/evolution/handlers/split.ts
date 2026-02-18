/**
 * Split action handler - divides one learner into multiple focused learners
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { SplitActionResult } from '../types'
import { generate } from '../../../llm'
import { splitOutputSchema } from '../schemas/split'
import { splitSystemPrompt } from '../prompt.system.split'
import { splitPromptTemplate } from '../prompt.template.split'
import { createCompleteConfig } from '../utils'

/**
 * Handler for 'split' evolution action
 *
 * Processes each split decision sequentially.
 */
export class SplitHandler extends EvolutionActionHandler<SplitActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<SplitActionResult> {
		const allNewLearnerIds: string[] = []
		const allDeletedLearnerIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				if (decision.targets.length !== 1) {
					throw new Error('Split requires exactly 1 learner')
				}

				const learnerId = decision.targets[0]
				const learner = this.brain.learners.get(learnerId)

				if (!learner) {
					throw new Error(`Learner ${learnerId} not found`)
				}

				const result = await generate({
					model: this.brain.config.model,
					system: splitSystemPrompt,
					prompt: splitPromptTemplate(
						decision.guidance,
						learner,
						this.brain.prompt,
					),
					output: Output.object({ schema: splitOutputSchema }),
					repairSchema: splitOutputSchema,
				})

				const { learners: splitConfigs } = result.output

				const newLearnerIds: string[] = []

				for (const config of splitConfigs) {
					const completeConfig = createCompleteConfig({
						name: config.name,
						description: config.description,
						instructions: config.instructions,
					})
					const newLearner =
						await this.brain.createLearnerFromConfig(completeConfig)

					newLearner.setUnderstanding(config.understanding)

					newLearnerIds.push(newLearner.id)
				}

				this.brain.__removeLearner(learnerId)

				allNewLearnerIds.push(...newLearnerIds)
				allDeletedLearnerIds.push(learnerId)

				const actionResult: SplitActionResult = {
					newLearnerIds,
					deletedLearnerIds: [learnerId],
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
				continue
			}
		}

		return {
			newLearnerIds: allNewLearnerIds,
			deletedLearnerIds: allDeletedLearnerIds,
		}
	}
}
