/**
 * Isolated eval: Schema generation for ListLearner
 *
 * Tests generateObservationSchema and generateUnderstandingSchema directly.
 * No learner, no store, no pipeline — just the LLM call and what comes back.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObservationSchema, generateUnderstandingSchema } from '../../src/learners/list-learner/schema'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

async function main() {
	console.log(`Schema Generation Eval`)
	console.log(`Model: ${MODEL}\n`)

	const instructions = 'Track restaurants including their name, cuisine type, location, and any notable details like ratings or hours.'
	const observeIdentity = 'You observe restaurant-related information from user input.'
	const understandIdentity = 'You maintain a collection of restaurants with their details.'

	// ── Observation Schema ───────────────────────────────────────────────────

	console.log('── Generating observation schema...')
	try {
		const obsSchema = await generateObservationSchema(model, instructions, observeIdentity)
		console.log('Result:', JSON.stringify(obsSchema, null, 2))
		console.log(`type: ${(obsSchema as any).type}`)
		console.log(`properties: ${Object.keys((obsSchema as any).properties || {}).join(', ') || '(none)'}`)
	} catch (err) {
		console.log('FAILED:', err)
	}

	console.log('')

	// ── Understanding Schema ────────────────────────────────────────────────

	console.log('── Generating understanding schema...')
	try {
		const undSchema = await generateUnderstandingSchema(model, instructions, understandIdentity)
		console.log('Result:', JSON.stringify(undSchema, null, 2))
		console.log(`type: ${(undSchema as any).type}`)
		console.log(`properties: ${Object.keys((undSchema as any).properties || {}).join(', ') || '(none)'}`)
	} catch (err) {
		console.log('FAILED:', err)
	}
}

main().catch((err) => {
	console.error('\n[FATAL]', err)
	process.exit(1)
})
