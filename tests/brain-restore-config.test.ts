import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { LanguageModel } from 'ai'
import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3GenerateResult,
} from '@ai-sdk/provider'
import { Brain } from '../src/brain'
import { MemoryBrainStore } from '../src/stores'
import { SQLiteBrainStore } from '../src/sqlite'
import type { BrainStore } from '../src/stores'

function createQueuedJsonModel(responses: unknown[]) {
	let callCount = 0
	const usage: LanguageModelV3GenerateResult['usage'] = {
		inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 0, text: 0, reasoning: 0 },
	}
	const model: LanguageModelV3 = {
		specificationVersion: 'v3',
		provider: 'test',
		modelId: 'queued',
		supportedUrls: {},
		async doGenerate(_opts: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
			if (callCount >= responses.length) {
				throw new Error(`No queued response for call ${callCount + 1}`)
			}
			const response = responses[callCount++]
			return {
				content: [{ type: 'text', text: JSON.stringify(response) }],
				finishReason: { unified: 'stop', raw: 'stop' },
				usage,
				warnings: [],
				request: {},
				response: { id: `r-${callCount}`, timestamp: new Date(), modelId: 'queued' },
			}
		},
		async doStream(): Promise<never> {
			throw new Error('not implemented')
		},
	}
	return { model: model as unknown as LanguageModel, getCallCount: () => callCount }
}

const initResponses = () => [
	{ identity: 'You observe coding notes.', domain: 'coding' },
	{ identity: 'You synthesize coding preferences.', skills: [], dynamicsSkills: [] },
	{
		purpose: 'Track coding preferences and patterns.',
		evolutionGuidance: null,
		synthesisDirective: null,
	},
]

interface Scenario {
	name: string
	openStore: () => BrainStore
}

const tmpDirs: string[] = []

afterEach(() => {
	while (tmpDirs.length > 0) {
		const dir = tmpDirs.pop()
		if (dir) rmSync(dir, { recursive: true, force: true })
	}
})

const memoryScenario = (): Scenario => {
	// Same MemoryBrainStore instance — its getNeuronStore cache IS the persistence
	// layer for memory.
	const shared = new MemoryBrainStore()
	return {
		name: 'MemoryBrainStore',
		openStore: () => shared,
	}
}

const sqliteScenario = (): Scenario => {
	const dir = mkdtempSync(join(tmpdir(), 'adapt-restore-config-'))
	tmpDirs.push(dir)
	const path = join(dir, 'brain.db')
	return {
		name: 'SQLiteBrainStore',
		openStore: () => new SQLiteBrainStore(path),
	}
}

const scenarios = [
	{ name: 'MemoryBrainStore', factory: memoryScenario },
	{ name: 'SQLiteBrainStore', factory: sqliteScenario },
]

const baseConfig = (
	store: BrainStore,
	model: LanguageModel,
	overrides: { batchSize?: number; maxObservations?: number },
) => ({
	prompt: 'Track coding patterns and preferences.',
	model,
	autoSetup: false,
	store,
	neurons: [
		{
			id: 'coding',
			type: 'text' as const,
			name: 'Coding',
			description: 'Tracks coding patterns',
			instructions: 'Track coding patterns and preferences.',
			observationSchema: { type: 'string' },
			understandingSchema: { type: 'string' },
		},
	],
	ingest: { batchSize: overrides.batchSize ?? 5 },
	learning: {
		understand: { thresholds: { maxObservations: overrides.maxObservations ?? 5 } },
	},
	internalNeurons: {
		globalUnderstanding: false,
		globalQueryUnderstanding: false,
		injectionGaps: false,
		queryGaps: false,
	},
	evolution: { enabled: false },
})

describe.each(scenarios)('Brain restore config precedence ($name)', ({ factory }) => {
	it('persisted runtime knobs survive a create→restore round-trip', async () => {
		const scenario = factory()
		const { model } = createQueuedJsonModel(initResponses())
		const brain1 = await Brain.create(
			baseConfig(scenario.openStore(), model, { batchSize: 5, maxObservations: 5 }),
		)
		expect(brain1.config.ingest.batchSize).toBe(5)
		expect(brain1.getNeuron('coding')?.getUnderstandThresholds().maxObservations).toBe(5)
		await brain1.dispose()

		const brain2 = await Brain.restore(scenario.openStore())
		expect(brain2.config.ingest.batchSize).toBe(5)
		expect(brain2.getNeuron('coding')?.getUnderstandThresholds().maxObservations).toBe(5)
		await brain2.dispose()
	})

	it('Brain.create on a populated store throws', async () => {
		const scenario = factory()
		const { model } = createQueuedJsonModel(initResponses())
		const brain = await Brain.create(baseConfig(scenario.openStore(), model, {}))
		await brain.dispose()

		const { model: model2 } = createQueuedJsonModel([])
		await expect(
			Brain.create(baseConfig(scenario.openStore(), model2, {})),
		).rejects.toThrow(/already exists/i)
	})

	it('Brain.restore on an empty store throws', async () => {
		const scenario = factory()
		await expect(Brain.restore(scenario.openStore())).rejects.toThrow(/no brain found/i)
	})

	it('post-restore brain.update overrides loaded values and persists', async () => {
		const scenario = factory()
		const { model } = createQueuedJsonModel(initResponses())
		const brain1 = await Brain.create(
			baseConfig(scenario.openStore(), model, { batchSize: 5, maxObservations: 5 }),
		)
		await brain1.dispose()

		const brain2 = await Brain.restore(scenario.openStore())
		await brain2.update({
			ingest: { batchSize: 20 },
			learning: { understand: { thresholds: { maxObservations: 20 } } },
		})
		expect(brain2.config.ingest.batchSize).toBe(20)
		expect(brain2.getNeuron('coding')?.getUnderstandThresholds().maxObservations).toBe(20)
		await brain2.dispose()

		const brain3 = await Brain.restore(scenario.openStore())
		expect(brain3.config.ingest.batchSize).toBe(20)
		expect(brain3.getNeuron('coding')?.getUnderstandThresholds().maxObservations).toBe(20)
		await brain3.dispose()
	})

	it('user-provided schemas survive create→restore', async () => {
		const scenario = factory()
		const { model } = createQueuedJsonModel(initResponses())
		const customObservation = { type: 'string', minLength: 1, maxLength: 200 }
		const customUnderstanding = { type: 'string', minLength: 1, maxLength: 4000 }

		const brain1 = await Brain.create({
			prompt: 'Track coding patterns and preferences.',
			model,
			autoSetup: false,
			store: scenario.openStore(),
			neurons: [
				{
					id: 'coding',
					type: 'text' as const,
					name: 'Coding',
					description: 'Tracks coding patterns',
					instructions: 'Track coding patterns and preferences.',
					observationSchema: customObservation,
					understandingSchema: customUnderstanding,
				},
			],
			internalNeurons: {
				globalUnderstanding: false,
				globalQueryUnderstanding: false,
				injectionGaps: false,
				queryGaps: false,
			},
			evolution: { enabled: false },
		})
		expect(brain1.getNeuron('coding')?.getObservationSchema()).toEqual(customObservation)
		expect(brain1.getNeuron('coding')?.getUnderstandingSchema()).toEqual(customUnderstanding)
		await brain1.dispose()

		const brain2 = await Brain.restore(scenario.openStore())
		expect(brain2.getNeuron('coding')?.getObservationSchema()).toEqual(customObservation)
		expect(brain2.getNeuron('coding')?.getUnderstandingSchema()).toEqual(customUnderstanding)
		await brain2.dispose()
	})
})
