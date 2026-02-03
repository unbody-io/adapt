/**
 * Cascade utility for config resolution
 *
 * Returns the first defined value from a cascade chain.
 * Used for model inheritance where child configs can override parent values.
 */

/**
 * Returns the first defined value from the cascade chain
 *
 * @throws Error if no value is found
 *
 * @example
 * const model = cascade(
 *   config.observe?.model,    // specific override
 *   config.model,             // component default
 *   parentModels.model,       // parent value
 * )
 */
export function cascade<T>(...values: (T | undefined)[]): T {
	const result = values.find((v) => v !== undefined)
	if (result === undefined) {
		throw new Error('No value found in cascade chain')
	}
	return result
}

/**
 * Returns the first defined value, or undefined if none found
 *
 * Use when the value is truly optional.
 *
 * @example
 * const model = cascadeOptional(
 *   config.observe?.model,
 *   config.model,
 * )
 */
export function cascadeOptional<T>(
	...values: (T | undefined)[]
): T | undefined {
	return values.find((v) => v !== undefined)
}
