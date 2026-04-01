/**
 * Tool for inspecting a specialist's knowledge, health, metrics, and evolution history
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const inspectSpecialistParams = z.object({
	id: z.string().describe('The specialist (neuron) ID to inspect'),
})

/**
 * Create inspectSpecialist tool with brain context.
 *
 * Combines summary, health, metrics, and evolution history
 * into a single call — everything about one specialist.
 */
export function createInspectSpecialistTool(brain: Brain) {
	return tool({
		description:
			'Look closely at a specialist — its knowledge summary, health, metrics, and evolution history.',
		inputSchema: inspectSpecialistParams,
		execute: async ({ id }) => {
			const neuron = brain.neurons.get(id)
			if (!neuron) {
				throw new Error(`Specialist "${id}" not found`)
			}

			const [summary, evolution] = await Promise.all([
				neuron.getSummary(),
				neuron.getEvolution(),
			])
			const health = neuron.getHealth()
			const metrics = neuron.getMetrics()

			return {
				summary,
				health: {
					activation: health.activation,
					status: health.status,
					lastAccessed: health.lastAccessed,
				},
				metrics: {
					observationCount: metrics.ingestion.observationCount,
					dismissalCount: metrics.ingestion.dismissalCount,
					dismissalRate: metrics.ingestion.dismissalRate,
					synthesisCount: metrics.ingestion.synthesisCount,
					queryCount: metrics.query.count,
					recentRelevance: metrics.query.relevanceScores,
					recentConfidence: metrics.query.confidenceScores,
					gaps: metrics.query.gaps,
				},
				evolution,
			}
		},
	})
}
