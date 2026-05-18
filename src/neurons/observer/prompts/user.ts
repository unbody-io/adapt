/**
 * User prompt template for observe phase (shared across all neuron types)
 *
 * Provides data for observation. Used on each observe call.
 */

/**
 * User prompt template for observe
 *
 * @param data - Data to observe
 */
export function observeUserPromptTemplate(data: unknown[]): string {
	return `## Data to Observe

${JSON.stringify(data, null, 2)}

Review each item against the operator's instructions. What should be kept as relevant evidence?`
}
