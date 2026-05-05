/**
 * Schema generation for ListNeuron
 *
 * Generates JSON Schema objects via LLM that describe the structure
 * of observation and understanding data for this neuron's domain.
 *
 * Uses plain text generation (not structured output) because the thing
 * we're asking the model to produce — a JSON Schema with arbitrary
 * properties — can't be described ahead of time in a Zod schema.
 */

import { z } from 'zod'
import { type AdaptLLMPlugin, generate, type LanguageModel } from '../../llm'

// ── Validation schema for parsing LLM text output ────────────────────────────

const jsonSchemaOutputSchema = z.object({
	schema: z
		.record(z.string(), z.unknown())
		.describe('A valid JSON Schema object describing the data structure'),
})

// ── Prompts ─────────────────────────────────────────────────────────────────

function observationSchemaPrompt(instructions: string, identity: string): string {
	return `You are designing a data schema for an observation agent. This is a schema DESIGN task — reason about what structure best captures this domain before producing the schema.

The agent's purpose:
"${instructions}"

The observer's identity:
"${identity}"

STEP 1: Think about the domain. Ask yourself:
- What kind of information will appear in raw text about this topic?
- What field uniquely identifies each item? (a name? a title? a combination?)
- Are there natural categories or types? (use enums — always include "other" as a catch-all)
- Are there numeric values with known ranges? (ratings, prices, quantities)
- Are there boolean flags? (is_open, is_verified, etc.)
- What information will realistically be extractable from conversational text? (don't include fields like phone numbers, URLs, or coordinates unless the instructions specifically mention them)
- What's always present vs sometimes mentioned?

STEP 2: Produce a JSON Schema based on your reasoning.

This schema guides EXTRACTION from unpredictable raw text. Be flexible — the observer doesn't control what comes in.

Schema rules:
- "type" must be "object"
- FLAT structure only — no nested objects. Every property must be a primitive (string, number, boolean) or an array of primitives.
- Mark 1-3 core identifying fields as "required" — the fields that define what this item IS. Everything else optional.
- No metadata fields (id, timestamp, confidence) — domain data only.
- Only include fields that are relevant to the agent's purpose and realistically extractable.

Constraint guidelines — only use constraints that affect SEMANTICS, not formatting:
- "description": always — explain what the field captures
- "enum": for known categories (always include "other" as catch-all)
- "default": when a sensible default exists
- "minimum" / "maximum": for bounded numbers (e.g., ratings 0-5)
- Do NOT use "pattern" or "format" — they reject valid data that's just formatted differently
- Do NOT use "minLength" / "maxLength" — the observer should extract whatever it finds

Respond with your reasoning first, then the JSON schema in this exact format:
{ "schema": { "type": "object", "properties": { ... }, "required": [ ... ] } }`
}

function understandingSchemaPrompt(instructions: string, identity: string): string {
	return `You are generating a JSON Schema that defines the structure of a curated collection item.

The agent's purpose:
"${instructions}"

The synthesizer's identity:
"${identity}"

Generate a JSON Schema object that describes what a single item in the curated collection looks like.
This is the final, deduplicated, structured representation — not raw observations.

Requirements:
- Must be a valid JSON Schema with "type": "object"
- Include "properties" with appropriate types
- Use "enum" where the values are a known fixed set
- Include "required" for essential fields
- Add "description" to each property
- Should be similar to the observation schema but may include additional derived/computed fields
- Do NOT include metadata fields (id, confidence, signals, timestamps) — only domain data

Respond with JSON only: { "schema": { ... } }`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractJson(text: string): string {
	// Strip markdown code fences
	let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
	// Find first { to last }
	const start = cleaned.indexOf('{')
	const end = cleaned.lastIndexOf('}')
	if (start !== -1 && end > start) {
		cleaned = cleaned.slice(start, end + 1)
	}
	// Replace JS expressions like Math.pow(2, 31) with their numeric value
	cleaned = cleaned.replace(/Math\.pow\(([^)]+)\)/g, (_match, args) => {
		const parts = args.split(',').map((s: string) => Number(s.trim()))
		return parts.length === 2 && parts.every(Number.isFinite)
			? String(Math.pow(parts[0], parts[1]))
			: '0'
	})
	// Replace Number.MAX_SAFE_INTEGER and similar constants
	cleaned = cleaned.replace(/Number\.MAX_SAFE_INTEGER/g, String(Number.MAX_SAFE_INTEGER))
	cleaned = cleaned.replace(/Number\.MIN_SAFE_INTEGER/g, String(Number.MIN_SAFE_INTEGER))
	return cleaned
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateObservationSchema(
	llm: AdaptLLMPlugin,
	model: LanguageModel,
	instructions: string,
	identity: string,
): Promise<Record<string, unknown>> {
	const result = await generate({
		llm,
		model,
		prompt: observationSchemaPrompt(instructions, identity),
	})
	const parsed = jsonSchemaOutputSchema.parse(JSON.parse(extractJson(result.text)))
	return parsed.schema
}

export async function generateUnderstandingSchema(
	llm: AdaptLLMPlugin,
	model: LanguageModel,
	instructions: string,
	identity: string,
): Promise<Record<string, unknown>> {
	const result = await generate({
		llm,
		model,
		prompt: understandingSchemaPrompt(instructions, identity),
	})
	const parsed = jsonSchemaOutputSchema.parse(JSON.parse(extractJson(result.text)))
	return parsed.schema
}
