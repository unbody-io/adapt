import { tool } from 'ai'
import { completeParams } from './schema'

/**
 * Done tool for query handling - no execute function
 */
export const complete = tool({
	description:
		'Finalize query response with relevance assessment, confidence score, insight, and identified gaps.',
	inputSchema: completeParams,
	// No execute — done tool
})
