/**
 * List-learner observe phase
 *
 * Extracts items, entities, and signals from raw data.
 * Same two-step pattern as text-learner: identity generation → observation.
 * Output format is identical (string[] observations + importance) —
 * the difference is in the identity prompts (focused on discrete items).
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { generate, Output } from '../../../llm'

// ── Identity schema ────────────────────────────────────────────────────────

const observeIdentitySchema = z.object({
	identity: z
		.string()
		.describe(
			'Second-person description of the observer identity. What items/entities to watch for, what attributes to extract.',
		),
	domain: z
		.string()
		.optional()
		.describe('Broad subject area in 2-5 words for quick relevance filtering'),
})

export type ObserveIdentity = z.infer<typeof observeIdentitySchema>

// ── Output schema ──────────────────────────────────────────────────────────

const observeOutputSchema = z.object({
	status: z.enum(['observed', 'dismissed']),
	output: z.array(z.string()),
	importance: z.number().min(0).max(1).optional(),
})

// ── Identity prompt ────────────────────────────────────────────────────────

function identityPrompt(instructions: string, focus?: string): string {
	return `You are creating an Observer identity for a list-tracking agent.

The Observer's role: scan incoming data and extract discrete items, entities, or signals relevant to the agent's purpose.

The agent's purpose:
"${instructions}"
${focus ? `\nFocus areas: ${focus}` : ''}

Generate an observer identity that specifies:
- What kinds of items/entities to look for
- What attributes to extract for each item
- What signals indicate an item is relevant
- Write in second person ("You watch for...", "You extract...")
- Be specific: list 3-5 concrete types of items or patterns

Also provide a short domain label (2-5 words) for quick relevance filtering.

Respond with JSON only:
{
  "identity": "You are ...",
  "domain": "short domain label"
}`
}

// ── System prompt template ─────────────────────────────────────────────────

function systemPrompt(identity: ObserveIdentity): string {
	return `${identity.identity}

══════════════════════════════════════════════════════════════════════════════
RELEVANCE
══════════════════════════════════════════════════════════════════════════════
${identity.domain ? `Your domain: "${identity.domain}". Quickly skip data clearly outside this domain.` : 'Evaluate relevance based on your purpose above.'}

Match literally. If data contains items, entities, or signals matching your purpose, extract them.
If data is clearly outside your domain, dismiss it.

══════════════════════════════════════════════════════════════════════════════
IMPORTANCE
══════════════════════════════════════════════════════════════════════════════
Rate the importance of what you found (0.0 to 1.0):
  0.0-0.3: Low — tangential mentions, minor details
  0.4-0.6: Medium — relevant items, standard updates
  0.7-1.0: High — key entities, significant changes, critical signals

══════════════════════════════════════════════════════════════════════════════
EXTRACTION GUIDELINES
══════════════════════════════════════════════════════════════════════════════
- Extract each discrete item/entity as a separate observation
- Include key attributes (names, values, statuses, relationships)
- Be factual — report what you see, don't interpret
- One item or fact per observation string
- If nothing relevant, set status to "dismissed"

══════════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════════════════════════════════════════
Respond with JSON only:
{
  "status": "observed" or "dismissed",
  "output": ["item/entity 1", "item/entity 2", ...],
  "importance": 0.0 to 1.0
}`
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface ObserveInitResult {
	identity: ObserveIdentity
	systemPrompt: string
}

export async function initObserve(
	model: LanguageModel,
	instructions: string,
	focus?: string,
): Promise<ObserveInitResult> {
	const prompt = identityPrompt(instructions, focus)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: observeIdentitySchema }),
		repairSchema: observeIdentitySchema,
	})

	return { identity, systemPrompt: systemPrompt(identity) }
}

export interface ObserveContext {
	learnerId: string
	instructions: string
	data: unknown[]
}

export interface ObserveCallbacks {
	onThinking?: (thoughts: string[]) => void
}

export type ObserveOutput =
	| { status: 'observed'; output: string[]; importance: number; usage?: any }
	| { status: 'dismissed'; output: string[]; usage?: any }
	| { status: 'error'; output: null; error: unknown }

export async function observe(
	model: LanguageModel,
	observeSystemPrompt: string,
	context: ObserveContext,
	callbacks?: ObserveCallbacks,
): Promise<ObserveOutput> {
	try {
		const prompt = `Examine the following data and extract relevant items:\n\n${JSON.stringify(context.data, null, 2)}\n\nWhat items or entities do you observe that are relevant to your purpose?`

		const result = await generate({
			model,
			system: observeSystemPrompt,
			prompt,
			output: Output.object({ schema: observeOutputSchema }),
			repairSchema: observeOutputSchema,
			temperature: 0.2,
		})

		if (callbacks?.onThinking && result.reasoning) {
			callbacks.onThinking(
				result.reasoning.map((r: { text: string }) => r.text),
			)
		}

		const data = result.output
		if (data.status === 'observed') {
			return {
				status: 'observed',
				output: data.output,
				importance: data.importance ?? 0.5,
				usage: result.usage,
			}
		}
		return {
			status: 'dismissed',
			output: data.output,
			usage: result.usage,
		}
	} catch (error) {
		return { status: 'error', output: null, error }
	}
}
