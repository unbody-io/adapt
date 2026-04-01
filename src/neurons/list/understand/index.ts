/**
 * List understand phase — agentic tool-based flow
 *
 * The LLM agent processes observations using CRUD tools backed by store.understanding.
 * It searches for duplicates, adds new items, updates existing ones, removes stale ones.
 * Schema validation happens in write tool handlers — agent can self-correct on errors.
 * After the agent loop, final state is read from the store.
 */

import type { LanguageModel } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { generate, Output, stepCountIs } from '../../../llm'
import type { NeuronCollection, UnderstandingRecord } from '../../../stores/types'
import type { Significance } from '../../types'
import type { ListItem } from '../types'
import type {
	UnderstandCallbacks,
	UnderstandContext,
	UnderstandOutput,
} from './types'

const MAX_STEPS = 30

// ── Identity schema ────────────────────────────────────────────────────────

const understandIdentitySchema = z.object({
	identity: z
		.string()
		.describe(
			'Second-person description of the synthesizer. What items to maintain, how to determine add vs update vs remove, significance criteria.',
		),
})

export type UnderstandIdentity = z.infer<typeof understandIdentitySchema>

// ── Identity prompt ────────────────────────────────────────────────────────

function identityPrompt(instructions: string): string {
	return `You are creating a Synthesizer identity for a collection-tracking agent.

Root question: "Does this observation add, update, or change something in my collection?"

The agent's purpose:
"${instructions}"

The identity should specify: what items you maintain, how you match duplicates, when to add vs update vs remove, significance criteria (routine/notable/critical). Write in second person.

Respond with JSON only:
{
  "identity": "You maintain ..."
}`
}

// ── System prompt ──────────────────────────────────────────────────────────

function systemPrompt(identity: UnderstandIdentity): string {
	return `${identity.identity}

Your root question for each observation: "What does this tell me — is it new, does it update something I track, or does it change a status or priority?"

Each item tracks one distinct thing. Confidence reflects how well-supported it is. Signals mark what kind of evidence you've seen.

Use your tools to sense your collection before changing it. Call complete when done.`
}

// ── Tool creation ──────────────────────────────────────────────────────────

interface ChangeRecord {
	type: 'add' | 'update' | 'remove'
	id: string
	detail: string
}

