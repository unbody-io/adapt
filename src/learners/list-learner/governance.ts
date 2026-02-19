/**
 * List governance — mechanical post-synthesis processing
 *
 * All operations are deterministic, no LLM calls.
 * Applied in order: dedup → maxItems → pruning
 */

import type { ListItem, ResolvedListGovernanceConfig } from './types'

/**
 * Apply all governance rules to items list
 */
export function applyListGovernance(
	items: ListItem[],
	config: ResolvedListGovernanceConfig,
): ListItem[] {
	let result = items

	if (config.deduplication === 'strict') {
		result = dedup(result)
	}

	if (result.length > config.maxItems && config.pruning !== 'none') {
		result = prune(result, config.maxItems, config.pruning)
	}

	return result
}

/**
 * Strict deduplication — items with identical JSON-serialized data are merged.
 * Keeps the one with higher confidence; on tie, keeps the most recently updated.
 */
function dedup(items: ListItem[]): ListItem[] {
	const seen = new Map<string, ListItem>()

	for (const item of items) {
		const key = JSON.stringify(item.data)
		const existing = seen.get(key)

		if (!existing) {
			seen.set(key, item)
			continue
		}

		// Keep higher confidence; on tie, keep most recently updated
		if (
			item.metadata.confidence > existing.metadata.confidence ||
			(item.metadata.confidence === existing.metadata.confidence &&
				item.metadata.lastUpdated > existing.metadata.lastUpdated)
		) {
			seen.set(key, {
				...item,
				metadata: {
					...item.metadata,
					firstSeen: existing.metadata.firstSeen < item.metadata.firstSeen
						? existing.metadata.firstSeen
						: item.metadata.firstSeen,
					signals: [...new Set([...existing.metadata.signals, ...item.metadata.signals])],
				},
			})
		}
	}

	return [...seen.values()]
}

/**
 * Prune items to maxItems limit
 */
function prune(
	items: ListItem[],
	maxItems: number,
	strategy: 'oldest' | 'least-confident',
): ListItem[] {
	const sorted = [...items]

	if (strategy === 'oldest') {
		// Sort by lastUpdated descending — keep most recently updated
		sorted.sort((a, b) =>
			b.metadata.lastUpdated.localeCompare(a.metadata.lastUpdated),
		)
	} else {
		// Sort by confidence descending — keep most confident
		sorted.sort((a, b) => b.metadata.confidence - a.metadata.confidence)
	}

	return sorted.slice(0, maxItems)
}
