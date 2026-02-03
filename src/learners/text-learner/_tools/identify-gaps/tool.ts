import { tool } from 'ai'
import { identifyGapsParams } from './schema'

export const identifyGaps = tool({
	description:
		'Note what you could not answer — missing data, conflicting signals, or queries outside your purpose. Gaps guide future learning.',
	inputSchema: identifyGapsParams,
	execute: async (params) => params,
})
