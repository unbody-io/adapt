/**
 * Eval: Model Capabilities
 *
 * Tests 5 capability categories against a model:
 *   1. Text output
 *   2. Structured output (JSON schema)
 *   3. Tool calling
 *   4. Structured output + tool calling
 *   5. Reasoning (thinking deltas)
 *
 * Usage:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/model-capabilities.ts
 *   PROVIDER=ollama MODEL=qwen2.5:7b npx tsx evals/scripts/model-capabilities.ts
 */

import { tool } from 'ai'
import { z } from 'zod'
import { generate, Output, stepCountIs, hasToolCall } from '../../src/llm'
import { logger } from '../helpers/logger'
import { model, modelName } from '../helpers/provider'
import { observeOutputSchema } from '../../src/learners/observer/schema.output'
import { promptContextSchema } from '../../src/brain/prompts/prompt.decompose-brain-prompt'

type Test = { name: string; run: () => Promise<void> }

const categories: { name: string; tests: Test[] }[] = [
	{
		name: 'Text Output',
		tests: [
			{
				name: 'plain text response',
				async run() {
					const result = await generate({ model, prompt: 'Say hello in one sentence.' })
					if (!result.text || result.text.length < 2) throw new Error('Empty text response')
				},
			},
			{
				name: 'system + prompt',
				async run() {
					const result = await generate({
						model,
						system: 'You are a pirate. Respond in pirate speak.',
						prompt: 'What is the weather like?',
					})
					if (!result.text || result.text.length < 2) throw new Error('Empty text response')
				},
			},
		],
	},
	{
		name: 'Structured Output',
		tests: [
			{
				name: 'simple schema (observeOutput)',
				async run() {
					const result = await generate({
						model,
						prompt: 'You observe software trends. Data: "TS 6.0 released." Extract observations.',
						output: Output.object({ schema: observeOutputSchema }),
						repairSchema: observeOutputSchema,
					})
					observeOutputSchema.parse(result.output)
				},
			},
			{
				name: 'nullable fields (promptContext)',
				async run() {
					const result = await generate({
						model,
						prompt: 'Analyze: "Track engineering decisions. Answer in concise technical tone."',
						output: Output.object({ schema: promptContextSchema }),
						repairSchema: promptContextSchema,
					})
					promptContextSchema.parse(result.output)
				},
			},
		],
	},
	{
		name: 'Tool Calling',
		tests: [
			{
				name: 'single tool (required)',
				async run() {
					const result = await generate({
						model,
						prompt: 'Look up the weather in Paris.',
						tools: {
							getWeather: tool({
								description: 'Get weather for a city',
								inputSchema: z.object({ city: z.string() }),
								execute: async ({ city }) => `${city}: 22°C, sunny`,
							}),
						},
						toolChoice: 'required',
						stopWhen: stepCountIs(3),
					})
					const calls = result.steps.flatMap((s) => s.toolCalls)
					if (!calls.some((c) => c.toolName === 'getWeather'))
						throw new Error(`No getWeather call, got: ${calls.map((c) => c.toolName)}`)
				},
			},
			{
				name: 'multi-step with terminal tool',
				async run() {
					const called: string[] = []
					const result = await generate({
						model,
						system: 'First search, then call complete with your answer.',
						prompt: 'What is the capital of France?',
						tools: {
							search: tool({
								description: 'Search the knowledge base',
								inputSchema: z.object({ query: z.string() }),
								execute: async () => {
									called.push('search')
									return 'The capital of France is Paris.'
								},
							}),
							complete: tool({
								description: 'Finalize your answer. Call when done.',
								inputSchema: z.object({ answer: z.string() }),
							}),
						},
						toolChoice: 'required',
						stopWhen: hasToolCall('complete'),
					})
					if (!called.includes('search')) throw new Error('search was not called')
					const calls = result.steps.flatMap((s) => s.toolCalls)
					if (!calls.some((c) => c.toolName === 'complete'))
						throw new Error('complete was not called')
				},
			},
		],
	},
	{
		name: 'Structured Output + Tool Calling',
		tests: [
			{
				name: 'tools with structured terminal output',
				async run() {
					const called: string[] = []
					const result = await generate({
						model,
						system: 'Search for info, then call complete with structured results.',
						prompt: 'Find facts about TypeScript.',
						tools: {
							search: tool({
								description: 'Search for information',
								inputSchema: z.object({ query: z.string() }),
								execute: async () => {
									called.push('search')
									return 'TypeScript is a typed superset of JavaScript by Microsoft.'
								},
							}),
							complete: tool({
								description: 'Finalize with structured results.',
								inputSchema: z.object({
									summary: z.string(),
									confidence: z.number().min(0).max(1),
									sources: z.array(z.string()),
								}),
							}),
						},
						toolChoice: 'required',
						stopWhen: hasToolCall('complete'),
					})
					if (!called.includes('search')) throw new Error('search was not called')
					const completeCalls = result.steps
						.flatMap((s) => s.toolCalls)
						.filter((c) => c.toolName === 'complete')
					if (completeCalls.length === 0) throw new Error('complete was not called')
					const input = (completeCalls[0] as any).input
					if (typeof input.summary !== 'string') throw new Error('Expected summary string')
					if (typeof input.confidence !== 'number') throw new Error('Expected confidence number')
					if (!Array.isArray(input.sources)) throw new Error('Expected sources array')
				},
			},
		],
	},
	{
		name: 'Reasoning',
		tests: [
			{
				name: 'reasoning deltas present',
				async run() {
					const result = await generate({
						model,
						prompt: 'Think step by step: what is 17 * 23?',
					})
					const hasReasoning =
						(result.reasoning && result.reasoning.length > 0) ||
						(result.reasoningDetails && result.reasoningDetails.length > 0)
					if (!hasReasoning) throw new Error('No reasoning deltas in response')
				},
			},
		],
	},
]

async function main() {
	logger.logSection(`Model Capabilities Eval — ${modelName}`)

	const summary: { category: string; passed: number; total: number; repaired: number }[] = []

	for (const cat of categories) {
		console.log(`\n  \x1b[36m${cat.name}\x1b[0m`)
		let passed = 0
		let repaired = 0

		for (const t of cat.tests) {
			const start = Date.now()
			try {
				await t.run()
				passed++
				console.log(`    \x1b[32m✓\x1b[0m ${t.name} — ${Date.now() - start}ms`)
			} catch (error) {
				const msg = error instanceof Error ? error.message.slice(0, 150) : String(error)
				console.log(`    \x1b[31m✗\x1b[0m ${t.name} — ${Date.now() - start}ms\n      ${msg}`)
			}
		}

		summary.push({ category: cat.name, passed, total: cat.tests.length, repaired })
	}

	logger.logSection('Summary')
	console.log(`Model: ${modelName}\n`)
	for (const s of summary) {
		const icon = s.passed === s.total ? '\x1b[32m✓\x1b[0m' : s.passed > 0 ? '\x1b[33m~\x1b[0m' : '\x1b[31m✗\x1b[0m'
		console.log(`  ${icon} ${s.category}: ${s.passed}/${s.total}`)
	}

	const totalPassed = summary.reduce((n, s) => n + s.passed, 0)
	const totalTests = summary.reduce((n, s) => n + s.total, 0)
	console.log(`\n  Total: ${totalPassed}/${totalTests}`)

	process.exit(totalPassed === totalTests ? 0 : 1)
}

main().catch((error) => {
	logger.logError('Eval failed', error instanceof Error ? error : new Error(String(error)))
	process.exit(1)
})
