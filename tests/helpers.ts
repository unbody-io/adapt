/**
 * Shared test utilities
 */

import type { LanguageModel } from 'ai'

/**
 * Create a fake LanguageModel for tests that only need config resolution
 * (no actual LLM calls). Satisfies the LanguageModel interface structurally.
 */
export function mockModel(
	provider = 'test-provider',
	modelId = 'test-model',
): LanguageModel {
	return {
		provider,
		modelId,
		specificationVersion: 'v1',
		defaultObjectGenerationMode: 'json',
		supportsStructuredOutputs: true,
		doGenerate: async () => {
			throw new Error('mockModel: doGenerate not implemented')
		},
		doStream: async () => {
			throw new Error('mockModel: doStream not implemented')
		},
	} as unknown as LanguageModel
}
