import { tool } from 'ai'
import { questionParams } from './schema'

export const question = tool({
	description:
		'Express doubt about a piece of information. Use when something seems inconsistent, unlikely, or needs verification before fully accepting it.',
	inputSchema: questionParams,
	execute: async (params) => params,
})
