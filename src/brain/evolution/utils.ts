/**
 * Utility functions for evolution handlers
 */

import { nanoid } from 'nanoid'
import type { GeneratedLearnerConfig } from '../../learners'

/**
 * Create a complete GeneratedLearnerConfig from partial config
 *
 * Handlers only generate name, description, and instructions.
 * This fills in the required fields (id, type, maintenance).
 */
export function createCompleteConfig(partial: {
	name: string
	description: string
	instructions: string
}): GeneratedLearnerConfig {
	return {
		id: nanoid(),
		name: partial.name,
		description: partial.description,
		instructions: partial.instructions,
		type: 'text',
		maintenance: {
			strategy: 'continuous',
		},
	}
}
