/**
 * User prompt template for text understand phase
 */

export function understandUserPromptTemplate(
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
