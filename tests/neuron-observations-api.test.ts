import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { TextNeuron, MemoryNeuronStore } from '../src'
import type { ObservationRecord } from '../src/stores'

function unusedModel(): LanguageModel {
	const model: LanguageModelV3 = {
		specificationVersion: 'v3',
		provider: 'test',
		modelId: 'unused',
		supportedUrls: {},
		async doGenerate() {
			throw new Error('model should not be called by observation API tests')
		},
		async doStream() {
			throw new Error('model should not be called by observation API tests')
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
	function makeNeuron() {
		return new TextNeuron({
			id: 'test',
			name: 'Test',
			description: 'Test neuron',
			instructions: 'Track test data.',
			model: unusedModel(),
			store: new MemoryNeuronStore(),
		})
	}

	it('getObservations returns all records when no filter is given', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('a', 'pending', 'one'))
		await neuron.store.observations.add(makeObservation('b', 'processed', 'two'))

		const all = await neuron.getObservations()
		expect(all).toHaveLength(2)
		expect(all.map((o) => o.id).sort()).toEqual(['a', 'b'])
	})

	it('getObservations filters by status', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('a', 'pending', 'one'))
		await neuron.store.observations.add(makeObservation('b', 'processed', 'two'))
		await neuron.store.observations.add(makeObservation('c', 'pending', 'three'))

		const pending = await neuron.getObservations({ status: 'pending' })
		expect(pending.map((o) => o.id).sort()).toEqual(['a', 'c'])

		const processed = await neuron.getObservations({ status: 'processed' })
		expect(processed.map((o) => o.id)).toEqual(['b'])
	})

	it('setObservations replaces the entire collection', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('old-1', 'pending', 'old'))
		await neuron.store.observations.add(makeObservation('old-2', 'processed', 'older'))

		await neuron.setObservations([
			makeObservation('new-1', 'pending', 'fresh'),
			makeObservation('new-2', 'pending', 'fresher'),
		])

		const all = await neuron.getObservations()
		expect(all.map((o) => o.id).sort()).toEqual(['new-1', 'new-2'])
	})

	it('setObservations with empty array clears the collection', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('a', 'pending', 'one'))

		await neuron.setObservations([])

		const all = await neuron.getObservations()
		expect(all).toEqual([])
	})

	it('updateObservation patches a single record', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('a', 'pending', 'before'))

		await neuron.updateObservation('a', { data: 'after', metadata_importance: 0.9 })

		const updated = await neuron.store.observations.get('a')
		expect(updated?.data).toBe('after')
		expect(updated?.metadata_importance).toBe(0.9)
		expect(updated?.metadata_status).toBe('pending')
	})

	it('removeObservation deletes a record by id', async () => {
		const neuron = makeNeuron()
		await neuron.store.observations.add(makeObservation('a', 'pending', 'one'))
		await neuron.store.observations.add(makeObservation('b', 'pending', 'two'))

		await neuron.removeObservation('a')

		const remaining = await neuron.getObservations()
		expect(remaining.map((o) => o.id)).toEqual(['b'])
	})
})
