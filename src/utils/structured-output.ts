import { generateText, Output, NoObjectGeneratedError } from 'ai'
import type { LanguageModel } from 'ai'
import type { ZodSchema } from 'zod'

/**
 * Strip markdown code blocks from text
 */
function stripMarkdownCodeBlock(text: string): string {
	// Remove ```json or ``` at start and ``` at end
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
	// Find the first valid JSON object start
	// Look for `{` that's followed by a valid JSON key pattern (optional whitespace + `"`)
	const jsonStartPattern = /\{\s*"/
	const match = text.match(jsonStartPattern)

	if (match && match.index !== undefined) {
		// Return from the first valid `{`
		return text.slice(match.index)
	}

	// Fallback: just find first `{` and hope for the best
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
	// Pattern: `{` followed by whitespace/newlines, then another `{`
	// Keep only the inner object
	const doubleBracePattern = /^\{\s*\{/
	if (doubleBracePattern.test(text)) {
		// Find the second `{` and start from there
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

interface StructuredOutputResult<T> {
	output: T
	usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
	reasoning?: Array<{ type: string; text: string }>
}

/**
 * Options passed through to generateText
 */
export interface GenerateOptions {
	model?: LanguageModel
	temperature?: number
	maxOutputTokens?: number
	topP?: number
	topK?: number
	presencePenalty?: number
	frequencyPenalty?: number
	seed?: number
}

/**
 * Generate structured output from LLM with JSON repair fallback
 */
export async function generateStructuredOutput<T>(params: {
	model: LanguageModel
	prompt: string
	schema: ZodSchema<T>
	system?: string
} & Omit<GenerateOptions, 'model'>): Promise<StructuredOutputResult<T>> {
	const { model, prompt, schema, system, temperature, maxOutputTokens, topP, topK, presencePenalty, frequencyPenalty, seed } = params

	try {
		const result = await generateText({
			model,
			prompt,
			system,
			output: Output.object({ schema }),
			temperature,
			maxOutputTokens,
			topP,
			topK,
			presencePenalty,
			frequencyPenalty,
			seed,
		})

		return { output: result.output as T, usage: result.usage, reasoning: result.reasoning }
	} catch (error) {
		// Log full error details for debugging
		console.error('[LLM] Error in generateStructuredOutput:')
		console.error('[LLM] Error type:', error?.constructor?.name)
		console.error('[LLM] Error message:', error instanceof Error ? error.message : String(error))
		if (error instanceof Error && error.cause) {
			console.error('[LLM] Error cause:', error.cause)
		}
		// Log full error object for provider errors
		if (error && typeof error === 'object' && 'data' in error) {
			console.error('[LLM] Error data:', JSON.stringify((error as { data: unknown }).data, null, 2))
		}

		// Try to repair malformed JSON from LLM
		if (error instanceof NoObjectGeneratedError && error.text) {
			console.error('[LLM] Raw output that failed to parse:')
			console.error('---RAW START---')
			console.error(error.text)
			console.error('---RAW END---')

			// Apply repair pipeline: strip markdown → strip garbage prefix → fix double brace → repair newlines
			let repaired = stripMarkdownCodeBlock(error.text)
			repaired = stripGarbagePrefix(repaired)
			repaired = fixDoubleBrace(repaired)
			repaired = repairJsonNewlines(repaired)

			try {
				const parsed = schema.parse(JSON.parse(repaired))
				console.log('[LLM] Repair successful')
				return { output: parsed, usage: undefined }
			} catch (repairError) {
				console.error('[LLM] Repair failed:', repairError)
				console.error('[LLM] After repair attempt:')
				console.error(repaired.slice(0, 500))
			}
		}

		// Re-throw with more context
		const errorMessage = error instanceof Error ? error.message : String(error)
		const enhancedError = new Error(`LLM call failed: ${errorMessage}`)
		enhancedError.cause = error
		throw enhancedError
	}
}
