/**
 * Test identity generation across models
 *
 * Tests both observe and synthesize identity generation.
 * Run with: MODEL=<model> bun evals/test-identity-gen.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { observeIdentityPromptTemplate } from '../src/learners/text-learner/learning-methods/default-method/observe/prompt.template.identity'
import { observeIdentitySchema } from '../src/learners/text-learner/learning-methods/default-method/observe/schema.identity'
import { synthesizeIdentityPromptTemplate } from '../src/learners/text-learner/learning-methods/default-method/synthesize/prompt.template.identity'
import { synthesizeIdentitySchema } from '../src/learners/text-learner/learning-methods/default-method/synthesize/schema.identity'

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

type IdentityType = 'observe' | 'synthesize'

async function testIdentity(modelId: string, instructions: string, type: IdentityType) {
	const model = openrouter(modelId)

	const prompt = type === 'observe'
		? observeIdentityPromptTemplate(instructions)
		: synthesizeIdentityPromptTemplate(instructions)

	const schema = type === 'observe'
		? observeIdentitySchema
		: synthesizeIdentitySchema

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
			process.stdout.write(`  [observe]     "${shortInstr}" `)
			const observeResult = await testIdentity(modelId, instructions, 'observe')
			console.log(observeResult.success ? '✅' : `❌ ${observeResult.error}`)

			// Test synthesize
			process.stdout.write(`  [synthesize]  "${shortInstr}" `)
			const synthResult = await testIdentity(modelId, instructions, 'synthesize')
			console.log(synthResult.success ? '✅' : `❌ ${synthResult.error}`)
		}
	}

	console.log('\n')
}

main().catch(console.error)
