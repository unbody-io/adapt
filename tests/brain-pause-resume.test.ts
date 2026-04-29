import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3GenerateResult,
} from '@ai-sdk/provider'
import { Brain, MemoryBrainStore, MemoryNeuronStore } from '../src'

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

const initResponses = [
	// neuron 'coding' init: observe + understand identity
	{ identity: 'Track coding patterns.', domain: 'coding' },
	{ identity: 'Synthesize coding learnings.', skills: [], dynamicsSkills: [] },
	// brain prompt decomposition
	{ purpose: 'Track coding.', evolutionGuidance: null, synthesisDirective: null },
]

function createNeuronStoreFactory() {
	const stores = new Map<string, MemoryNeuronStore>()
	return (id: string) => {
		let s = stores.get(id)
		if (!s) {
			s = new MemoryNeuronStore()
			stores.set(id, s)
		}
		return s
	}
}

function makeBrain(
	brainStore: MemoryBrainStore,
	model: LanguageModel,
	neuronStore?: ReturnType<typeof createNeuronStoreFactory>,
) {
	return new Brain({
		prompt: 'Track coding.',
		model,
		autoSetup: false,
		store: brainStore,
		neurons: [
			{
				id: 'coding',
				type: 'text',
				name: 'Coding',
				description: 'Tracks coding patterns',
				instructions: 'Track coding.',
			},
		],
		learning: { store: neuronStore ?? createNeuronStoreFactory() },
		internalNeurons: {
			globalUnderstanding: false,
			globalQueryUnderstanding: false,
			injectionGaps: false,
			queryGaps: false,
		},
		evolution: { enabled: false },
	})
}

describe('Brain neuron pause/resume (issue #11)', () => {
	it('defaults to active status, exposes via getNeuronStatus', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brain = makeBrain(new MemoryBrainStore(), model)
		await brain.initialize()

		expect(brain.getNeuronStatus('coding')).toBe('active')
		expect(brain.getNeuronStatus('does-not-exist')).toBeUndefined()
	})

	it('pauseNeuron flips status to inactive, persists, emits event', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brainStore = new MemoryBrainStore()
		const brain = makeBrain(brainStore, model)
		await brain.initialize()

		const events: Array<{
			neuronId: string
			previousStatus: string
			newStatus: string
		}> = []
		brain.on('brain:neuron:status:changed', (payload) => {
			events.push(payload)
		})

		await brain.pauseNeuron('coding')

		expect(brain.getNeuronStatus('coding')).toBe('inactive')
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({
			neuronId: 'coding',
			previousStatus: 'active',
			newStatus: 'inactive',
		})

		const stored = await brainStore.neurons.get('coding')
		expect(stored?.status).toBe('inactive')
	})

	it('resumeNeuron flips back to active', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brain = makeBrain(new MemoryBrainStore(), model)
		await brain.initialize()

		await brain.pauseNeuron('coding')
		await brain.resumeNeuron('coding')
		expect(brain.getNeuronStatus('coding')).toBe('active')
	})

	it('no-ops and does not emit when status is already the target', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brain = makeBrain(new MemoryBrainStore(), model)
		await brain.initialize()

		const events: unknown[] = []
		brain.on('brain:neuron:status:changed', (p) => events.push(p))

		await brain.resumeNeuron('coding') // already active
		expect(events).toEqual([])

		await brain.pauseNeuron('coding')
		await brain.pauseNeuron('coding') // already inactive
		expect(events).toHaveLength(1)
	})

	it('inject() skips inactive neurons (no learn() call)', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brain = makeBrain(new MemoryBrainStore(), model)
		await brain.initialize()

		const neuron = brain.getNeuron('coding')!
		const learnSpy = { count: 0 }
		const original = neuron.learn.bind(neuron)
		neuron.learn = async (...args: Parameters<typeof original>) => {
			learnSpy.count++
			return original(...args)
		}

		await brain.pauseNeuron('coding')
		const result = await brain.inject(['some data'])

		expect(learnSpy.count).toBe(0)
		expect(result.batches[0]?.results).toEqual([])
	})

	it('paused status round-trips through process restart', async () => {
		const neuronStore = createNeuronStoreFactory()
		const { model: model1 } = createQueuedJsonModel(initResponses)
		const brainStore = new MemoryBrainStore()
		const brain1 = makeBrain(brainStore, model1, neuronStore)
		await brain1.initialize()
		await brain1.pauseNeuron('coding')

		// Restart: new Brain instance, same brain + neuron stores
		const { model: model2 } = createQueuedJsonModel([])
		const brain2 = makeBrain(brainStore, model2, neuronStore)
		await brain2.initialize()

		expect(brain2.getNeuronStatus('coding')).toBe('inactive')
	})

	it('pauseNeuron throws when given an unknown neuron id', async () => {
		const { model } = createQueuedJsonModel(initResponses)
		const brain = makeBrain(new MemoryBrainStore(), model)
		await brain.initialize()

		await expect(brain.pauseNeuron('nope')).rejects.toThrow(/Unknown neuron/)
	})
})
