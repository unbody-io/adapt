import { tool } from 'ai'
import { prioritizeParams } from './schema'

export const prioritize = tool({
	description:
		'Mark something as more or less important in your understanding. Use to distinguish core knowledge from peripheral details.',
	inputSchema: prioritizeParams,
	execute: async (params) => params,
})
