import { tool } from 'ai'
import { hypothesizeParams } from './schema'

export const hypothesize = tool({
	description:
		'Form a hypothesis or inference that goes beyond the direct data. Use when you can reasonably infer something based on patterns or evidence.',
	inputSchema: hypothesizeParams,
	execute: async (params) => params,
})
