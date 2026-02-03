/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 */

export { TextLearner } from './class'
// Learning methods
export { TwoPhaseMethod } from './learning-methods'
// Query methods
export {
	createQueryMethod,
	DirectMethod as DirectQueryMethod,
	type QueryMethod,
	ToolBasedMethod as ToolBasedQueryMethod,
} from './query-methods'
export * from './types'
