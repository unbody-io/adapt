/**
 * Test identity generation across models
 *
 * Tests both observe and understand identity generation.
 * Run with: MODEL=<model> bun evals/test-identity-gen.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { observeIdentityPromptTemplate } from '../src/learners/observer/prompts/identity'
import { observeIdentitySchema } from '../src/learners/observer/schema.identity'
import { understandIdentityPromptTemplate } from '../src/learners/text-learner/understand/prompts/identity'
import { understandIdentitySchema } from '../src/learners/text-learner/understand/schema.identity'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODELS = [
	'google/gemini-2.0-flash-001',
	'anthropic/claude-sonnet-4',
	'openai/gpt-4o-mini',
]

const TEST_INSTRUCTIONS = [
	'Track coding preferences and style evolution',
	'Understand this therapist\'s philosophy and approach',
]

type IdentityType = 'observe' | 'understand'

async function testIdentity(modelId: string, instructions: string, type: IdentityType) {
	const model = openrouter(modelId)

	const prompt = type === 'observe'
		? observeIdentityPromptTemplate(instructions)
		: understandIdentityPromptTemplate(instructions)

	const schema = type === 'observe'
		? observeIdentitySchema
		: understandIdentitySchema

	try {
		const result = await generateText({
			model,
			prompt,
			output: Output.object({ schema }),
		})

		if (!result.output) {
			return { success: false, error: 'No output generated' }
		}

		return { success: true, output: result.output }
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		const shortMsg = msg.includes('JSON')
			? 'JSON parsing failed'
			: msg.includes('not a valid model')
				? 'Invalid model ID'
				: msg.substring(0, 60)
		return { success: false, error: shortMsg }
	}
}

async function main() {
	const specificModel = process.env.MODEL
	const modelsToTest = specificModel ? [specificModel] : MODELS

	console.log('\n🧪 Identity Generation Test\n')

	for (const modelId of modelsToTest) {
		console.log(`\n═══ ${modelId} ═══\n`)

		for (const instructions of TEST_INSTRUCTIONS) {
			const shortInstr = instructions.substring(0, 35) + '...'

			// Test observe
			process.stdout.write(`  [observe]      "${shortInstr}" `)
			const observeResult = await testIdentity(modelId, instructions, 'observe')
			console.log(observeResult.success ? '✅' : `❌ ${observeResult.error}`)

			// Test understand
			process.stdout.write(`  [understand]   "${shortInstr}" `)
			const synthResult = await testIdentity(modelId, instructions, 'understand')
			console.log(synthResult.success ? '✅' : `❌ ${synthResult.error}`)
		}
	}

	console.log('\n')
}

main().catch(console.error)
