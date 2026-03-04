/**
 * Tool for inspecting a specialist's knowledge, health, metrics, and evolution history
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { Brain } from '../../class'

const inspectSpecialistParams = z.object({
	id: z.string().describe('The specialist (learner) ID to inspect'),
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
			const learner = brain.learners.get(id)
			if (!learner) {
				throw new Error(`Specialist "${id}" not found`)
			}

			const [summary, evolution] = await Promise.all([
				learner.getSummary(),
				learner.getEvolution(),
			])
			const health = learner.getHealth()
			const metrics = learner.getMetrics()

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
