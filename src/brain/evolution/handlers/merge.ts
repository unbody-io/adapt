/**
 * Merge action handler - combines multiple learners into one
 *
 * Type-aware: validates all source learners are same type,
 * uses descriptor's mergeUnderstandingSchema for LLM output.
 */

import { Output } from 'ai'
import { z } from 'zod'
import { EvolutionActionHandler } from '../base-handler'
import type { EvolutionDecision } from '../../evaluator/types'
import type { MergeActionResult } from '../types'
import type { BaseLearner } from '../../../learners/base/class'
import { generate } from '../../../llm'
import { mergeSystemPrompt } from '../prompt.system.merge'
import { mergePromptTemplate } from '../prompt.template.merge'
import { createCompleteConfig } from '../utils'

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

				const learners: BaseLearner<unknown>[] = []
				for (const learnerId of decision.targets) {
					const learner = this.brain.learners.get(learnerId)
					if (!learner) {
						throw new Error(`Learner ${learnerId} not found`)
					}
					learners.push(learner)
				}

				// All source learners must be the same type
				const learnerType = learners[0].type
				if (!learners.every((l) => l.type === learnerType)) {
					throw new Error(
						'Cross-type merge is not supported. All source learners must be the same type.',
					)
				}

				// Get type descriptor for understanding schema
				const descriptor = this.brain.learnerTypes.get(learnerType)
				if (!descriptor) {
					throw new Error(`Unknown learner type: ${learnerType}`)
				}

				// Build dynamic schema with type-specific understanding
				const mergeSchema = z.object({
					config: z.object({
						name: z.string().describe('Name for the merged learner'),
						description: z.string().describe('Description of the merged learner purpose'),
						instructions: z.string().describe('Combined instructions defining scope and responsibilities'),
					}),
					understanding: descriptor.mergeUnderstandingSchema,
				})

				const result = await generate({
					model: this.brain.config.model,
					system: mergeSystemPrompt,
					prompt: await mergePromptTemplate(
						decision.guidance,
						learners,
						this.brain.prompt,
					),
					output: Output.object({ schema: mergeSchema }),
					repairSchema: mergeSchema,
				})

				const { config, understanding } = result.output

				const completeConfig = createCompleteConfig({
					...config,
					type: learnerType as 'text' | 'list',
				})
				const newLearner =
					await this.brain.createLearnerFromConfig(completeConfig)

				await newLearner.setUnderstanding(understanding)

				for (const learnerId of decision.targets) {
					await this.brain.__removeLearner(learnerId)
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
				continue
			}
		}

		return {
			newLearnerIds: allNewLearnerIds,
			deletedLearnerIds: allDeletedLearnerIds,
		}
	}
}
