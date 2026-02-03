import { tool } from 'ai'
import { classifyParams } from './schema'

/**
 * Classify tool for traceability - tracks how observations relate to understanding
 */
export const classify = tool({
	description:
		'Classify an observation from the data against existing understanding. Use this to trace your reasoning: does this data confirm, contradict, extend, or introduce new information?',
	inputSchema: classifyParams,
	// No execute — classification is just for traceability
})
