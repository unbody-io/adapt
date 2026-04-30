import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3GenerateResult,
} from '@ai-sdk/provider'
import { Brain } from '../src/brain'
import { MemoryBrainStore } from '../src/stores'

function createQueuedJsonModel(responses: unknown[]) {
	let callCount = 0

	const usage: LanguageModelV3GenerateResult['usage'] = {
		inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 0, text: 0, reasoning: 0 },
	}

	const model: LanguageModelV3 = {
		specificationVersion: 'v3',
		provider: 'test',
		modelId: 'queued-json-model',
		supportedUrls: {},
		async doGenerate(_options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
			if (callCount >= responses.length) {
				throw new Error(`No queued mock response for generate call ${callCount + 1}`)
			}

			const response = responses[callCount++]
			return {
				content: [{ type: 'text', text: JSON.stringify(response) }],
				finishReason: { unified: 'stop', raw: 'stop' },
				usage,
				warnings: [],
				request: {},
				response: {
					id: `response-${callCount}`,
					timestamp: new Date(),
					modelId: 'queued-json-model',
				},
			}
		},
		async doStream(): Promise<never> {
			throw new Error('doStream not implemented in queued test model')
		},
	}

	return { model: model as unknown as LanguageModel, getCallCount: () => callCount }
}

describe('Brain init recovery from partial state (issue #6)', () => {
	it('clears orphan neuron rows from a previously-failed init', async () => {
		const brainStore = new MemoryBrainStore()

		await brainStore.neurons.add({ id: 'coding', type: 'text' })
		await brainStore.neurons.add({ id: 'leftover', type: 'text' })
		await brainStore.internalNeurons.add({ id: 'leftover-internal', type: 'text' })

		const { model } = createQueuedJsonModel([
			{
				identity: 'You observe coding notes.',
				domain: 'coding',
			},
			{
				identity: 'You synthesize coding preferences.',
				skills: [],
				dynamicsSkills: [],
			},
			{
				purpose: 'Track coding preferences.',
				evolutionGuidance: null,
				synthesisDirective: null,
			},
		])

		const brain = await Brain.create({
			prompt: 'Track coding patterns and preferences.',
			model,
			autoSetup: false,
			store: brainStore,
			neurons: [
				{
					id: 'coding',
					type: 'text',
					name: 'Coding',
					description: 'Tracks coding patterns',
					instructions: 'Track coding patterns and preferences.',
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

		expect(brain).toBeDefined()

		const neurons = await brainStore.neurons.list()
		expect(neurons).toHaveLength(1)
		expect(neurons[0]?.id).toBe('coding')

		const internal = await brainStore.internalNeurons.list()
		expect(internal).toHaveLength(0)
	})
})
