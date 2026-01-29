import type { LanguageModel } from 'ai'
import { hasToolCall, stepCountIs, ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'
import * as schemas from './tools/schemas.js'

/**
 * Call options schema for the learner agent
 *
 * Allows dynamic configuration per call (ingest vs ask)
 */
export const callOptionsSchema = z.object({
	operation: z.enum(['ingest', 'ask']),
	understanding: z.string(),
	instructions: z.string(),
	input: z.unknown(),
})

export type CallOptions = z.infer<typeof callOptionsSchema>

const INGEST_TOOLS = [
	'compareToUnderstanding',
	'detectShift',
	'detectPattern',
	'synthesize',
] as const

const ASK_TOOLS = ['generateResponse', 'identifyGaps', 'complete'] as const

/**
 * Build instructions for ingest operations
 */
function buildIngestInstructions(options: CallOptions): string {
	const hasUnderstanding = options.understanding?.trim()

	return `You are a learning agent. Your singular purpose:
"${options.instructions}"

You build UNDERSTANDING — compressed knowledge that serves your purpose.
You are not a fact store. You learn, synthesize, and refine.

══════════════════════════════════════════════════════════════════════════════
CURRENT UNDERSTANDING
══════════════════════════════════════════════════════════════════════════════
${hasUnderstanding ? options.understanding : '(No understanding yet. This is your first exposure to data.)'}

══════════════════════════════════════════════════════════════════════════════
NEW DATA TO PROCESS
══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(options.input, null, 2)}

══════════════════════════════════════════════════════════════════════════════
HOW TO PROCESS
══════════════════════════════════════════════════════════════════════════════

${Array.isArray(options.input) && options.input.length > 1 ? `NOTE: This batch contains ${options.input.length} items. You don't need to call compareToUnderstanding for every item — group similar items and classify the group. Focus on what's meaningful, not exhaustive coverage.\n\n` : ''}STEP 1: COMPARE (use compareToUnderstanding tool)
Classify each piece of information in the data:

  CONFIRMS — Data supports something you already understand
    Example: You know "prefers functional style"
    Data shows: "used map/filter instead of loops"
    → This CONFIRMS existing knowledge

  CONTRADICTS — Data conflicts with current understanding
    Example: You know "prefers dark mode"
    Data shows: "switched to light mode"
    → This CONTRADICTS. But note: a single contradiction may be temporary.
      A pattern of contradictions = a shift.

  EXTENDS — Data adds detail to existing understanding
    Example: You know "works in tech"
    Data shows: "works at Google as SRE"
    → This EXTENDS with more specificity

  NEW — Data is relevant to purpose but not yet in understanding
    Example: Purpose is "coding preferences"
    Data shows: "started using Vim"
    → This is NEW and relevant

  IRRELEVANT — Data doesn't relate to your purpose
    → Ignore it. Don't add noise. Stay focused.

STEP 2: DETECT SHIFTS (use detectShift tool if needed)
A SHIFT is when something fundamental has changed direction — not just updated.

  IS a shift:
    - "prefers tabs" → "prefers spaces" (direction reversed)
    - "morning person" → "night owl" (pattern inverted)
    - "junior developer" → "tech lead" (role fundamentally changed)

  IS NOT a shift (just an update):
    - "likes Python" → "likes Python and Rust" (additive)
    - "uses VS Code" → "uses VS Code with Vim plugin" (refinement)

Only call detectShift when you observe a genuine reversal or fundamental change.

STEP 3: DETECT PATTERNS (use detectPattern tool if needed)
Patterns emerge from repetition, not single occurrences.

  IS a pattern:
    - Same preference expressed multiple ways across data
    - Consistent behavior observed repeatedly
    - Trend that appears in multiple data points

  IS NOT a pattern:
    - One-off mention
    - Single data point (no matter how strong)

Only call detectPattern when you see genuine recurrence.

STEP 4: SYNTHESIZE (use synthesize tool to finish)
Update your understanding with what you learned.

  DO:
    - Integrate new insights into a coherent whole
    - Resolve contradictions (decide what's true now)
    - Compress — understanding should get more refined, not longer
    - Organize in whatever structure best serves your purpose

  DON'T:
    - Append raw data (you're not a log)
    - Keep contradictory information unresolved
    - Let understanding grow without bound
    - Lose important nuance in over-compression

Your understanding's structure should emerge from your purpose.
A learner about "coding style" might organize by: patterns, exceptions, evolution.
A learner about "emotional state" might organize by: current, trajectory, triggers.
You decide what structure best captures what you've learned.

When done processing, call synthesize with:
- Your updated understanding (the full text, not a diff)
- A relevance score (0.0-1.0) for how useful this data was
- An entry describing what changed:
  - summary: brief description of what changed and why
  - significance: assess the importance of this change
    - "routine" — normal refinement of existing understanding (e.g., "Added more examples of functional style preference")
    - "notable" — new pattern or meaningful shift (e.g., "First clear statement about testing philosophy")
    - "critical" — a watched condition from your instructions was triggered (e.g., safety concern, key milestone, urgent signal)`
}

/**
 * Build instructions for ask operations
 */
function buildAskInstructions(options: CallOptions): string {
	const hasUnderstanding = options.understanding?.trim()

	return `You are a learning agent. Your singular purpose:
"${options.instructions}"

You are being queried for insights based on your understanding.

══════════════════════════════════════════════════════════════════════════════
YOUR UNDERSTANDING
══════════════════════════════════════════════════════════════════════════════
${hasUnderstanding ? options.understanding : '(No understanding yet. You have not processed any data.)'}

══════════════════════════════════════════════════════════════════════════════
QUERY
══════════════════════════════════════════════════════════════════════════════
${options.input}

══════════════════════════════════════════════════════════════════════════════
HOW TO RESPOND
══════════════════════════════════════════════════════════════════════════════

STEP 1: ASSESS RELEVANCE
Is this query something your understanding can address?
- Your purpose: "${options.instructions}"
- If the query is outside your purpose, say so clearly.
- If you have no understanding yet, acknowledge that.

STEP 2: GENERATE RESPONSE (use generateResponse tool)
Draw insights from your understanding to answer the query.

  DO:
    - Answer based on what you actually know
    - Be specific — cite patterns or facts from your understanding
    - Express confidence level appropriately
    - Acknowledge uncertainty where it exists

  DON'T:
    - Make up information not in your understanding
    - Over-generalize from limited knowledge
    - Pretend certainty you don't have

STEP 3: IDENTIFY GAPS (use identifyGaps tool)
What couldn't you answer? What's missing from your understanding?

  Examples of gaps:
    - "I don't have data about X"
    - "I've seen conflicting signals about Y"
    - "This requires information outside my purpose"

Identifying gaps is valuable — it guides future learning.

STEP 4: COMPLETE (use complete tool to finish)
Finalize your response with:
- Whether you could help (relevant: true/false)
- Your confidence (0.0-1.0)
- Your insight (the actual response)
- Any gaps identified`
}

/**
 * Build instructions for the agent based on operation type
 */
function buildInstructions(options: CallOptions): string {
	if (options.operation === 'ingest') {
		return buildIngestInstructions(options)
	}
	return buildAskInstructions(options)
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
					'Classify how data relates to current understanding. Use the taxonomy: CONFIRMS (supports existing), CONTRADICTS (conflicts), EXTENDS (adds detail), NEW (relevant but unknown), IRRELEVANT (off-purpose). Call this for each meaningful piece of information.',
				inputSchema: schemas.compareToUnderstandingParams,
				execute: async (params) => params,
			}),

			detectShift: tool({
				description:
					'Detect fundamental change in direction. Only call when you observe a genuine reversal (e.g., preference flipped, role changed), NOT for additive updates or refinements.',
				inputSchema: schemas.detectShiftParams,
				execute: async (params) => params,
			}),

			detectPattern: tool({
				description:
					'Identify recurring themes across multiple data points. Only call when you see genuine repetition or consistency — single occurrences are not patterns.',
				inputSchema: schemas.detectPatternParams,
				execute: async (params) => params,
			}),

			synthesize: tool({
				description:
					'Finalize updated understanding after processing. Provide the complete new understanding (not a diff), a relevance score, and an evolution entry describing what changed and its significance.',
				inputSchema: schemas.synthesizeParams,
				// No execute — done tool
			}),

			// ─────────────────────────────────────────────────────────────────────
			// Query Tools
			// ─────────────────────────────────────────────────────────────────────
			generateResponse: tool({
				description:
					'Formulate an answer based on your understanding. Be specific, cite what you know, express appropriate confidence, acknowledge uncertainty.',
				inputSchema: schemas.generateResponseParams,
				execute: async (params) => params,
			}),

			identifyGaps: tool({
				description:
					'Note what you could not answer — missing data, conflicting signals, or queries outside your purpose. Gaps guide future learning.',
				inputSchema: schemas.identifyGapsParams,
				execute: async (params) => params,
			}),

			complete: tool({
				description:
					'Finalize query response with relevance assessment, confidence score, insight, and identified gaps.',
				inputSchema: schemas.completeParams,
				// No execute — done tool
			}),
		},

		prepareCall: ({ options, ...settings }) => ({
			...settings,
			activeTools:
				options.operation === 'ingest' ? [...INGEST_TOOLS] : [...ASK_TOOLS],
			toolChoice: 'required' as const,
			instructions: buildInstructions(options),
		}),

		// Stop conditions:
		// - Max 15 steps (safety limit for complex batches)
		// - Or when done tool is called (synthesize for data, complete for query)
		stopWhen: [
			stepCountIs(15),
			hasToolCall('synthesize'),
			hasToolCall('complete'),
		],
	})
}

/**
 * Type for the learner agent
 */
export type LearnerAgent = ReturnType<typeof createLearnerAgent>
