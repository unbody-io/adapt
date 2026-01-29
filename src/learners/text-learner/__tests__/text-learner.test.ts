import type { LanguageModel } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { TextLearner } from '..'

// Mock the AI SDK module
vi.mock('ai', () => ({
	generateText: vi.fn(),
	ToolLoopAgent: vi.fn().mockImplementation(() => ({
		generate: vi.fn(),
	})),
}))

describe('TextLearner', () => {
	// Create a simple mock model
	const mockModel = {} as LanguageModel

	describe('constructor', () => {
		it('creates a learner with required config', () => {
			const learner = new TextLearner({
				model: mockModel,
				instructions: 'Understand user preferences',
			})

			expect(learner.instructions).toBe('Understand user preferences')
			expect(learner.origin).toBe('developer')
			expect(learner.id).toBeDefined()
		})

		it('uses provided id when given', () => {
			const learner = new TextLearner({
				model: mockModel,
				id: 'custom-id',
				instructions: 'Test purpose',
			})

			expect(learner.id).toBe('custom-id')
		})

		it('initializes with dormant status and zero activation', () => {
			const learner = new TextLearner({ model: mockModel, instructions: 'Test' })
			const governance = learner.getGovernance()

			expect(governance.status).toBe('dormant')
			expect(governance.activation).toBe(0)
			expect(governance.threshold).toBe(0.3)
		})
	})

	describe('getUnderstanding', () => {
		it('returns empty string initially', () => {
			const learner = new TextLearner({ model: mockModel, instructions: 'Test' })

			expect(learner.getUnderstanding()).toBe('')
		})
	})

	describe('getSummary', () => {
		it('returns placeholder text when no understanding', () => {
			const learner = new TextLearner({ model: mockModel, instructions: 'Test' })

			expect(learner.getSummary()).toBe('(no understanding yet)')
		})
	})

	describe('getMetadata', () => {
		it('returns complete metadata', () => {
			const learner = new TextLearner({
				model: mockModel,
				id: 'test-id',
				instructions: 'Test purpose',
				origin: 'prompt',
			})

			const metadata = learner.getMetadata()

			expect(metadata).toEqual({
				id: 'test-id',
				instructions: 'Test purpose',
				origin: 'prompt',
				governance: expect.objectContaining({
					status: 'dormant',
					activation: 0,
				}),
			})
		})
	})

	describe('getMaintenance', () => {
		it('returns default maintenance config', () => {
			const learner = new TextLearner({ model: mockModel, instructions: 'Test' })
			const maintenance = learner.getMaintenance()

			expect(maintenance).toEqual({
				strategy: 'continuous',
			})
		})

		it('returns custom maintenance config when provided', () => {
			const learner = new TextLearner({
				model: mockModel,
				instructions: 'Test',
				maintenance: { strategy: 'cumulative', maxTokens: 2000 },
			})
			const maintenance = learner.getMaintenance()

			expect(maintenance).toEqual({
				strategy: 'cumulative',
				maxTokens: 2000,
			})
		})
	})

	describe('governance', () => {
		it('returns a copy of governance (not reference)', () => {
			const learner = new TextLearner({ model: mockModel, instructions: 'Test' })

			const gov1 = learner.getGovernance()
			const gov2 = learner.getGovernance()

			expect(gov1).not.toBe(gov2)
			expect(gov1).toEqual(gov2)
		})
	})
})
