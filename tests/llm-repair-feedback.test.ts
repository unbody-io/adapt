import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	type AdaptLLMPlugin,
	type AdaptModelConfig,
	type AdaptModelStreamEvent,
	type AdaptRepairAttempt,
	type AdaptStreamResult,
	generate,
	Output,
	streamText,
} from '../src/llm'

const model = {
	plugin: 'test',
	id: 'test-model',
} satisfies AdaptModelConfig<'test'>

const schema = z.object({
	answer: z.string(),
})

function createPlugin(text: string): AdaptLLMPlugin {
	return {
		id: 'test',
		model: {
			toConfig: () => model,
		},
		async call() {
			return {
				text,
				json: undefined,
				toolCalls: [],
				finishReason: 'error',
			}
		},
	}
}

function createStreamingPlugin(text: string): AdaptLLMPlugin {
	return {
		...createPlugin(text),
		async streamCall(): Promise<AdaptStreamResult> {
			async function* textStream(): AsyncIterable<string> {
				yield text
			}
			async function* fullStream(): AsyncIterable<AdaptModelStreamEvent> {}

			return {
				textStream: textStream(),
				fullStream: fullStream(),
				text: Promise.resolve(text),
				usage: Promise.resolve({}),
				toolCalls: Promise.resolve([]),
				steps: Promise.resolve([]),
			}
		},
	}
}

describe('structured-output repairWithFeedback', () => {
	it('does not retry by default after repair + schema validation fails', async () => {
		await expect(
			generate({
				llm: createPlugin('{'),
				model,
				prompt: 'answer',
				output: Output.object({ schema }),
			}),
		).rejects.toThrow()
	})

	it('retries with validation feedback when opted in', async () => {
		const attempts: AdaptRepairAttempt[] = []

		const result = await generate({
			llm: createPlugin('{'),
			model,
			prompt: 'answer',
			output: Output.object({ schema }),
			repairWithFeedback: async (attempt) => {
				attempts.push(attempt)
				return '{"answer":"ok"}'
			},
		})

		expect(result.output).toEqual({ answer: 'ok' })
		expect(attempts).toHaveLength(1)
		expect(attempts[0].text).toBe('{')
		expect(attempts[0].attempt).toBe(1)
		expect(attempts[0].model).toEqual(model)
	})

	it('applies feedback repair to finalized stream output', async () => {
		const stream = await streamText({
			llm: createStreamingPlugin('{'),
			model,
			prompt: 'answer',
			output: Output.object({ schema }),
			repairWithFeedback: async () => '{"answer":"stream-ok"}',
		})

		await expect(stream.output).resolves.toEqual({ answer: 'stream-ok' })
	})

	it('caps feedback repair attempts at three', async () => {
		let attempts = 0

		await expect(
			generate({
				llm: createPlugin('{'),
				model,
				prompt: 'answer',
				output: Output.object({ schema }),
				maxRepairAttempts: 10,
				repairWithFeedback: async () => {
					attempts++
					return '{}'
				},
			}),
		).rejects.toThrow()

		expect(attempts).toBe(3)
	})
})
