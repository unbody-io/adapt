import { generateText, NoObjectGeneratedError } from 'ai'
import type { ZodSchema } from 'zod'

/**
 * Thin wrapper over ai-sdk's generateText
 *
 * - 100% mirrors ai-sdk API (same params, same return type)
 * - Adds JSON repair fallback for structured output failures
 */

// Mirror ai-sdk types exactly
type GenerateTextParams = Parameters<typeof generateText>[0]
type GenerateTextResult = Awaited<ReturnType<typeof generateText>>

// Re-export for convenience
export { Output, stepCountIs } from 'ai'
export type { LanguageModelUsage, LanguageModel, CallSettings, StopCondition } from 'ai'

/**
 * Generate text with optional structured output and JSON repair
 *
 * @example
 * // Simple text generation
 * const result = await generate({ model, prompt: 'Hello' })
 *
 * @example
 * // Structured output
 * const result = await generate({
 *   model,
 *   prompt: 'Extract data',
 *   output: Output.object({ schema: mySchema })
 * })
 *
 * @example
 * // Multi-step tool loop
 * const result = await generate({
 *   model,
 *   prompt: 'Do task',
 *   tools: { ... },
 *   stopWhen: stepCountIs(10),
 *   onStepFinish: ({ usage }) => { ... }
 * })
 */
export async function generate(params: GenerateTextParams): Promise<GenerateTextResult> {
	try {
		return await generateText(params)
	} catch (error) {
		// JSON repair fallback for structured output
		if (error instanceof NoObjectGeneratedError && error.text && params.output) {
			const repaired = repairJson(error.text)

			try {
				// Extract schema from output config and validate
				const schema = extractSchema(params.output)
				if (schema) {
					const parsed = JSON.parse(repaired)
					const validated = schema.parse(parsed)

					// Return a minimal result with repaired output
					// Note: usage is lost when repair succeeds
					return {
						output: validated,
						text: '',
						reasoning: [],
						reasoningDetails: [],
						reasoningText: undefined,
						files: [],
						sources: [],
						toolCalls: [],
						toolResults: [],
						staticToolCalls: [],
						staticToolResults: [],
						dynamicToolCalls: [],
						dynamicToolResults: [],
						content: [],
						finishReason: 'stop',
						usage: {
							inputTokens: 0,
							outputTokens: 0,
							totalTokens: 0,
							inputTokenDetails: { cachedTokens: undefined },
							outputTokenDetails: { reasoningTokens: undefined },
						},
						steps: [],
						response: {
							id: '',
							timestamp: new Date(),
							modelId: '',
							headers: undefined,
							messages: [],
						},
						request: {},
						warnings: [],
						providerMetadata: undefined,
					} as unknown as GenerateTextResult
				}
			} catch {
				// Repair failed, fall through to throw original error
			}
		}

		throw error
	}
}

/**
 * Extract Zod schema from Output config
 */
function extractSchema(output: unknown): ZodSchema | null {
	if (output && typeof output === 'object' && 'schema' in output) {
		return (output as { schema: ZodSchema }).schema
	}
	return null
}

// ============================================================================
// JSON Repair Pipeline
// ============================================================================

/**
 * Repair malformed JSON from LLM output
 */
function repairJson(text: string): string {
	let repaired = text
	repaired = stripMarkdownCodeBlock(repaired)
	repaired = stripGarbagePrefix(repaired)
	repaired = fixDoubleBrace(repaired)
	repaired = repairJsonNewlines(repaired)
	return repaired
}

/**
 * Strip markdown code blocks from text
 */
function stripMarkdownCodeBlock(text: string): string {
	return text
		.replace(/^```(?:json)?\s*\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim()
}

/**
 * Strip garbage prefix characters before JSON
 * Handles cases like: `.{`, `craft.{`, `).{`, `{\n{`
 */
function stripGarbagePrefix(text: string): string {
	const jsonStartPattern = /\{\s*"/
	const match = text.match(jsonStartPattern)

	if (match && match.index !== undefined) {
		return text.slice(match.index)
	}

	const firstBrace = text.indexOf('{')
	if (firstBrace > 0) {
		return text.slice(firstBrace)
	}

	return text
}

/**
 * Fix double opening braces like `{\n{...}`
 */
function fixDoubleBrace(text: string): string {
	const doubleBracePattern = /^\{\s*\{/
	if (doubleBracePattern.test(text)) {
		const secondBrace = text.indexOf('{', 1)
		if (secondBrace !== -1) {
			return text.slice(secondBrace)
		}
	}
	return text
}

/**
 * Repair malformed JSON by escaping unescaped newlines in string values
 */
function repairJsonNewlines(text: string): string {
	let result = ''
	let inString = false
	let escaped = false

	for (let i = 0; i < text.length; i++) {
		const char = text[i]

		if (escaped) {
			result += char
			escaped = false
			continue
		}

		if (char === '\\') {
			result += char
			escaped = true
			continue
		}

		if (char === '"') {
			inString = !inString
			result += char
			continue
		}

		if (inString && char === '\n') {
			result += '\\n'
			continue
		}

		if (inString && char === '\r') {
			continue
		}

		result += char
	}

	return result
}
