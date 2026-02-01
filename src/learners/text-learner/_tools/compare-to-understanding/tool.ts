import { tool } from 'ai'
import { compareToUnderstandingParams } from './schema'

export const compareToUnderstanding = tool({
	description:
		'Classify how data relates to current understanding. Use the taxonomy: CONFIRMS (supports existing), CONTRADICTS (conflicts), EXTENDS (adds detail), NEW (relevant but unknown), IRRELEVANT (off-purpose). Call this for each meaningful piece of information.',
	inputSchema: compareToUnderstandingParams,
	execute: async (params) => params,
})
