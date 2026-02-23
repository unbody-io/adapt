/**
 * List understand phase
 *
 * Takes current items + buffered observations → produces structured operations.
 * Operations (add/update/remove) are mechanically applied to the items list.
 * Identity generation follows same pattern as text understand.
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { generate, Output } from '../../../llm'
import type { Significance } from '../../types'
import type { ListItem } from '../types'
import type {
	UnderstandCallbacks,
	UnderstandContext,
	UnderstandOutput,
} from './types'

// ── Identity schema ────────────────────────────────────────────────────────

const understandIdentitySchema = z.object({
	identity: z
		.string()
		.describe(
			'Second-person description of the synthesizer. What items to maintain, how to determine add vs update vs remove, significance criteria.',
		),
})

export type UnderstandIdentity = z.infer<typeof understandIdentitySchema>

// ── Operations output schema ───────────────────────────────────────────────

const operationSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('add'),
		item: z.object({
			data: z.record(z.any()).describe('The item data as key-value pairs'),
			confidence: z
				.number()
				.min(0)
				.max(1)
				.optional()
				.describe('How confident you are about this item (0.0-1.0)'),
			signals: z
				.array(z.string())
				.optional()
				.describe('Notable signals or tags for this item'),
		}),
	}),
	z.object({
		type: z.literal('update'),
		id: z.string().describe('ID of the item to update'),
		changes: z.object({
			data: z
				.record(z.any())
				.optional()
				.describe('Fields to update/add in the item data'),
			confidence: z.number().min(0).max(1).optional(),
			signals: z.array(z.string()).optional(),
		}),
	}),
	z.object({
		type: z.literal('remove'),
		id: z.string().describe('ID of the item to remove'),
		reason: z.string().describe('Why this item should be removed'),
	}),
])

const understandOutputSchema = z.object({
	changed: z
		.boolean()
		.describe('Whether the observations warrant any changes to the collection'),
	operations: z.array(operationSchema),
	evolution: z.string().describe('Brief description of what changed and why'),
	significance: z
		.enum(['routine', 'notable', 'critical'])
		.describe('How significant are these changes?'),
	reasoning: z.string().optional().describe('Key reasoning behind the decisions'),
})

// ── Identity prompt ────────────────────────────────────────────────────────

function identityPrompt(instructions: string): string {
	return `You are creating a Synthesizer identity for a list-tracking agent.

The Synthesizer's role: maintain a structured collection of items. Given new observations, decide what to add, update, or remove.

The agent's purpose:
"${instructions}"

Generate a synthesizer identity that specifies:
- What types of items you maintain in the collection
- What makes two observations refer to the same item (matching criteria)
- When to add a new item vs update an existing one
- When to remove an item
- Significance criteria: what's routine (minor updates), notable (new important items), critical (major changes)
- Write in second person ("You maintain...", "You add new items when...")

Respond with JSON only:
{
  "identity": "You maintain ..."
}`
}

// ── System prompt template ─────────────────────────────────────────────────

function systemPrompt(
	identity: UnderstandIdentity,
	currentItems: ListItem[],
): string {
	const itemsSummary =
		currentItems.length === 0
			? '(empty collection — no items yet)'
			: JSON.stringify(
					currentItems.map((item) => ({
						id: item.id,
						data: item.data,
						confidence: item.metadata.confidence,
						signals: item.metadata.signals,
					})),
					null,
					2,
				)

	return `${identity.identity}

══════════════════════════════════════════════════════════════════════════════
CURRENT COLLECTION (${currentItems.length} items)
══════════════════════════════════════════════════════════════════════════════
${itemsSummary}

══════════════════════════════════════════════════════════════════════════════
YOUR APPROACH
══════════════════════════════════════════════════════════════════════════════
For each observation, decide:
1. ADD — if it describes a new item not in the collection
2. UPDATE — if it adds info or changes an existing item (reference by id)
3. REMOVE — if it indicates an item is no longer relevant (reference by id)
4. SKIP — if the observation doesn't warrant any change

Guidelines:
- Be precise with item matching — use your matching criteria
- Preserve existing data when updating (merge, don't replace)
- Set confidence based on the quality/reliability of the observation
- Add relevant signals/tags to items
- Only remove items when there's clear evidence they should go

══════════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════════════════════════════════════════
Respond with JSON only:
{
  "changed": true/false,
  "operations": [
    { "type": "add", "item": { "data": {...}, "confidence": 0.8, "signals": ["new"] } },
    { "type": "update", "id": "item_xxx", "changes": { "data": {...} } },
    { "type": "remove", "id": "item_xxx", "reason": "..." }
  ],
  "evolution": "Brief description of what changed",
  "significance": "routine" | "notable" | "critical",
  "reasoning": "Why you made these decisions"
}`
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface UnderstandInitResult {
	identity: UnderstandIdentity
	systemPrompt: string
}

export async function initUnderstand(
	model: LanguageModel,
	instructions: string,
): Promise<UnderstandInitResult> {
	const prompt = identityPrompt(instructions)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: understandIdentitySchema }),
		repairSchema: understandIdentitySchema,
	})

	// System prompt is partially generated now; currentItems injected at call time
	return { identity, systemPrompt: '' }
}

export async function understand(
	model: LanguageModel,
	identity: UnderstandIdentity,
	context: UnderstandContext,
	callbacks?: UnderstandCallbacks,
): Promise<UnderstandOutput> {
	try {
		const system = systemPrompt(identity, context.currentItems)
		const prompt = `New observations to integrate:\n\n${context.observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nDecide what operations to apply to the collection.`

		const result = await generate({
			model,
			system,
			prompt,
			output: Output.object({ schema: understandOutputSchema }),
			repairSchema: understandOutputSchema,
		})

		if (callbacks?.onThinking && result.reasoning) {
			callbacks.onThinking(
				result.reasoning.map((r: { text: string }) => r.text),
			)
		}

		const data = result.output

		if (!data.changed || data.operations.length === 0) {
			return {
				status: 'dismissed',
				output: data.evolution || 'No changes needed',
				usage: result.usage,
			}
		}

		// Apply operations mechanically
		const newItems = applyOperations(context.currentItems, data.operations)

		return {
			status: 'synthesized',
			newItems,
			significance: data.significance as Significance,
			evolution: data.evolution,
			reasoning: data.reasoning,
			usage: result.usage,
		}
	} catch (error) {
		return { status: 'error', error }
	}
}

// ── Operation application ──────────────────────────────────────────────────

type RawOperation = z.infer<typeof operationSchema>

function applyOperations(
	currentItems: ListItem[],
	operations: RawOperation[],
): ListItem[] {
	const items = [...currentItems]
	const now = new Date().toISOString()

	for (const op of operations) {
		switch (op.type) {
			case 'add': {
				const newItem: ListItem = {
					id: `item_${nanoid()}`,
					data: op.item.data,
					metadata: {
						confidence: op.item.confidence ?? 0.5,
						firstSeen: now,
						lastUpdated: now,
						signals: op.item.signals ?? [],
					},
				}
				items.push(newItem)
				break
			}
			case 'update': {
				const idx = items.findIndex((item) => item.id === op.id)
				if (idx === -1) break

				const existing = items[idx]
				items[idx] = {
					...existing,
					data: op.changes.data
						? { ...existing.data, ...op.changes.data }
						: existing.data,
					metadata: {
						...existing.metadata,
						...(op.changes.confidence !== undefined && {
							confidence: op.changes.confidence,
						}),
						...(op.changes.signals && {
							signals: [
								...new Set([
									...existing.metadata.signals,
									...op.changes.signals,
								]),
							],
						}),
						lastUpdated: now,
					},
				}
				break
			}
			case 'remove': {
				const removeIdx = items.findIndex((item) => item.id === op.id)
				if (removeIdx !== -1) {
					items.splice(removeIdx, 1)
				}
				break
			}
		}
	}

	return items
}
