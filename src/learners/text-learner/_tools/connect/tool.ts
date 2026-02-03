import { tool } from 'ai'
import { connectParams } from './schema'

export const connect = tool({
	description:
		'Connect new information to existing knowledge. Use to explicitly link related concepts and build a coherent understanding.',
	inputSchema: connectParams,
	execute: async (params) => params,
})
