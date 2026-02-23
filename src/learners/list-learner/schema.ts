/**
 * Schema generation for ListLearner
 *
 * Generates JSON Schema objects via LLM that describe the structure
 * of observation and understanding data for this learner's domain.
 */

import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { generate, Output } from '../../llm'

// ── Output schema for LLM response ──────────────────────────────────────────

const jsonSchemaOutputSchema = z.object({
	schema: z
		.record(z.string(), z.unknown())
		.describe('A valid JSON Schema object describing the data structure'),
})

// ── Prompts ─────────────────────────────────────────────────────────────────

function observationSchemaPrompt(instructions: string, identity: string): string {
	return `You are generating a JSON Schema that defines the structure of a single observation item.

The agent's purpose:
"${instructions}"

The observer's identity:
"${identity}"

Generate a JSON Schema object that describes what a single observed item looks like.
The schema should capture the key fields that would be extracted from raw data for this domain.

Requirements:
- Must be a valid JSON Schema with "type": "object"
- Include "properties" with appropriate types (string, number, boolean, array, etc.)
- Use "enum" where the values are a known fixed set
- Include "required" for essential fields
- Add "description" to each property
- Keep it focused — only fields relevant to the agent's purpose
- Do NOT include metadata fields (id, timestamp, confidence) — only domain data

Example for a food-tracking agent:
{
  "type": "object",
  "properties": {
    "item": { "type": "string", "description": "Name of the food item" },
    "meal": { "type": "string", "enum": ["breakfast", "lunch", "dinner", "snack"] },
    "calories": { "type": "number", "description": "Estimated calories" }
  },
  "required": ["item", "meal"]
}

Respond with JSON only: { "schema": { ... } }`
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

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateObservationSchema(
	model: LanguageModel,
	instructions: string,
	identity: string,
): Promise<Record<string, unknown>> {
	const { output } = await generate({
		model,
		prompt: observationSchemaPrompt(instructions, identity),
		output: Output.object({ schema: jsonSchemaOutputSchema }),
		repairSchema: jsonSchemaOutputSchema,
	})
	return output.schema
}

export async function generateUnderstandingSchema(
	model: LanguageModel,
	instructions: string,
	identity: string,
): Promise<Record<string, unknown>> {
	const { output } = await generate({
		model,
		prompt: understandingSchemaPrompt(instructions, identity),
		output: Output.object({ schema: jsonSchemaOutputSchema }),
		repairSchema: jsonSchemaOutputSchema,
	})
	return output.schema
}
