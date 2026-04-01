import { describe, it, expect } from 'vitest'
import { applyListGovernance } from '../src/neurons/list/governance'
import type { ListItem } from '../src/neurons/list/types'

function makeItem(overrides: Partial<ListItem> & { id: string }): ListItem {
	return {
		data: { name: overrides.id },
		metadata: {
			confidence: 0.5,
			touchCount: 1,
			firstSeen: '2025-01-01T00:00:00Z',
			lastUpdated: '2025-01-01T00:00:00Z',
			signals: [],
		},
		...overrides,
	}
}

describe('applyListGovernance', () => {
	const defaultConfig = {
		deduplication: 'strict' as const,
		maxItems: 200,
		pruning: 'oldest' as const,
	}

	// ── Deduplication ──

	describe('strict deduplication', () => {
		it('removes exact duplicate data', () => {
			const items = [
				makeItem({ id: 'a', data: { name: 'foo' } }),
				makeItem({ id: 'b', data: { name: 'foo' } }),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result).toHaveLength(1)
		})

		it('keeps items with different data', () => {
			const items = [
				makeItem({ id: 'a', data: { name: 'foo' } }),
				makeItem({ id: 'b', data: { name: 'bar' } }),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result).toHaveLength(2)
		})

		it('sums touchCounts when merging duplicates', () => {
			const items = [
				makeItem({
					id: 'a',
					data: { name: 'foo' },
					metadata: { confidence: 0.5, touchCount: 3, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-02T00:00:00Z', signals: [] },
				}),
				makeItem({
					id: 'b',
					data: { name: 'foo' },
					metadata: { confidence: 0.7, touchCount: 2, firstSeen: '2025-01-03T00:00:00Z', lastUpdated: '2025-01-04T00:00:00Z', signals: [] },
				}),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result).toHaveLength(1)
			expect(result[0].metadata.touchCount).toBe(5)
		})

		it('takes max confidence when merging', () => {
			const items = [
				makeItem({
					id: 'a',
					data: { name: 'foo' },
					metadata: { confidence: 0.3, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] },
				}),
				makeItem({
					id: 'b',
					data: { name: 'foo' },
					metadata: { confidence: 0.9, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-02T00:00:00Z', signals: [] },
				}),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result[0].metadata.confidence).toBe(0.9)
		})

		it('keeps earliest firstSeen when merging', () => {
			const items = [
				makeItem({
					id: 'a',
					data: { name: 'foo' },
					metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-05T00:00:00Z', signals: [] },
				}),
				makeItem({
					id: 'b',
					data: { name: 'foo' },
					metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-10T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] },
				}),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result[0].metadata.firstSeen).toBe('2025-01-01T00:00:00Z')
		})

		it('unions signals when merging', () => {
			const items = [
				makeItem({
					id: 'a',
					data: { name: 'foo' },
					metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-02T00:00:00Z', signals: ['sig-a', 'sig-b'] },
				}),
				makeItem({
					id: 'b',
					data: { name: 'foo' },
					metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: ['sig-b', 'sig-c'] },
				}),
			]
			const result = applyListGovernance(items, defaultConfig)
			expect(result[0].metadata.signals).toEqual(expect.arrayContaining(['sig-a', 'sig-b', 'sig-c']))
			expect(result[0].metadata.signals).toHaveLength(3)
		})
	})

	describe('deduplication disabled', () => {
		it('keeps all items when deduplication is none', () => {
			const items = [
				makeItem({ id: 'a', data: { name: 'foo' } }),
				makeItem({ id: 'b', data: { name: 'foo' } }),
			]
			const result = applyListGovernance(items, { ...defaultConfig, deduplication: 'none' })
			expect(result).toHaveLength(2)
		})
	})

	// ── Pruning ──

	describe('pruning: oldest', () => {
		it('keeps most recently updated items up to maxItems', () => {
			const items = [
				makeItem({ id: 'old', data: { name: 'old' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] } }),
				makeItem({ id: 'mid', data: { name: 'mid' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-05T00:00:00Z', signals: [] } }),
				makeItem({ id: 'new', data: { name: 'new' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-10T00:00:00Z', signals: [] } }),
			]
			const result = applyListGovernance(items, { ...defaultConfig, maxItems: 2 })
			expect(result).toHaveLength(2)
			expect(result.map((i) => i.id)).toContain('new')
			expect(result.map((i) => i.id)).toContain('mid')
			expect(result.map((i) => i.id)).not.toContain('old')
		})
	})

	describe('pruning: least-confident', () => {
		it('keeps highest confidence items up to maxItems', () => {
			const items = [
				makeItem({ id: 'low', data: { name: 'low' }, metadata: { confidence: 0.2, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] } }),
				makeItem({ id: 'mid', data: { name: 'mid' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] } }),
				makeItem({ id: 'high', data: { name: 'high' }, metadata: { confidence: 0.9, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] } }),
			]
			const result = applyListGovernance(items, { ...defaultConfig, maxItems: 2, pruning: 'least-confident' })
			expect(result).toHaveLength(2)
			expect(result.map((i) => i.id)).toContain('high')
			expect(result.map((i) => i.id)).toContain('mid')
			expect(result.map((i) => i.id)).not.toContain('low')
		})
	})

	describe('pruning disabled', () => {
		it('keeps all items when pruning is none even over maxItems', () => {
			const items = [
				makeItem({ id: 'a', data: { name: 'a' } }),
				makeItem({ id: 'b', data: { name: 'b' } }),
				makeItem({ id: 'c', data: { name: 'c' } }),
			]
			const result = applyListGovernance(items, { ...defaultConfig, maxItems: 2, pruning: 'none' })
			expect(result).toHaveLength(3)
		})
	})

	// ── Pipeline order ──

	describe('pipeline: dedup runs before pruning', () => {
		it('deduplicates first, then prunes', () => {
			// 4 items, 2 are dupes → dedup to 3 → prune to 2
			const items = [
				makeItem({ id: 'a', data: { name: 'unique-a' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-01T00:00:00Z', signals: [] } }),
				makeItem({ id: 'b', data: { name: 'dupe' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-03T00:00:00Z', signals: [] } }),
				makeItem({ id: 'c', data: { name: 'dupe' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-02T00:00:00Z', signals: [] } }),
				makeItem({ id: 'd', data: { name: 'unique-d' }, metadata: { confidence: 0.5, touchCount: 1, firstSeen: '2025-01-01T00:00:00Z', lastUpdated: '2025-01-04T00:00:00Z', signals: [] } }),
			]
			const result = applyListGovernance(items, { ...defaultConfig, maxItems: 2 })
			// After dedup: 3 items (unique-a, dupe merged, unique-d)
			// After prune (oldest): keep 2 most recent
			expect(result).toHaveLength(2)
		})
	})

	// ── No pruning when under limit ──

	it('does not prune when under maxItems', () => {
		const items = [
			makeItem({ id: 'a', data: { name: 'a' } }),
			makeItem({ id: 'b', data: { name: 'b' } }),
		]
		const result = applyListGovernance(items, { ...defaultConfig, maxItems: 10 })
		expect(result).toHaveLength(2)
	})

	it('returns empty array for empty input', () => {
		const result = applyListGovernance([], defaultConfig)
		expect(result).toHaveLength(0)
	})
})
