/**
 * Docs code test: 01-getting-started.md
 *
 * Verifies every TypeScript code block from the Getting Started guide
 * compiles and runs correctly.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx tests/docs-code/01-getting-started.ts
 */

import { Brain, TextNeuron, MemoryNeuronStore } from '@unbody/adapt'
import { SQLiteBrainStore, SQLiteNeuronStore } from '@unbody/adapt/sqlite'
import { model } from '../../evals/helpers/provider'
import { mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(__dirname, '..', '.tmp-docs-01')

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
	if (condition) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ ${message}`)
	}
}

function section(title: string) {
	console.log(`\n━━━ ${title} ━━━`)
}

async function main() {
	mkdirSync(tmpDir, { recursive: true })

	try {
		// ── 01-getting-started.md: Brain Quick Start ─────────────────────────
		section('Brain Quick Start')

		const brain = new Brain({
			prompt: 'Track my coding patterns and development philosophy.',
			model,
		})

		await brain.inject([
			{ type: 'commit', message: 'refactor: extract validation into pure functions' },
			{ type: 'review', comment: 'Too heavy — factory functions work fine for our scale.' },
		])

		const result = await brain.ask('What is my coding philosophy?')
		assert(typeof result.insight === 'string', 'brain.ask() returns result.insight as string')
		console.log(`  insight: ${result.insight.slice(0, 80)}...`)

		await brain.dispose()

		// ── 01-getting-started.md: Standalone Neuron ─────────────────────────
		section('Standalone Neuron')

		const neuron = new TextNeuron({
			model,
			instructions: 'Track product design principles and philosophy.',
			store: new MemoryNeuronStore(),
		})

		await neuron.learn([
			'User said: simplicity over features',
			'Team decided: no dark patterns, ever',
		])

		const neuronResult = await neuron.query('What are our design principles?')
		assert(typeof neuronResult.insight === 'string', 'neuron.query() returns result.insight as string')
		console.log(`  insight: ${neuronResult.insight.slice(0, 80)}...`)

		await neuron.dispose()

		// ── 01-getting-started.md: Explicit Neurons ──────────────────────────
		section('Explicit Neurons')

		const explicitBrain = new Brain({
			prompt: 'Track cooking knowledge.',
			model,
			autoSetup: false,
			neurons: [
				{
					id: 'techniques',
					name: 'Cooking Techniques',
					type: 'text',
					description: 'Culinary methods and approaches',
					instructions: 'Track cooking techniques, methods, and principles.',
				},
				{
					id: 'recipes',
					name: 'Recipe Collection',
					type: 'list',
					description: 'Tracked recipes and ingredients',
					instructions: 'Track recipes with cuisine type, ingredients, and difficulty level.',
				},
			],
		})

		await explicitBrain.initialize()
		const neurons = explicitBrain.getNeurons()
		assert(neurons.length === 2, 'explicit neurons: 2 neurons created')
		assert(neurons.some(n => n.id === 'techniques'), 'explicit neurons: techniques neuron exists')
		assert(neurons.some(n => n.id === 'recipes'), 'explicit neurons: recipes neuron exists')

		await explicitBrain.dispose()

		// ── 01-getting-started.md: SQLite Persistence ────────────────────────
		section('SQLite Persistence')

		const sqliteBrain = new Brain({
			prompt: 'Track my coding patterns.',
			model,
			store: new SQLiteBrainStore(join(tmpDir, 'brain.db')),
			learning: {
				store: (neuronId: string) => new SQLiteNeuronStore(join(tmpDir, `neuron-${neuronId}.db`)),
			},
		})

		await sqliteBrain.initialize()
		assert(true, 'SQLite brain initialized successfully')

		await sqliteBrain.dispose()
	} finally {
		rmSync(tmpDir, { recursive: true, force: true })
	}

	// ── Summary ──────────────────────────────────────────────────────────────
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`01-getting-started: ${passed} passed, ${failed} failed`)
	if (failed > 0) process.exit(1)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
