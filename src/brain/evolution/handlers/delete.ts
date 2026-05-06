/**
 * Delete action handler - removes neuron from Brain
 */

import type { EvolutionDecision } from '../../evaluator/types'
import { EvolutionActionHandler } from '../base-handler'
import type { DeleteActionResult } from '../types'

/**
 * Handler for 'delete' evolution action
 *
 * Processes each delete decision sequentially. No LLM call needed.
 */
export class DeleteHandler extends EvolutionActionHandler<DeleteActionResult> {
	async execute(decisions: EvolutionDecision[]): Promise<DeleteActionResult> {
		const allDeletedIds: string[] = []

		for (const decision of decisions) {
			this.emitActionStarted(decision)

			try {
				const deletedIds: string[] = []

				for (const neuronId of decision.targets) {
					const neuron = this.brain.neurons.get(neuronId)

					if (!neuron) {
						console.warn(`Delete: Neuron ${neuronId} not found, skipping`)
						continue
					}

					await this.brain.__removeNeuron(neuronId)

					deletedIds.push(neuronId)
				}

				allDeletedIds.push(...deletedIds)

				const actionResult: DeleteActionResult = {
					deletedNeuronIds: deletedIds,
				}

				this.emitActionExecuted(decision, actionResult)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				this.emitActionFailed(decision, err)
			}
		}

		return { deletedNeuronIds: allDeletedIds }
	}
}
