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

export type {
	CallSettings,
	LanguageModel,
	LanguageModelUsage,
	StopCondition,
} from 'ai'
// Re-export for convenience
export { Output, stepCountIs, hasToolCall } from 'ai'

/**
 * Extended params that accept a repair schema
 */
type GenerateParams = GenerateTextParams & {
	/** Zod schema for JSON repair fallback (Output.object doesn't expose it) */
	repairSchema?: ZodSchema
}

/**
 * Generate text with optional structured output and JSON repair
 *
 * @example
 * // Simple text generation
 * const result = await generate({ model, prompt: 'Hello' })
 *
 * @example
 * // Structured output with repair
 * const result = await generate({
 *   model,
 *   prompt: 'Extract data',
 *   output: Output.object({ schema: mySchema }),
 *   repairSchema: mySchema
 * })
 */
export async function generate(
	params: GenerateParams,
): Promise<GenerateTextResult> {
	const { repairSchema, ...generateParams } = params
	try {
		return await generateText(generateParams)
	} catch (error) {
		// JSON repair fallback for structured output
		if (
			error instanceof NoObjectGeneratedError &&
			error.text &&
			repairSchema
		) {
			console.error('[LLM] NoObjectGeneratedError — raw text (%d chars):', error.text.length, error.text.slice(0, 500))
			const repaired = repairJson(error.text)

			try {
				const parsed = JSON.parse(repaired)
				const validated = repairSchema.parse(parsed)

				// Return a minimal result with repaired output
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
			} catch (repairError) {
				console.error('[LLM] JSON repair failed:', repairError instanceof Error ? repairError.message : repairError)
				// Fall through to throw original error
			}
		}

		throw error
	}
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
	repaired = fixQuotedObjectPrefix(repaired)
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
	// Look for { followed by a real JSON key (starts with a letter/underscore)
	const jsonStartPattern = /\{\s*"[a-zA-Z_]/
	const match = text.match(jsonStartPattern)

	if (match && match.index !== undefined) {
		return text.slice(match.index)
	}

	// Fallback: any { followed by "
	const loosePattern = /\{\s*"/
	const looseMatch = text.match(loosePattern)
	if (looseMatch && looseMatch.index !== undefined) {
		return text.slice(looseMatch.index)
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
 * Fix pattern like: { "{ "key": value -> {"key": value
 * The model sometimes outputs the JSON object wrapped in an extra brace+quote
 */
function fixQuotedObjectPrefix(text: string): string {
	// Pattern: { "{ "realKey" -> {"realKey"
	const brokenPrefix = /^\{\s*"\{\s*"/
	if (brokenPrefix.test(text)) {
		return text.replace(brokenPrefix, '{"')
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
