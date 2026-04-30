/**
 * Update action handler - updates existing neuron configuration
 *
 * Uses both methods for what each is designed for:
 * - neuron.adjust(directive) for behavioral evolution (instructions, identity, prompts, schemas)
 * - neuron.update({...}) for mechanical config (name, description, thresholds)
 */

import { generate, Output } from '../../../llm'
import type { EvolutionDecision } from '../../evaluator/types'
import { EvolutionActionHandler } from '../base-handler'
import { updateSystemPrompt } from '../prompt.system.update'
import { updatePromptTemplate } from '../prompt.template.update'
import { updateOutputSchema } from '../schemas/update'
import type { UpdateActionResult } from '../types'

export class UpdateHandler extends EvolutionActionHandler<UpdateActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<UpdateActionResult> {
		const allUpdatedNeuronIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				for (const neuronId of decision.targets) {
					const neuron = this.brain.neurons.get(neuronId)

					if (!neuron) {
						throw new Error(`Neuron ${neuronId} not found`)
					}

					const result = await generate({
						model: this.brain.config.model,
						system: updateSystemPrompt,
						prompt: await updatePromptTemplate(
							decision.guidance,
							neuron,
							this.brain.promptContext?.purpose ?? this.brain.prompt,
						),
						output: Output.object({ schema: updateOutputSchema }),
						repairSchema: updateOutputSchema,
					})

					const { mechanical, behavioral } = result.output

					// Behavioral evolution via adjust() — incremental/adaptive
					if (behavioral && behavioral.trim().length > 0) {
						await neuron.adjust(behavioral)
					}

					// Mechanical config via update() — specific field values
					const { thresholds, ...rest } = mechanical
					const hasMechanical = rest.name || rest.description || thresholds
					if (hasMechanical) {
						const adapted = {
							...rest,
							...(thresholds ? { understand: { thresholds } } : {}),
						}
						await neuron.update(adapted)
					}

					if (mechanical.name) {
						this.brain.__updateNeuronName(neuronId, mechanical.name)
					}

					allUpdatedNeuronIds.push(neuronId)
				}

				const actionResult: UpdateActionResult = {
					updatedNeuronIds: [...decision.targets],
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
			}
		}

		return { updatedNeuronIds: allUpdatedNeuronIds }
	}
}
