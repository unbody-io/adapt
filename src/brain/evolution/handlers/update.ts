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
						llm: this.brain.llm,
						model: this.brain.config.model,
						system: updateSystemPrompt,
						prompt: await updatePromptTemplate(
							decision.guidance,
							neuron,
							this.brain.promptContext?.purpose ?? this.brain.prompt,
						),
						output: Output.object({ schema: updateOutputSchema }),
						repairSchema: updateOutputSchema,
						...this.brain.llmRepairOptions,
					})

					const { mechanical, behavioral } = result.output

					// Behavioral evolution via adjust() — incremental/adaptive
					if (behavioral && behavioral.trim().length > 0) {
						await neuron.adjust(behavioral)
					}

					// Mechanical config via update() — specific field values.
					// LLM emits null for "no change"; drop nulls so neuron.update
					// only sees fields the LLM actually wants to change.
					const { thresholds, name, description } = mechanical
					const cleanThresholds =
						thresholds &&
						(thresholds.minImportance !== null ||
							thresholds.maxObservations !== null)
							? {
									...(thresholds.minImportance !== null
										? { minImportance: thresholds.minImportance }
										: {}),
									...(thresholds.maxObservations !== null
										? { maxObservations: thresholds.maxObservations }
										: {}),
								}
							: null
					const hasMechanical = name || description || cleanThresholds
					if (hasMechanical) {
						const adapted = {
							...(name ? { name } : {}),
							...(description ? { description } : {}),
							...(cleanThresholds
								? { understand: { thresholds: cleanThresholds } }
								: {}),
						}
						await neuron.update(adapted)
					}

					if (name) {
						this.brain.__updateNeuronName(neuronId, name)
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
