/**
 * User prompt template for synthesize phase
 *
 * Provides current understanding and buffered observations.
 * Used on each synthesize call.
 */

/**
 * User prompt template for synthesize
 *
 * @param currentUnderstanding - Current understanding (empty string if none)
 * @param observations - Buffered observations to synthesize
 */
export function synthesizeUserPromptTemplate(
	currentUnderstanding: string,
	observations: string[],
): string {
	const understandingSection =
		currentUnderstanding ||
		'(No understanding yet. This is your first synthesis.)'

	const observationsSection = observations.join('\n\n---\n\n')

	return `## Current Understanding

${understandingSection}

## Observations to Integrate

${observationsSection}

Integrate these observations into your understanding.`
}
