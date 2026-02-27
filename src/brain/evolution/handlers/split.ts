/**
 * Split action handler - divides one learner into multiple focused learners
 *
 * Type-aware: preserves source learner type in split results,
 * uses descriptor's splitUnderstandingSchema for LLM output.
 */

import { Output } from 'ai'
import { z } from 'zod'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { SplitActionResult } from '../types'
import { generate } from '../../../llm'
import { splitSystemPrompt } from '../prompt.system.split'
import { splitPromptTemplate } from '../prompt.template.split'
import { createCompleteConfig } from '../utils'

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

				// Get type descriptor for understanding schema
				const learnerType = learner.type
				const descriptor = this.brain.learnerTypes.get(learnerType)
				if (!descriptor) {
					throw new Error(`Unknown learner type: ${learnerType}`)
				}

				// Build dynamic schema with type-specific understanding
				const splitSchema = z.object({
					learners: z
						.array(
							z.object({
								name: z.string().describe('Name for the split learner'),
								description: z.string().describe('Description of this split learner purpose'),
								instructions: z.string().describe('Focused instructions defining scope and responsibilities'),
								understanding: descriptor.splitUnderstandingSchema,
							}),
						)
						.min(2)
						.describe('Array of 2 or more focused learners'),
				})

				const result = await generate({
					model: this.brain.config.model,
					system: splitSystemPrompt,
					prompt: await splitPromptTemplate(
						decision.guidance,
						learner,
						this.brain.prompt,
					),
					output: Output.object({ schema: splitSchema }),
					repairSchema: splitSchema,
				})

				const { learners: splitConfigs } = result.output

				const newLearnerIds: string[] = []

				for (const config of splitConfigs) {
					const completeConfig = createCompleteConfig({
						name: config.name,
						description: config.description,
						instructions: config.instructions,
						type: learnerType as 'text' | 'list',
					})
					const newLearner =
						await this.brain.createLearnerFromConfig(completeConfig)

					await newLearner.setUnderstanding(config.understanding)

					newLearnerIds.push(newLearner.id)
				}

				await this.brain.__removeLearner(learnerId)

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
