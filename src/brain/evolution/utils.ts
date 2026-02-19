/**
 * Utility functions for evolution handlers
 */

import { nanoid } from 'nanoid'
import type { GeneratedLearnerConfig } from '../../learners'

/**
 * Create a complete GeneratedLearnerConfig from partial config
 *
 * Handlers only generate name, description, and instructions.
 * This fills in the required fields (id, type, governance).
 */
export function createCompleteConfig(partial: {
	name: string
	description: string
	instructions: string
	type?: 'text' | 'list'
}): GeneratedLearnerConfig {
	if (partial.type === 'list') {
		return {
			id: nanoid(),
			name: partial.name,
			description: partial.description,
			instructions: partial.instructions,
			type: 'list',
		}
	}
	return {
		id: nanoid(),
		name: partial.name,
		description: partial.description,
		instructions: partial.instructions,
		type: 'text',
		governance: {
			strategy: 'continuous',
		},
	}
}

/**
 * Stringify any understanding value for display in prompts
 */
export function stringifyUnderstanding(understanding: unknown): string {
	if (!understanding) return '(No understanding yet)'
	if (typeof understanding === 'string') return understanding || '(No understanding yet)'
	return JSON.stringify(understanding, null, 2)
}
