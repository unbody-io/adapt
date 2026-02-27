/**
 * Create action handler - generates new learners from guidance
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { CreateActionResult } from '../types'
import { generate } from '../../../llm'
import { learnerConfigsSchema } from '../../schemas/schema.learner-configs'
import { createPromptTemplate } from '../prompt.template.create'

/**
 * Handler for 'create' evolution action
 *
 * Joins guidance from all create decisions into a single LLM call,
 * then creates learners from the generated configs.
 */
export class CreateHandler extends EvolutionActionHandler<CreateActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<CreateActionResult> {
		for (const decision of decisions) {
			this.emitActionStarted(decision)
		}

		try {
			const guidance = decisions.map((d) => d.guidance).join('\n')

			const result = await generate({
				model: this.brain.config.model,
				prompt: createPromptTemplate(guidance, this.brain.prompt, Array.from(this.brain.learnerTypes.values())),
				output: Output.object({ schema: learnerConfigsSchema }),
				repairSchema: learnerConfigsSchema,
			})

			const newLearnerIds: string[] = []
			for (const config of result.output.learners) {
				const learner = await this.brain.createLearnerFromConfig(config)
				newLearnerIds.push(learner.id)
			}

			const actionResult: CreateActionResult = { newLearnerIds }

			for (const decision of decisions) {
				this.emitActionExecuted(decision, actionResult)
			}

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			for (const decision of decisions) {
				this.emitActionFailed(decision, err)
			}
			return { newLearnerIds: [] }
		}
	}
}
