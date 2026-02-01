/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 */

export { TextLearner } from './class'
export * from './types'

// Learning methods
export {
	createLearningMethod,
	ToolBasedMethod,
	DirectMethod,
	type LearningMethod,
} from './learning-methods'

// Query methods
export {
	createQueryMethod,
	ToolBasedMethod as ToolBasedQueryMethod,
	DirectMethod as DirectQueryMethod,
	type QueryMethod,
} from './query-methods'
