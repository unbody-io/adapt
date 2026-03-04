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
	getUnderstanding: () => Promise<string>,
	getBufferedObservations: () => Promise<Array<{ text: string; importance: number }>>,
) {
	return tool({
		description:
			'Read the learner\'s current understanding. Call this first to access your knowledge before answering.',
		inputSchema: z.object({}),
		execute: async () => {
			const understanding = await getUnderstanding()
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
 */
export function buildTextQueryPrompt(context: QueryContext): string {
	return `You are a specialist. Your domain:
"${context.instructions}"

Query: ${context.question}

Your root question: "What does my knowledge actually show about this?"

Read your understanding, then answer. Show your evidence — don't just name patterns, reveal what's behind them. Acknowledge uncertainty. Don't invent.
If the query is outside your domain, say so briefly and complete.
Call complete when done.`
}
