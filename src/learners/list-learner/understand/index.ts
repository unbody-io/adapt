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
import type { Collection, UnderstandingRecord } from '../../stores/types'
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

// ── System prompt ──────────────────────────────────────────────────────────

function systemPrompt(identity: UnderstandIdentity): string {
	return `${identity.identity}

You have tools to manage a collection of items. Process the given observations by:
1. Listing or searching existing items to understand what's already tracked
2. For each observation: search for matches before adding — avoid duplicates
3. Add new items, update existing ones with new info, or remove stale ones
4. When updating, merge new data with existing data — don't replace

If a tool returns a validation error, adjust the data and retry.
When done processing all observations, call the complete tool with a summary.`
}

// ── Tool creation ──────────────────────────────────────────────────────────

interface ChangeRecord {
	type: 'add' | 'update' | 'remove'
	id: string
	detail: string
}

function createUnderstandTools(
	collection: Collection<UnderstandingRecord>,
	understandingSchema: Record<string, unknown> | undefined,
	changes: ChangeRecord[],
) {
	const validateData = (data: Record<string, unknown>): { valid: boolean; error?: string } => {
		if (!understandingSchema) return { valid: true }
		const result = z.fromJSONSchema(understandingSchema).safeParse(data)
		if (result.success) return { valid: true }
		return { valid: false, error: result.error.message }
	}

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
				'Add a new item to the collection. Data is validated against the schema. Returns the new item ID.',
			inputSchema: z.object({
				data: z
					.record(z.string(), z.unknown())
					.describe('The item data as key-value pairs'),
				confidence: z
					.number()
					.min(0)
					.max(1)
					.optional()
					.describe('Confidence score (0-1), defaults to 0.5'),
				signals: z
					.array(z.string())
					.optional()
					.describe('Tags or signals for this item'),
			}),
			execute: async (params) => {
				const validation = validateData(params.data)
				if (!validation.valid) {
					return {
						success: false,
						error: `Validation failed: ${validation.error}. Adjust data and retry.`,
					}
				}
				const id = `item_${nanoid()}`
				const now = new Date().toISOString()
				const listItem: ListItem = {
					id,
					data: params.data,
					metadata: {
						confidence: params.confidence ?? 0.5,
						firstSeen: now,
						lastUpdated: now,
						signals: params.signals ?? [],
					},
				}
				await collection.add({
					id,
					data: listItem as unknown,
					metadata_confidence: listItem.metadata.confidence,
					metadata_created_at: now,
					metadata_updated_at: now,
				})
				changes.push({
					type: 'add',
					id,
					detail: JSON.stringify(params.data).slice(0, 100),
				})
				return { success: true, id }
			},
		}),

		updateItem: tool({
			description:
				'Update an existing item. Merges data fields with existing data (does not replace). Returns success.',
			inputSchema: z.object({
				id: z.string().describe('ID of the item to update'),
				data: z
					.record(z.string(), z.unknown())
					.optional()
					.describe('Fields to update/add in the item data'),
				confidence: z.number().min(0).max(1).optional(),
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
				const mergedData = params.data
					? { ...existingItem.data, ...params.data }
					: existingItem.data

				if (params.data) {
					const validation = validateData(mergedData)
					if (!validation.valid) {
						return {
							success: false,
							error: `Validation failed: ${validation.error}. Adjust data and retry.`,
						}
					}
				}

				const now = new Date().toISOString()
				const mergedSignals = params.signals
					? [...new Set([...existingItem.metadata.signals, ...params.signals])]
					: existingItem.metadata.signals

				const updatedItem: ListItem = {
					...existingItem,
					data: mergedData,
					metadata: {
						...existingItem.metadata,
						...(params.confidence !== undefined && {
							confidence: params.confidence,
						}),
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
					detail: JSON.stringify(params.data || {}).slice(0, 100),
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

export async function understand(
	model: LanguageModel,
	identity: UnderstandIdentity,
	context: UnderstandContext,
	collection: Collection<UnderstandingRecord>,
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

		// Read final state from store
		const records = await collection.list()
		const newItems: ListItem[] = records.map((r) => r.data as ListItem)

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
