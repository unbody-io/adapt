/**
 * List-neuron query tools
 *
 * Provides understanding-access tools for the QueryMethod:
 * - getItems: list all items with optional filter
 * - searchItems: text search across item data
 * - getItem: get a single item by ID
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { QueryContext } from '../base/query'
import type { ListItem } from './types'

/**
 * Create list-specific query tools that close over neuron state
 */
export function createListQueryTools(
	getItems: () => Promise<ListItem[]>,
) {
	return {
		getItems: tool({
			description:
				'List all items in the collection. Optionally filter by a key-value pair.',
			inputSchema: z.object({
				filterKey: z
					.string()
					.optional()
					.describe('Data field name to filter by'),
				filterValue: z
					.string()
					.optional()
					.describe('Value to match (case-insensitive substring)'),
			}),
			execute: async (params) => {
				const items = await getItems()
				if (!params.filterKey || !params.filterValue) {
					return {
						count: items.length,
						items: items.map(summarizeItem),
					}
				}
				const filtered = items.filter((item) => {
					const val = item.data[params.filterKey!]
					if (val === undefined) return false
					return String(val)
						.toLowerCase()
						.includes(params.filterValue!.toLowerCase())
				})
				return {
					count: filtered.length,
					total: items.length,
					items: filtered.map(summarizeItem),
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
				const items = await getItems()
				const query = params.query.toLowerCase()
				const matches = items.filter((item) =>
					JSON.stringify(item.data).toLowerCase().includes(query),
				)
				return {
					count: matches.length,
					total: items.length,
					items: matches.map(summarizeItem),
				}
			},
		}),

		getItem: tool({
			description: 'Get a single item by its ID.',
			inputSchema: z.object({
				id: z.string().describe('The item ID'),
			}),
			execute: async (params) => {
				const items = await getItems()
				const item = items.find((i) => i.id === params.id)
				if (!item) return { found: false }
				return { found: true, item }
			},
		}),
	}
}

function summarizeItem(item: ListItem) {
	return {
		id: item.id,
		data: item.data,
		confidence: item.metadata.confidence,
		touchCount: item.metadata.touchCount,
		signals: item.metadata.signals,
	}
}

/**
 * Build the query prompt for list-based neurons
 */
export function buildListQueryPrompt(
	context: QueryContext,
	schema?: Record<string, unknown>,
): string {
	const props = (schema as Record<string, unknown>)?.properties as
		| Record<string, unknown>
		| undefined
	const fieldList = props ? Object.keys(props).join(', ') : ''
	const schemaLine = fieldList
		? `\nYour items have these data fields: ${fieldList}`
		: ''

	return `You are a specialist tracking a collection. Your domain:
"${context.instructions}"
${schemaLine}
Each item also has metadata: confidence (0-1, relative evidence strength), touchCount (how many times this item was referenced in observations).

Query: ${context.question}

Use getItems with filterKey/filterValue to filter by field values (works with booleans — use "true" or "false" as filterValue). Answer from what you track — reference specific items, quantify where possible. Don't invent.
If the query is outside your domain or collection is empty, say so briefly and complete.
Call complete when done.`
}
