import { describe, it, expect } from 'vitest'
import {
	createInitialBrainState,
	toBrainModelRef,
	serializeBrainModelSlots,
} from '../src/brain/state'
import { BRAIN_DEFAULTS } from '../src/brain/config.defaults'
import { mockModel } from './helpers'

// ── toBrainModelRef ───────────────────────────────────────────────────────────

describe('toBrainModelRef', () => {
	it('extracts provider and modelId from LanguageModel', () => {
		const model = mockModel('openai', 'gpt-4o')
		const ref = toBrainModelRef(model)
		expect(ref).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
	})

	it('handles different provider/model combos', () => {
		const model = mockModel('anthropic', 'claude-3-opus')
		const ref = toBrainModelRef(model)
		expect(ref).toEqual({ provider: 'anthropic', modelId: 'claude-3-opus' })
	})
})

// ── serializeBrainModelSlots ──────────────────────────────────────────────────

describe('serializeBrainModelSlots', () => {
	it('converts all slots to stored refs', () => {
		const defaultModel = mockModel('openai', 'gpt-4o')
		const bpModel = mockModel('openai', 'gpt-4o-mini')

		const slots = {
			default: defaultModel,
			blueprint: bpModel,
			init: defaultModel,
			query: defaultModel,
			evolution: defaultModel,
		}

		const serialized = serializeBrainModelSlots(slots)
		expect(serialized.default).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
		expect(serialized.blueprint).toEqual({ provider: 'openai', modelId: 'gpt-4o-mini' })
		expect(serialized.init).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
		expect(serialized.query).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
		expect(serialized.evolution).toEqual({ provider: 'openai', modelId: 'gpt-4o' })
	})
})

// ── createInitialBrainState ───────────────────────────────────────────────────

describe('createInitialBrainState', () => {
	const model = mockModel('openai', 'gpt-4o')
	const bpModel = mockModel('openai', 'gpt-4o-mini')

	it('populates all model slots', () => {
		const state = createInitialBrainState({
			prompt: 'test prompt',
			model,
			blueprintModel: bpModel,
			initModel: model,
			queryModel: model,
			evolutionModel: model,
			batchSize: 20,
			evolution: {
				enabled: true,
				evaluatorSignalThreshold: 5,
				autoEvaluate: true,
				coverageGap: {
					relevanceThreshold: 0.3,
					gapCountThreshold: 3,
					windowSize: 50,
				},
			},
		})

		expect(state.models.default).toBe(model)
		expect(state.models.blueprint).toBe(bpModel)
		expect(state.models.init).toBe(model)
		expect(state.models.query).toBe(model)
		expect(state.models.evolution).toBe(model)
	})

	it('sets prompt', () => {
		const state = createInitialBrainState({
			prompt: 'Track coding patterns',
			model,
			blueprintModel: model,
			initModel: model,
			queryModel: model,
			evolutionModel: model,
			batchSize: 20,
			evolution: {
				enabled: true,
				evaluatorSignalThreshold: 5,
				autoEvaluate: true,
				coverageGap: {
					relevanceThreshold: 0.3,
					gapCountThreshold: 3,
					windowSize: 50,
				},
			},
		})

		expect(state.prompt).toBe('Track coding patterns')
	})

	it('sets promptContext to null initially', () => {
		const state = createInitialBrainState({
			prompt: 'test',
			model,
			blueprintModel: model,
			initModel: model,
			queryModel: model,
			evolutionModel: model,
			batchSize: 10,
			evolution: {
				enabled: false,
				evaluatorSignalThreshold: 5,
				autoEvaluate: false,
				coverageGap: {
					relevanceThreshold: 0.3,
					gapCountThreshold: 3,
					windowSize: 50,
				},
			},
		})

		expect(state.promptContext).toBeNull()
	})

	it('sets ingest batchSize', () => {
		const state = createInitialBrainState({
			prompt: 'test',
			model,
			blueprintModel: model,
			initModel: model,
			queryModel: model,
			evolutionModel: model,
			batchSize: 15,
			evolution: {
				enabled: true,
				evaluatorSignalThreshold: 5,
				autoEvaluate: true,
				coverageGap: {
					relevanceThreshold: 0.3,
					gapCountThreshold: 3,
					windowSize: 50,
				},
			},
		})

		expect(state.ingest.batchSize).toBe(15)
	})

	it('passes through evolution config', () => {
		const evolution = {
			enabled: false,
			evaluatorSignalThreshold: 10,
			autoEvaluate: false,
			coverageGap: {
				relevanceThreshold: 0.5,
				gapCountThreshold: 5,
				windowSize: 100,
			},
		}

		const state = createInitialBrainState({
			prompt: 'test',
			model,
			blueprintModel: model,
			initModel: model,
			queryModel: model,
			evolutionModel: model,
			batchSize: 20,
			evolution,
		})

		expect(state.evolution).toEqual(evolution)
	})
})

// ── BRAIN_DEFAULTS ────────────────────────────────────────────────────────────

describe('BRAIN_DEFAULTS', () => {
	it('has correct ingest defaults', () => {
		expect(BRAIN_DEFAULTS.ingest.batchSize).toBe(20)
	})

	it('has correct learning defaults', () => {
		expect(BRAIN_DEFAULTS.learning.understand.thresholds.maxObservations).toBe(10)
		expect(BRAIN_DEFAULTS.learning.understand.thresholds.maxTokens).toBe(8000)
		expect(BRAIN_DEFAULTS.learning.understand.thresholds.minImportance).toBe(0.5)
		expect(BRAIN_DEFAULTS.learning.governance.strategy).toBe('cumulative')
		expect(BRAIN_DEFAULTS.learning.governance.maxTokens).toBe(16000)
	})

	it('has correct evolution defaults', () => {
		expect(BRAIN_DEFAULTS.evolution.enabled).toBe(true)
		expect(BRAIN_DEFAULTS.evolution.evaluatorSignalThreshold).toBe(5)
		expect(BRAIN_DEFAULTS.evolution.autoEvaluate).toBe(true)
	})

	it('has correct dismissed batch buffer defaults', () => {
		expect(BRAIN_DEFAULTS.dismissedBatchBuffer.maxSize).toBe(100)
	})
})
