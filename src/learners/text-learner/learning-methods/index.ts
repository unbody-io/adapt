export type {
	LearningMethod,
	LearningMethodName,
	LearnContext,
	LearnCallbacks,
	LearnResult,
	ComparisonObservation,
} from './types'

export { ToolBasedMethod } from './tool-based'
export { DirectMethod } from './direct'

import type { LanguageModel } from 'ai'
import type { LearningMethod, LearningMethodName } from './types'
import { ToolBasedMethod } from './tool-based'
import { DirectMethod } from './direct'

/**
 * Create a learning method by name
 */
export function createLearningMethod(
	name: LearningMethodName,
	model: LanguageModel,
): LearningMethod {
	switch (name) {
		case 'tool-based':
			return new ToolBasedMethod(model)
		case 'direct':
			return new DirectMethod(model)
		default:
			throw new Error(`Unknown learning method: ${name}`)
	}
}
