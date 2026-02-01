import { tool } from 'ai'
import { correctParams } from './schema'

export const correct = tool({
	description:
		'Correct a previous mistake in your understanding. Use when new data reveals that something you believed was wrong.',
	inputSchema: correctParams,
	execute: async (params) => params,
})
