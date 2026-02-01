/**
 * Test Brain learner decomposition only
 *
 * Tests how Brain parses a prompt and generates learner configs.
 * Does NOT test learner initialization.
 *
 * Run with: MODEL=<model> bun evals/test-brain-decompose.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { learnerConfigsPromptTemplate } from '../src/brain/prompts/prompt.template.learner-configs'
import { learnerConfigsSchema } from '../src/brain/schemas/schema.learner-configs'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

const TEST_PROMPTS = [
	`Track my coding patterns, development philosophy, and learning interests.
I'll be feeding you my conversations with AI coding assistants, git commits, code reviews, and technical reading activity.
I want to understand:
- My coding philosophy and core beliefs about software
- My style preferences and patterns
- What topics I'm actively learning`,

	`Understand this therapist - their philosophy, approach, expertise, and what makes them unique.
Data will include their bio, blog posts, session notes, and client testimonials.`,

	`Track a restaurant's identity - their cuisine style, signature dishes, and what regulars love about them.
Data: menus, reviews, chef interviews, social media posts.`,
]

async function testPrompt(brainPrompt: string) {
	const model = openrouter(MODEL)
	const prompt = learnerConfigsPromptTemplate(brainPrompt)

	try {
		const result = await generateText({
			model,
			prompt,
			output: Output.object({ schema: learnerConfigsSchema }),
		})

		if (!result.output) {
			return { success: false, error: 'No output generated' }
		}

		return { success: true, learners: result.output.learners }
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		return { success: false, error: msg.substring(0, 100) }
	}
}

async function main() {
	console.log(`\n🧠 Brain Learner Decomposition Test`)
	console.log(`Model: ${MODEL}\n`)

	for (let i = 0; i < TEST_PROMPTS.length; i++) {
		const brainPrompt = TEST_PROMPTS[i]

		console.log(`\n${'═'.repeat(70)}`)
		console.log(`TEST ${i + 1}`)
		console.log(`${'═'.repeat(70)}\n`)

		console.log(`BRAIN INSTRUCTION:`)
		console.log(`${brainPrompt.split('\n').map(l => `  ${l}`).join('\n')}\n`)

		const result = await testPrompt(brainPrompt)

		if (!result.success) {
			console.log(`❌ ERROR: ${result.error}\n`)
			continue
		}

		console.log(`LEARNERS CREATED: ${result.learners.length}\n`)

		for (const learner of result.learners) {
			console.log(`  ┌─ ${learner.name} (${learner.id})`)
			console.log(`  │  Type: ${learner.type}`)
			console.log(`  │  Strategy: ${learner.maintenance?.strategy ?? 'continuous (default)'}`)
			console.log(`  │  Description: ${learner.description}`)
			console.log(`  │`)
			console.log(`  │  Instructions:`)
			learner.instructions.split('\n').forEach(line => {
				console.log(`  │    ${line}`)
			})
			console.log(`  └─\n`)
		}
	}
}

main().catch(console.error)