function createUnderstandTools(
	collection: NeuronCollection<UnderstandingRecord>,
	understandingSchema: Record<string, unknown> | undefined,
	changes: ChangeRecord[],
) {
	// Build a Zod schema from the JSON Schema — used as the tool's inputSchema
	// so the model sees exact field names/types in the tool definition itself.
	const dataSchema = understandingSchema
		? z.fromJSONSchema(understandingSchema)
		: z.record(z.string(), z.unknown())

	return {
		listItems: tool({
			description:
				'List all items in the collection. Returns id, data, and confidence for each item.',
			inputSchema: z.object({}),
			execute: async () => {
				const records = await collection.list()
				return {
					count: records.length,
					items: records.map((r) => {
						const item = r.data as ListItem
						return { id: r.id, data: item.data, confidence: r.metadata_confidence }
					}),
				}
			},
		}),

		searchItems: tool({
			description:
				'Search items by text query. Matches against all fields in item data.',
			inputSchema: z.object({
				query: z.string().describe('Search query text'),
			}),
			execute: async (params) => {
				const matches = await collection.search(params.query)
				return {
					count: matches.length,
					items: matches.map((r) => {
						const item = r.data as ListItem
						return { id: r.id, data: item.data, confidence: r.metadata_confidence }
					}),
				}
			},
		}),

		getItem: tool({
			description: 'Get a single item by its ID with full details.',
			inputSchema: z.object({
				id: z.string().describe('The item ID'),
			}),
			execute: async (params) => {
				const record = await collection.get(params.id)
				if (!record) return { found: false }
				const item = record.data as ListItem
				return {
					found: true,
					id: record.id,
					data: item.data,
					confidence: item.metadata.confidence,
					signals: item.metadata.signals,
				}
			},
		}),

		addItem: tool({
			description:
				'Add a new item to the collection. Automatically checks for duplicates — if similar items exist, returns them so you can use updateItem instead.',
			inputSchema: z.object({
				data: dataSchema.describe('The item data matching the collection schema'),
				signals: z
					.array(z.string())
					.optional()
					.describe('Tags or signals for this item'),
			}),
			execute: async (params) => {
				const data = params.data as Record<string, unknown>

				// Force dedup: search each significant word from the primary identifier
				// Uses per-word OR to catch near-duplicates (e.g. "Custom Fields" vs "Custom Fields on Tasks")
				const firstStringField = Object.values(data).find(
					(v) => typeof v === 'string',
				) as string | undefined
				if (firstStringField) {
					const words = firstStringField
						.split(/[\s/]+/)
						.filter((w) => w.length > 2)
						.slice(0, 4)
					const seen = new Map<string, UnderstandingRecord>()
					for (const word of words) {
						const hits = await collection.search(word)
						for (const h of hits) seen.set(h.id, h)
					}
					if (seen.size > 0) {
						return {
							success: false,
							reason: 'Similar items already exist. Use updateItem to merge new data instead of creating a duplicate.',
							existingItems: [...seen.values()].map((r) => {
								const item = r.data as ListItem
								return { id: r.id, data: item.data }
							}),
						}
					}
				}

				const id = `item_${nanoid()}`
				const now = new Date().toISOString()
				const listItem: ListItem = {
					id,
					data,
					metadata: {
						confidence: 0,
						touchCount: 1,
						firstSeen: now,
						lastUpdated: now,
						signals: params.signals ?? [],
					},
				}
				await collection.add({
					id,
					data: listItem as unknown,
					metadata_confidence: 0,
					metadata_created_at: now,
					metadata_updated_at: now,
				})
				changes.push({
					type: 'add',
					id,
					detail: JSON.stringify(data).slice(0, 100),
				})
				return { success: true, id }
			},
		}),

		updateItem: tool({
			description:
				'Update an existing item. Merges data fields with existing data (does not replace). Returns success.',
			inputSchema: z.object({
				id: z.string().describe('ID of the item to update'),
				data: dataSchema.optional().describe('Fields to update/add in the item data'),
				signals: z
					.array(z.string())
					.optional()
					.describe('Signals to add (merged with existing)'),
			}),
			execute: async (params) => {
				const existing = await collection.get(params.id)
				if (!existing) {
					return { success: false, error: `Item ${params.id} not found` }
				}

				const existingItem = existing.data as ListItem
				const updateData = params.data as Record<string, unknown> | undefined
				const mergedData = updateData
					? { ...existingItem.data, ...updateData }
					: existingItem.data

				const now = new Date().toISOString()
				const mergedSignals = params.signals
					? [...new Set([...existingItem.metadata.signals, ...params.signals])]
					: existingItem.metadata.signals

				const updatedItem: ListItem = {
					...existingItem,
					data: mergedData,
					metadata: {
						...existingItem.metadata,
						touchCount: (existingItem.metadata.touchCount ?? 1) + 1,
						signals: mergedSignals,
						lastUpdated: now,
					},
				}

				await collection.update(params.id, {
					data: updatedItem as unknown,
					metadata_confidence: updatedItem.metadata.confidence,
					metadata_updated_at: now,
				})
				changes.push({
					type: 'update',
					id: params.id,
					detail: JSON.stringify(updateData || {}).slice(0, 100),
				})
				return { success: true }
			},
		}),

		removeItem: tool({
			description: 'Remove an item from the collection.',
			inputSchema: z.object({
				id: z.string().describe('ID of the item to remove'),
				reason: z.string().describe('Why this item should be removed'),
			}),
			execute: async (params) => {
				try {
					await collection.delete(params.id)
					changes.push({ type: 'remove', id: params.id, detail: params.reason })
					return { success: true }
				} catch {
					return { success: false, error: `Item ${params.id} not found` }
				}
			},
		}),

		complete: tool({
			description:
				'Call this when you are done processing all observations. Summarize what changed.',
			inputSchema: z.object({
				evolution: z
					.string()
					.describe('Brief description of what changed and why'),
				significance: z
					.enum(['routine', 'notable', 'critical'])
					.describe('How significant are these changes'),
				reasoning: z
					.string()
					.optional()
					.describe('Key reasoning behind the decisions'),
			}),
			// No execute — terminal tool
		}),
	}
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

	return { identity, systemPrompt: '' }
}

// ── Adjust prompt ─────────────────────────────────────────────────────────

function adjustIdentityPrompt(
	directive: string,
	newInstructions: string,
	currentIdentity: UnderstandIdentity,
): string {
	return `You are adjusting a Synthesizer's identity for a collection-tracking agent.

## Current State

**Instructions**: "${newInstructions}"
**Identity**: "${currentIdentity.identity}"

## Directive

"${directive}"

Adjust incrementally — preserve criteria that still apply, update for the new scope. If ambiguous, preserve more rather than less.

Respond with JSON only:
{
  "identity": "You maintain ..."
}`
}

/**
 * Adjust list understand phase — evolves identity from a directive
 */
export async function adjustUnderstand(
	model: LanguageModel,
	directive: string,
	newInstructions: string,
	currentIdentity: UnderstandIdentity,
): Promise<UnderstandInitResult> {
	const prompt = adjustIdentityPrompt(directive, newInstructions, currentIdentity)

	const { output: identity } = await generate({
		model,
		prompt,
		output: Output.object({ schema: understandIdentitySchema }),
		repairSchema: understandIdentitySchema,
	})

	return { identity, systemPrompt: '' }
}

/**
 * Adjust existing understanding content via a directive using existing CRUD tools.
 * The model senses its collection, reasons about what to change, and uses tools
 * to make the requested modifications.
 */
