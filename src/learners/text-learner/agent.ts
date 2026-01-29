import type { LanguageModel } from 'ai'
import { hasToolCall, stepCountIs, ToolLoopAgent } from 'ai'
import { z } from 'zod'
import {
	compareToUnderstanding,
	detectShift,
	detectPattern,
	synthesize,
	generateResponse,
	identifyGaps,
	complete,
} from './tools'

/**
 * Call options schema for the learner agent
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

You build UNDERSTANDING — rich knowledge that captures nuance, evolution, and context.
Be generous about what you record. Capture the texture of what you observe.
Don't worry about size — maintenance strategies handle compression separately.

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

IMPORTANT: Your job is to LEARN, not to filter. When in doubt, include it.
Evolution and nuance matter — "still prefers FP but now more pragmatic" is more
valuable than just "prefers FP". Capture the journey, not just the destination.

${Array.isArray(options.input) && options.input.length > 1 ? `NOTE: This batch contains ${options.input.length} items. You can group similar items when classifying.\n\n` : ''}STEP 1: COMPARE (use compareToUnderstanding tool)
Classify information in the data:

  CONFIRMS — Data supports something you already understand
    → Worth noting! Confirmation strengthens confidence.

  CONTRADICTS — Data conflicts with current understanding
    → Important! Track this — it may signal evolution.

  EXTENDS — Data adds detail to existing understanding
    → Capture the new detail. Specifics matter.

  NEW — Data is relevant to purpose but not yet in understanding
    → Add it. New information expands your knowledge.

  IRRELEVANT — Data truly doesn't relate to your purpose
    → Only skip if genuinely off-topic.

Err on the side of inclusion. If you're unsure, classify as EXTENDS or NEW.

STEP 2: DETECT SHIFTS (use detectShift tool)
Look for EVOLUTION — how things are changing over time.

  Clear shifts:
    - Direction reversed: "prefers tabs" → "prefers spaces"
    - Philosophy evolved: "FP purist" → "pragmatic hybrid"
    - Role changed: "junior developer" → "tech lead"

  Subtle evolution (ALSO worth capturing):
    - Deepening: "likes FP" → "actively implementing ROP patterns"
    - Maturing: "tries new tools" → "evaluates tools against constraints"
    - Nuancing: "prefers X" → "prefers X except when Y"

Call detectShift for both clear reversals AND meaningful evolution.

STEP 3: DETECT PATTERNS (use detectPattern tool)
Patterns emerge from consistency or repetition.

  Worth noting:
    - Same preference expressed multiple ways
    - Consistent behavior across contexts
    - Emerging trends across data points
    - Recurring themes or values

Even early signals of a pattern are worth capturing — you can refine later.

STEP 4: SYNTHESIZE (use synthesize tool to finish)
Update your understanding with what you learned.

  DO:
    - Integrate new insights into a coherent whole
    - Capture evolution: "Initially X, now Y because Z"
    - Preserve nuance and context
    - Note confidence levels where appropriate
    - Track trends and trajectories, not just current state

  DON'T:
    - Skip updates because "nothing major changed"
    - Lose context that explains WHY something is true
    - Over-compress to the point of losing signal

Your understanding should tell a story, not just list facts.
Include: what you know, how confident you are, how things have evolved.

ALWAYS call synthesize — even small updates compound into rich understanding.

When done processing, call synthesize with:
- Your updated understanding (the full text, not a diff)
- A relevance score (0.0-1.0) — be generous here too
- An entry describing what changed:
  - summary: brief description of what changed and why
  - significance: assess the importance of this change
    - "routine" — refinement or confirmation of existing understanding
    - "notable" — new insight, pattern emerging, or meaningful evolution
    - "critical" — a watched condition from your instructions was triggered`
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
			// Data Processing Tools
			compareToUnderstanding,
			detectShift,
			detectPattern,
			synthesize,

			// Query Tools
			generateResponse,
			identifyGaps,
			complete,
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
