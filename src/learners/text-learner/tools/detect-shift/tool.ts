import { tool } from 'ai'
import { detectShiftParams } from './schema'

export const detectShift = tool({
	description:
		'Detect fundamental change in direction. Only call when you observe a genuine reversal (e.g., preference flipped, role changed), NOT for additive updates or refinements.',
	inputSchema: detectShiftParams,
	execute: async (params) => params,
})
