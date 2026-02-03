import { tool } from 'ai'
import { generateResponseParams } from './schema'

export const generateResponse = tool({
	description:
		'Formulate an answer based on your understanding. Be specific, cite what you know, express appropriate confidence, acknowledge uncertainty.',
	inputSchema: generateResponseParams,
	execute: async (params) => params,
})
