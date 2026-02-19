/**
 * Text-learner query tools
 *
 * Provides the readUnderstanding tool (closes over learner state)
 * and the text-specific query prompt builder.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { QueryContext } from '../base/query'

/**
 * Create a readUnderstanding tool that closes over learner state
 *
 * Returns understanding text, or falls back to raw buffered observations
 * if no synthesis has happened yet.
 */
export function createReadUnderstandingTool(
	getUnderstanding: () => string,
	getBufferedObservations: () => Promise<Array<{ text: string; importance: number }>>,
) {
	return tool({
		description:
			'Read the learner\'s current understanding. Call this first to access your knowledge before answering.',
		inputSchema: z.object({}),
		execute: async () => {
			const understanding = getUnderstanding()
			if (understanding) return understanding

			const observations = await getBufferedObservations()
			if (observations.length === 0) {
				return '(No understanding yet. You have not processed any data.)'
			}
			return (
				'Note: This knowledge has not been synthesized yet. These are raw observations.\n\n---\n' +
				observations.map((obs) => obs.text).join('\n---\n')
			)
		},
	})
}

/**
 * Build the query prompt for text-based learners
 *
 * Instructs the LLM to read understanding via tool, then use cognitive tools.
 */
export function buildTextQueryPrompt(context: QueryContext): string {
	return `You are a learning agent. Your singular purpose:
"${context.instructions}"

You are being queried for insights based on your understanding.

══════════════════════════════════════════════════════════════════════════════
QUERY
══════════════════════════════════════════════════════════════════════════════
${context.question}

══════════════════════════════════════════════════════════════════════════════
HOW TO RESPOND
══════════════════════════════════════════════════════════════════════════════

STEP 1: READ YOUR UNDERSTANDING (use readUnderstanding tool)
Start by reading your current understanding to access your knowledge.

STEP 2: ASSESS RELEVANCE
Is this query something your understanding can address?
- Your purpose: "${context.instructions}"
- If the query is outside your purpose, say so clearly.
- If you have no understanding yet, acknowledge that.
- If outside your scope: skip directly to STEP 5 (complete). Set relevant to false, keep insight to one brief sentence. Do not explain your purpose or capabilities.

STEP 3: GENERATE RESPONSE (use generateResponse tool)
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

STEP 4: IDENTIFY GAPS (use identifyGaps tool)
What couldn't you answer? What's missing from your understanding?

  Examples of gaps:
    - "I don't have data about X"
    - "I've seen conflicting signals about Y"
    - "This requires information outside my purpose"

Identifying gaps is valuable — it guides future learning.

STEP 5: COMPLETE (use complete tool to finish)
Finalize your response with:
- Whether you could help (relevant: true/false)
- Your confidence (0.0-1.0)
- Your insight (the actual response)
- Any gaps identified`
}
