import type { LanguageModel } from 'ai'
import { hasToolCall, stepCountIs, ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'
import * as schemas from './tools/schemas.js'

/**
 * Call options schema for the learner agent
 *
 * Allows dynamic configuration per call (data processing vs query handling)
 */
export const callOptionsSchema = z.object({
	operation: z.enum(['data', 'query']),
	understanding: z.string(),
	purpose: z.string(),
	input: z.unknown(),
})

export type CallOptions = z.infer<typeof callOptionsSchema>

const DATA_TOOLS = [
	'compareToUnderstanding',
	'detectShift',
	'detectPattern',
	'synthesize',
] as const

const QUERY_TOOLS = ['generateResponse', 'identifyGaps', 'complete'] as const

/**
 * Build instructions for the agent based on operation type
 */
function buildInstructions(options: CallOptions): string {
	const base = `You are a learning agent with a fixed purpose: "${options.purpose}"

Your current understanding:
${options.understanding || '(no understanding yet)'}
`

	if (options.operation === 'data') {
		return `${base}
You are processing new data. Analyze the data in relation to your purpose and current understanding.

Use your tools to:
1. Compare the data against your current understanding (confirms/contradicts/new)
2. Detect if something has fundamentally shifted
3. Look for emerging patterns

When done, call the synthesize tool with your updated understanding and a relevance score.

Data to process:
${JSON.stringify(options.input, null, 2)}`
	}

	return `${base}
You are responding to a query. Use your understanding to provide an insight.

Use your tools to:
1. Generate a response based on your understanding
2. Identify any gaps in what you couldn't answer

When done, call the complete tool with your final response.

Query:
${options.input}`
}

/**
 * Create a learner agent that handles both data processing and query operations
 *
 * Uses ToolLoopAgent with dynamic configuration via callOptionsSchema and prepareCall
 */
export function createLearnerAgent(model: LanguageModel) {
	return new ToolLoopAgent({
		model,
		callOptionsSchema,

		tools: {
			// ─────────────────────────────────────────────────────────────────────
			// Data Processing Tools
			// ─────────────────────────────────────────────────────────────────────
			compareToUnderstanding: tool({
				description:
					'Assess how new data relates to current understanding. Call this to analyze the relationship.',
				inputSchema: schemas.compareToUnderstandingParams,
				execute: async (params) => {
					// Agent reasons about comparison, structured output captured
					return params
				},
			}),

			detectShift: tool({
				description:
					'Detect if something has fundamentally changed. Call this when you notice a potential shift.',
				inputSchema: schemas.detectShiftParams,
				execute: async (params) => {
					return params
				},
			}),

			detectPattern: tool({
				description:
					'Identify emerging patterns across data points. Call this when you notice recurring themes.',
				inputSchema: schemas.detectPatternParams,
				execute: async (params) => {
					return params
				},
			}),

			synthesize: tool({
				description:
					'Update understanding with new insights. Call this when done processing data.',
				inputSchema: schemas.synthesizeParams,
				// No execute — done tool
			}),

			// ─────────────────────────────────────────────────────────────────────
			// Query Tools
			// ─────────────────────────────────────────────────────────────────────
			generateResponse: tool({
				description:
					'Generate a response from your understanding. Call this to formulate your answer.',
				inputSchema: schemas.generateResponseParams,
				execute: async (params) => {
					return params
				},
			}),

			identifyGaps: tool({
				description:
					'Identify what could not be answered from current understanding.',
				inputSchema: schemas.identifyGapsParams,
				execute: async (params) => {
					return params
				},
			}),

			complete: tool({
				description:
					'Finalize the query response. Call this when done responding.',
				inputSchema: schemas.completeParams,
				// No execute — done tool
			}),
		},

		prepareCall: ({ options, ...settings }) => ({
			...settings,
			activeTools:
				options.operation === 'data' ? [...DATA_TOOLS] : [...QUERY_TOOLS],
			toolChoice: 'required' as const,
			instructions: buildInstructions(options),
		}),

		stopWhen: [
			stepCountIs(10),
			hasToolCall('synthesize'),
			hasToolCall('complete'),
		],
	})
}

/**
 * Type for the learner agent
 */
export type LearnerAgent = ReturnType<typeof createLearnerAgent>
