import { tool } from 'ai'
import { abstractParams } from './schema'

export const abstract = tool({
	description:
		'Extract a general principle from specific observations. Use when multiple data points suggest a broader truth.',
	inputSchema: abstractParams,
	execute: async (params) => params,
})
