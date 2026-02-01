import type { LanguageModel } from 'ai'
import type { QueryMethod, QueryMethodName } from './types'
import { ToolBasedMethod } from './tool-based'
import { DirectMethod } from './direct'

export { ToolBasedMethod } from './tool-based'
export { DirectMethod } from './direct'
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