export async function adjustUnderstandingContent(
	model: LanguageModel,
	identity: UnderstandIdentity,
	directive: string,
	collection: NeuronCollection<UnderstandingRecord>,
	understandingSchema?: Record<string, unknown>,
): Promise<UnderstandOutput> {
	try {
		const changes: ChangeRecord[] = []
		const tools = createUnderstandTools(collection, understandingSchema, changes)

		const system = systemPrompt(identity)
		const prompt = `Adjustment directive: "${directive}"

Sense your collection, then make the requested changes.
Preserve items the directive doesn't address.`

		interface CompleteResult {
			evolution: string
			significance: string
			reasoning?: string
		}
		let completeResult: CompleteResult | null = null

		const result = await generate({
			model,
			system,
			prompt,
			tools,
			toolChoice: 'required' as const,
			stopWhen: stepCountIs(MAX_STEPS),
			onStepFinish: ({ toolCalls }) => {
				if (toolCalls) {
					for (const tc of toolCalls) {
						if (tc.toolName === 'complete') {
							completeResult = tc.input as CompleteResult
						}
					}
				}
			},
		})

		// Check final step for complete tool call
		const completeCall = result.toolCalls.find((c) => c.toolName === 'complete')
		if (completeCall && 'input' in completeCall) {
			completeResult = completeCall.input as CompleteResult
		}

		// No changes made
		if (changes.length === 0) {
			return {
				status: 'dismissed',
				output: completeResult?.evolution || 'No changes needed',
				usage: result.usage,
			}
		}

		// Normalize confidence: relative to max touchCount across collection
		const records = await collection.list()
		const allItems = records.map((r) => ({ record: r, item: r.data as ListItem }))
		const maxTouches = Math.max(1, ...allItems.map((x) => x.item.metadata.touchCount ?? 1))

		for (const { record, item } of allItems) {
			const newConfidence = (item.metadata.touchCount ?? 1) / maxTouches
			if (Math.abs(newConfidence - item.metadata.confidence) > 0.001) {
				item.metadata.confidence = newConfidence
				await collection.update(record.id, {
					data: item as unknown,
					metadata_confidence: newConfidence,
				})
			}
		}

		// Read final state from store
		const finalRecords = await collection.list()
		const newItems: ListItem[] = finalRecords.map((r) => r.data as ListItem)

		return {
			status: 'synthesized',
			newItems,
			significance: (completeResult?.significance as Significance) ?? 'routine',
			evolution: completeResult?.evolution ?? `${changes.length} operations applied`,
			reasoning: completeResult?.reasoning,
			usage: result.usage,
		}
	} catch (error) {
		return { status: 'error', error }
	}
}

export async function understand(
	model: LanguageModel,
	identity: UnderstandIdentity,
	context: UnderstandContext,
	collection: NeuronCollection<UnderstandingRecord>,
	understandingSchema?: Record<string, unknown>,
	callbacks?: UnderstandCallbacks,
): Promise<UnderstandOutput> {
	try {
		const changes: ChangeRecord[] = []
		const tools = createUnderstandTools(collection, understandingSchema, changes)

		const system = systemPrompt(identity)
		const prompt = `New observations to integrate:\n\n${context.observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nProcess these observations using your tools.`

		interface CompleteResult {
			evolution: string
			significance: string
			reasoning?: string
		}
		let completeResult: CompleteResult | null = null

		const result = await generate({
			model,
			system,
			prompt,
			tools,
			toolChoice: 'required' as const,
			stopWhen: stepCountIs(MAX_STEPS),
			onStepFinish: ({ text, toolCalls }) => {
				if (text && callbacks?.onThinking) {
					callbacks.onThinking([text])
				}
				if (toolCalls) {
					for (const tc of toolCalls) {
						if (tc.toolName === 'complete') {
							completeResult = tc.input as CompleteResult
						}
					}
				}
			},
		})

		// Check final step for complete tool call
		const completeCall = result.toolCalls.find(
			(c) => c.toolName === 'complete',
		)
		if (completeCall && 'input' in completeCall) {
			completeResult = completeCall.input as CompleteResult
		}

		// No changes made
		if (changes.length === 0) {
			return {
				status: 'dismissed',
				output: completeResult?.evolution || 'No changes needed',
				usage: result.usage,
			}
		}

		// Normalize confidence: relative to max touchCount across collection
		const records = await collection.list()
		const allItems = records.map((r) => ({ record: r, item: r.data as ListItem }))
		const maxTouches = Math.max(1, ...allItems.map((x) => x.item.metadata.touchCount ?? 1))

		for (const { record, item } of allItems) {
			const newConfidence = (item.metadata.touchCount ?? 1) / maxTouches
			if (Math.abs(newConfidence - item.metadata.confidence) > 0.001) {
				item.metadata.confidence = newConfidence
				await collection.update(record.id, {
					data: item as unknown,
					metadata_confidence: newConfidence,
				})
			}
		}

		// Read final state from store
		const finalRecords = await collection.list()
		const newItems: ListItem[] = finalRecords.map((r) => r.data as ListItem)

		return {
			status: 'synthesized',
			newItems,
			significance: (completeResult?.significance as Significance) ?? 'routine',
			evolution: completeResult?.evolution ?? `${changes.length} operations applied`,
			reasoning: completeResult?.reasoning,
			usage: result.usage,
		}
	} catch (error) {
		return { status: 'error', error }
	}
}
