import { tool } from 'ai'
import { dismissParams } from './schema'

/**
 * Done tool for dismissing irrelevant data - no execute function
 */
export const dismiss = tool({
	description:
		'Dismiss data that is irrelevant to your purpose. Use this when data has no bearing on your learning goal. Do NOT use for data that confirms, contradicts, extends, or is new to your understanding.',
	inputSchema: dismissParams,
	// No execute — done tool
})
