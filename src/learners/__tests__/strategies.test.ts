import type { LanguageModel } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { applyStrategy, strategyFunctions } from '../strategies.js'

// Mock generateText for strategies that need LLM calls
vi.mock('ai', async () => {
	const actual = await vi.importActual('ai')
	return {
		...actual,
		generateText: vi.fn().mockResolvedValue({
			text: 'Summarized understanding content',
		}),
	}
})

describe('strategies', () => {
	const mockModel = {} as LanguageModel

	describe('continuous', () => {
		it('returns understanding unchanged', async () => {
			const result = await strategyFunctions.continuous({
				understanding: 'Current understanding',
				model: mockModel,
				config: { strategy: 'continuous' },
			})

			expect(result.understanding).toBe('Current understanding')
			expect(result.modified).toBe(false)
		})
	})

	describe('rolling-summary', () => {
		it('returns unchanged when under token limit', async () => {
			const result = await strategyFunctions['rolling-summary']({
				understanding: 'Short understanding',
				model: mockModel,
				config: { strategy: 'rolling-summary', maxTokens: 4000 },
			})

			expect(result.understanding).toBe('Short understanding')
			expect(result.modified).toBe(false)
		})

		it('summarizes when over token limit', async () => {
			// Create understanding that exceeds 4000 tokens (~16000 chars)
			const longUnderstanding = 'A'.repeat(20000)

			const result = await strategyFunctions['rolling-summary']({
				understanding: longUnderstanding,
				model: mockModel,
				config: { strategy: 'rolling-summary', maxTokens: 4000 },
			})

			expect(result.understanding).toBe('Summarized understanding content')
			expect(result.modified).toBe(true)
		})

		it('uses default maxTokens of 4000', async () => {
			const shortUnderstanding = 'Short'

			const result = await strategyFunctions['rolling-summary']({
				understanding: shortUnderstanding,
				model: mockModel,
				config: { strategy: 'rolling-summary' }, // No maxTokens specified
			})

			expect(result.modified).toBe(false)
		})
	})

	describe('temporal-layers', () => {
		it('returns unchanged when well under token limit', async () => {
			const result = await strategyFunctions['temporal-layers']({
				understanding: 'Current state: all good',
				model: mockModel,
				config: { strategy: 'temporal-layers', maxTokens: 4000 },
			})

			expect(result.understanding).toBe('Current state: all good')
			expect(result.modified).toBe(false)
		})

		it('compresses when approaching token limit (80%)', async () => {
			// Create understanding that exceeds 80% of 4000 tokens (~12800 chars)
			const longUnderstanding = 'B'.repeat(14000)

			const result = await strategyFunctions['temporal-layers']({
				understanding: longUnderstanding,
				model: mockModel,
				config: { strategy: 'temporal-layers', maxTokens: 4000 },
			})

			expect(result.understanding).toBe('Summarized understanding content')
			expect(result.modified).toBe(true)
		})
	})

	describe('applyStrategy', () => {
		it('dispatches to correct strategy function', async () => {
			const result = await applyStrategy({
				understanding: 'Test',
				model: mockModel,
				config: { strategy: 'continuous' },
			})

			expect(result.understanding).toBe('Test')
			expect(result.modified).toBe(false)
		})
	})
})
