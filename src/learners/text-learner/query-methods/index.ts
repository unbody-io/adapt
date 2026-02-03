import type { LanguageModel } from 'ai'
import { DirectMethod } from './direct'
import { ToolBasedMethod } from './tool-based'
import type { QueryMethod, QueryMethodName } from './types'

export { DirectMethod } from './direct'
export { ToolBasedMethod } from './tool-based'
export * from './types'

/**
 * Create a query method by name
 *
 * @param name - The query method to create
 * @param model - The language model to use
 * @returns The configured query method
 */
export function createQueryMethod(
	name: QueryMethodName,
	model: LanguageModel,
): QueryMethod {
	switch (name) {
		case 'tool-based':
			return new ToolBasedMethod(model)
		case 'direct':
			return new DirectMethod(model)
		default:
			throw new Error(`Unknown query method: ${name}`)
	}
}
