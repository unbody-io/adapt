import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../src/neurons/text/strategies/utils'
import { continuous } from '../src/neurons/text/strategies/continuous/fn'
import { cumulative } from '../src/neurons/text/strategies/cumulative/fn'
import { decay } from '../src/neurons/text/strategies/decay/fn'
import { applyStrategy, strategyFunctions } from '../src/neurons/text/strategies'
import { mockModel } from './helpers'

// ── estimateTokens ────────────────────────────────────────────────────────────

describe('estimateTokens', () => {
	it('returns 0 for empty string', () => {
		expect(estimateTokens('')).toBe(0)
	})

	it('returns 0 for falsy input', () => {
		expect(estimateTokens(null as any)).toBe(0)
		expect(estimateTokens(undefined as any)).toBe(0)
	})

	it('estimates ~4 chars per token', () => {
		// 100 chars → 25 tokens
		const text = 'a'.repeat(100)
		expect(estimateTokens(text)).toBe(25)
	})

	it('rounds up', () => {
		// 5 chars → ceil(5/4) = 2
		expect(estimateTokens('hello')).toBe(2)
	})
})

// ── continuous ────────────────────────────────────────────────────────────────

describe('continuous strategy', () => {
	it('returns understanding unchanged', async () => {
		const result = await continuous({
			understanding: 'some text',
			model: mockModel(),
			config: { strategy: 'continuous' },
		})
		expect(result.understanding).toBe('some text')
		expect(result.modified).toBe(false)
	})
})

// ── cumulative ────────────────────────────────────────────────────────────────

describe('cumulative strategy', () => {
	it('passes through when under maxTokens', async () => {
		const shortText = 'short text' // well under any token limit
		const result = await cumulative({
			understanding: shortText,
			model: mockModel(),
			config: { strategy: 'cumulative', maxTokens: 4000 },
		})
		expect(result.understanding).toBe(shortText)
		expect(result.modified).toBe(false)
	})

	// Note: testing the compression branch would require a real LLM call
	// (user directive: use real LLMs where needed, don't mock)
})

// ── decay ─────────────────────────────────────────────────────────────────────

describe('decay strategy', () => {
	it('passes through under 80% threshold', async () => {
		// maxTokens=4000, 80% = 3200 tokens = ~12800 chars
		const shortText = 'a'.repeat(100) // 25 tokens, well under 3200
		const result = await decay({
			understanding: shortText,
			model: mockModel(),
			config: { strategy: 'decay', maxTokens: 4000 },
		})
		expect(result.understanding).toBe(shortText)
		expect(result.modified).toBe(false)
	})

	// Note: testing the compression branch would require a real LLM call
})

// ── applyStrategy dispatch ────────────────────────────────────────────────────

describe('applyStrategy', () => {
	it('dispatches to continuous', async () => {
		const result = await applyStrategy({
			understanding: 'test',
			model: mockModel(),
			config: { strategy: 'continuous' },
		})
		expect(result.modified).toBe(false)
	})

	it('dispatches to cumulative', async () => {
		const result = await applyStrategy({
			understanding: 'test',
			model: mockModel(),
			config: { strategy: 'cumulative', maxTokens: 4000 },
		})
		expect(result.modified).toBe(false)
	})

	it('dispatches to decay', async () => {
		const result = await applyStrategy({
			understanding: 'test',
			model: mockModel(),
			config: { strategy: 'decay', maxTokens: 4000 },
		})
		expect(result.modified).toBe(false)
	})

	it('strategyFunctions has all three strategies', () => {
		expect(Object.keys(strategyFunctions)).toEqual(['continuous', 'cumulative', 'decay'])
	})
})
