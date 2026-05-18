import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3GenerateResult,
} from '@ai-sdk/provider'
import { TextNeuron, MemoryNeuronStore } from '../src'
import type { ObservationRecord } from '../src/stores'

function initOnlyModel(): LanguageModel {
	const responses = [{ skills: [], dynamicsSkills: [] }]
	let callCount = 0
	const usage: LanguageModelV3GenerateResult['usage'] = {
		inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 0, text: 0, reasoning: 0 },
	}
	const model: LanguageModelV3 = {
		specificationVersion: 'v3',
		provider: 'test',
		modelId: 'init-only',
		supportedUrls: {},
		async doGenerate(_opts: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
			const response = responses[callCount++]
			if (!response) throw new Error(`No queued response for call ${callCount}`)
			return {
				content: [{ type: 'text', text: JSON.stringify(response) }],
				finishReason: { unified: 'stop', raw: 'stop' },
				usage,
				warnings: [],
				request: {},
				response: { id: `r-${callCount}`, timestamp: new Date(), modelId: 'init-only' },
			}
		},
		async doStream() {
			throw new Error('not used')
		},
	}
	return model as unknown as LanguageModel
}

function makeObservation(id: string, status: 'pending' | 'processed', text: string): ObservationRecord {
	return {
		id,
		data: text,
		metadata_importance: 0.5,
		metadata_tokens: 10,
		metadata_status: status,
		metadata_created_at: new Date().toISOString(),
	}
}

describe('Neuron observations API (issue #7)', () => {
	async function makeNeuron() {
		const store = new MemoryNeuronStore()
		const neuron = await TextNeuron.create({
			id: 'test',
			name: 'Test',
			description: 'Test neuron',
			instructions: 'Track test data.',
			model: initOnlyModel(),
			store,
		})
		return { neuron, store }
	}

	it('getObservations returns all records when no filter is given', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('a', 'pending', 'one'))
		await store.observations.add(makeObservation('b', 'processed', 'two'))

		const all = await neuron.getObservations()
		expect(all).toHaveLength(2)
		expect(all.map((o) => o.id).sort()).toEqual(['a', 'b'])
	})

	it('getObservations filters by status', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('a', 'pending', 'one'))
		await store.observations.add(makeObservation('b', 'processed', 'two'))
		await store.observations.add(makeObservation('c', 'pending', 'three'))

		const pending = await neuron.getObservations({ status: 'pending' })
		expect(pending.map((o) => o.id).sort()).toEqual(['a', 'c'])

		const processed = await neuron.getObservations({ status: 'processed' })
		expect(processed.map((o) => o.id)).toEqual(['b'])
	})

	it('setObservations replaces the entire collection', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('old-1', 'pending', 'old'))
		await store.observations.add(makeObservation('old-2', 'processed', 'older'))

		await neuron.setObservations([
			makeObservation('new-1', 'pending', 'fresh'),
			makeObservation('new-2', 'pending', 'fresher'),
		])

		const all = await neuron.getObservations()
		expect(all.map((o) => o.id).sort()).toEqual(['new-1', 'new-2'])
	})

	it('setObservations with empty array clears the collection', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('a', 'pending', 'one'))

		await neuron.setObservations([])

		const all = await neuron.getObservations()
		expect(all).toEqual([])
	})

	it('updateObservation patches a single record', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('a', 'pending', 'before'))

		await neuron.updateObservation('a', { data: 'after', metadata_importance: 0.9 })

		const updated = await store.observations.get('a')
		expect(updated?.data).toBe('after')
		expect(updated?.metadata_importance).toBe(0.9)
		expect(updated?.metadata_status).toBe('pending')
	})

	it('removeObservation deletes a record by id', async () => {
		const { neuron, store } = await makeNeuron()
		await store.observations.add(makeObservation('a', 'pending', 'one'))
		await store.observations.add(makeObservation('b', 'pending', 'two'))

		await neuron.removeObservation('a')

		const remaining = await neuron.getObservations()
		expect(remaining.map((o) => o.id)).toEqual(['b'])
	})
})
