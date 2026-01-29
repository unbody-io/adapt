import { tool } from 'ai'
import { synthesizeParams } from './schema'

/**
 * Done tool for data processing - no execute function
 */
export const synthesize = tool({
	description:
		'Finalize updated understanding after processing. Provide the complete new understanding (not a diff), a relevance score, and an evolution entry describing what changed and its significance.',
	inputSchema: synthesizeParams,
	// No execute — done tool
})
