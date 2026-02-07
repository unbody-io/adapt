/**
 * Merge action handler - combines multiple learners into one
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { MergeActionResult } from '../types'
import type { TextLearner } from '../../../learners/text-learner/class'
import { generate } from '../../../llm'
import { mergeOutputSchema } from '../schemas/merge'
import { mergeSystemPrompt } from '../prompt.system.merge'
import { mergePromptTemplate } from '../prompt.template.merge'
import { createCompleteConfig } from '../utils'

/**
 * Handler for 'merge' evolution action
 *
 * Processes each merge decision sequentially.
 */
export class MergeHandler extends EvolutionActionHandler<MergeActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<MergeActionResult> {
		const allNewLearnerIds: string[] = []
		const allDeletedLearnerIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				if (decision.targets.length < 2) {
					throw new Error('Merge requires at least 2 learners')
				}

				const learners: TextLearner[] = []
				for (const learnerId of decision.targets) {
					const learner = this.brain.learners.get(learnerId)
					if (!learner) {
						throw new Error(`Learner ${learnerId} not found`)
					}
					learners.push(learner as TextLearner)
				}

				const result = await generate({
					model: this.brain.config.model,
					system: mergeSystemPrompt,
					prompt: mergePromptTemplate(
						decision.guidance,
						learners,
						this.brain.prompt,
					),
					output: Output.object({ schema: mergeOutputSchema }),
				})

				const { config, understanding } = result.output

				const completeConfig = createCompleteConfig(config)
				const newLearner =
					await this.brain.createLearnerFromConfig(completeConfig)

				newLearner.setUnderstanding(understanding)

				for (const learnerId of decision.targets) {
					this.brain.__removeLearner(learnerId)
				}

				allNewLearnerIds.push(newLearner.id)
				allDeletedLearnerIds.push(...decision.targets)

				const actionResult: MergeActionResult = {
					newLearnerIds: [newLearner.id],
					deletedLearnerIds: decision.targets,
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
				throw new Error(`Merge action failed: ${err.message}`)
			}
		}

		return {
			newLearnerIds: allNewLearnerIds,
			deletedLearnerIds: allDeletedLearnerIds,
		}
	}
}
