/**
 * List-learner query tools
 *
 * Provides understanding-access tools for the QueryMethod:
 * - getItems: list all items with optional filter
 * - searchItems: text search across item data
 * - getItem: get a single item by ID
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { QueryContext } from '../base/query-method'
import type { ListItem } from './types'

/**
 * Create list-specific query tools that close over learner state
 */
export function createListQueryTools(
	getItems: () => ListItem[],
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
				const items = getItems()
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
				const items = getItems()
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
				const items = getItems()
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
		signals: item.metadata.signals,
	}
}

/**
 * Build the query prompt for list-based learners
 */
export function buildListQueryPrompt(context: QueryContext): string {
	return `You are a learning agent that tracks a collection of items. Your singular purpose:
"${context.instructions}"

You are being queried for insights based on your tracked items.

══════════════════════════════════════════════════════════════════════════════
QUERY
══════════════════════════════════════════════════════════════════════════════
${context.question}

══════════════════════════════════════════════════════════════════════════════
HOW TO RESPOND
══════════════════════════════════════════════════════════════════════════════

STEP 1: EXPLORE YOUR COLLECTION
Use the available tools to access your tracked items:
- getItems() — list all items, optionally filter by a field
- searchItems(query) — text search across all item data
- getItem(id) — get details of a specific item

Start by understanding what's in your collection before answering.

STEP 2: ASSESS RELEVANCE
Is this query something your collection can address?
- Your purpose: "${context.instructions}"
- If the query is outside your purpose, say so clearly.
- If your collection is empty, acknowledge that.
- If outside your scope: skip directly to STEP 5 (complete). Set relevant to false, keep insight to one brief sentence.

STEP 3: GENERATE RESPONSE (use generateResponse tool)
Draw insights from your collection to answer the query.

  DO:
    - Reference specific items and data from your collection
    - Quantify when possible (counts, percentages, trends)
    - Express confidence based on collection coverage

  DON'T:
    - Make up items not in your collection
    - Over-generalize from limited data

STEP 4: IDENTIFY GAPS (use identifyGaps tool)
What items or information are missing from your collection?

STEP 5: COMPLETE (use complete tool to finish)
Finalize your response with relevance, confidence, insight, and gaps.`
}
