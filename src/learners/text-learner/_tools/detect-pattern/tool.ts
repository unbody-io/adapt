import { tool } from 'ai'
import { detectPatternParams } from './schema'

export const detectPattern = tool({
	description:
		'Identify recurring themes across multiple data points. Only call when you see genuine repetition or consistency — single occurrences are not patterns.',
	inputSchema: detectPatternParams,
	execute: async (params) => params,
})
