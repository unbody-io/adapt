/**
 * Create action handler - generates new learner from guidance
 */

import { Output } from 'ai'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { CreateActionResult } from '../types'
import { generate } from '../../../llm'
import { learnerConfigSchema } from '../../../learners/schema.config'
import { createSystemPrompt } from '../prompt.system.create'
import { createPromptTemplate } from '../prompt.template.create'

/**
 * Handler for 'create' evolution action
 *
 * Creates a new learner based on natural language guidance from the Evaluator.
 * Reuses Brain's existing learner generation system.
 */
export class CreateHandler extends EvolutionActionHandler<CreateActionResult> {
	async execute(decision: EvolutionDecision): Promise<CreateActionResult> {
		this.emitActionStarted(decision)

		try {
			// Generate learner config using guidance
			const result = await generate({
				model: this.brain.config.model,
				system: createSystemPrompt,
				prompt: createPromptTemplate(
					decision.guidance,
					this.brain.prompt,
					this.brain.learners.size,
				),
				output: Output.object({ schema: learnerConfigSchema }),
			})

			// Create learner from generated config
			const config = result.output.learners[0]
			const learner = await this.brain.createLearnerFromConfig(config)

			const actionResult: CreateActionResult = {
				newLearnerIds: [learner.id],
			}

			this.emitActionExecuted(decision, actionResult)

			return actionResult
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			this.emitActionFailed(decision, err)
			throw new Error(`Create action failed: ${err.message}`)
		}
	}
}
