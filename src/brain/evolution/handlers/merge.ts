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
 * Combines multiple learners into a single unified learner by:
 * 1. Synthesizing their configs into one coherent config
 * 2. Merging their understandings into a unified narrative
 * 3. Creating the new learner and deleting the originals
 */
export class MergeHandler extends EvolutionActionHandler<MergeActionResult> {
	async execute(decision: EvolutionDecision): Promise<MergeActionResult> {
		this.emitActionStarted(decision)

		try {
			// Validate targets
			if (decision.targets.length < 2) {
				throw new Error('Merge requires at least 2 learners')
			}

			// Fetch learners
			const learners: TextLearner[] = []
			for (const learnerId of decision.targets) {
				const learner = this.brain.learners.get(learnerId)
				if (!learner) {
					throw new Error(`Learner ${learnerId} not found`)
				}
				learners.push(learner as TextLearner)
			}

			// Generate merged config and understanding via LLM
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

			// Create new learner with merged config
			const completeConfig = createCompleteConfig(config)
			const newLearner =
				await this.brain.createLearnerFromConfig(completeConfig)

			// Set merged understanding
			newLearner.setUnderstanding(understanding)

			// Delete original learners
			for (const learnerId of decision.targets) {
				this.brain.__removeLearner(learnerId)
			}

			const actionResult: MergeActionResult = {
				newLearnerIds: [newLearner.id],
				deletedLearnerIds: decision.targets,
			}

			this.emitActionExecuted(decision, actionResult)

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			this.emitActionFailed(decision, err)
			throw new Error(`Merge action failed: ${err.message}`)
		}
	}
}
