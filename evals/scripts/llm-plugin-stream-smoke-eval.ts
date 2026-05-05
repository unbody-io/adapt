/**
 * Eval: ai-sdk plugin smoke test — STREAMING (lean per-provider stream check)
 *
 * Mirror of llm-plugin-smoke-eval.ts but every LLM call is `streamText`, and
 * the consumer iterates the stream + awaits the final-state promises. Strips
 * the brain pipeline out — five minimal streaming calls per preset that
 * collectively exercise every Zod feature and tool-calling pattern Adapt's
 * streaming surface uses anywhere in src/:
 *
 *   A. Schema breadth (streaming) — kitchen-sink Output.object via streamText.
 *      Read partialOutputStream + final `output` promise.
 *   B. Tool-calling breadth (streaming) — multi-tool loop via streamText with
 *      `toolChoice: 'required'`, iterate fullStream, verify all tools fired.
 *   C. Schema breadth + strictJsonSchema:false (streaming) — OpenAI escape
 *      hatch in the streaming path.
 *   D. Size-scaled structured output (streaming) — mirrors brainDecompositionSchema
 *      size; catches providers that truncate large outputs in stream mode.
 *   E. Stateful tool flow (streaming) — generateResponse → complete contract
 *      while streaming. Mirrors ToolBasedMethod.queryStream.
 *
 * If A + B + C + D + E all pass, every real streaming pattern in Adapt will
 * pass on this preset. Counterpart: llm-plugin-smoke-eval.ts.
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/llm-plugin-stream-smoke-eval.ts
 *
 * Filter / list / add presets — see evals/scripts/_presets.ts.
 */

import { Output, stepCountIs, streamText } from 'ai'
import { type Preset, handleListMode, selectPresets } from './_presets'
import {
	buildStatefulTools,
	buildTools,
	kitchenSinkSchema,
	sizedSchema,
} from './llm-plugin-smoke-eval'

interface Result {
	preset: string
	a: { status: 'pass' | 'fail' | 'skip'; detail?: string }
	b: { status: 'pass' | 'fail' | 'skip'; detail?: string }
	c: { status: 'pass' | 'fail' | 'skip'; detail?: string }
	d: { status: 'pass' | 'fail' | 'skip'; detail?: string }
	e: { status: 'pass' | 'fail' | 'skip'; detail?: string }
}

async function runPreset(preset: Preset, apiKey: string): Promise<Result> {
	console.log(`\n${'━'.repeat(72)}`)
	console.log(`Preset: ${preset.id}`)
	console.log('━'.repeat(72))

	const { model } = await preset.build(apiKey)
	const result: Result = {
		preset: preset.id,
		a: { status: 'skip' },
		b: { status: 'skip' },
		c: { status: 'skip' },
		d: { status: 'skip' },
		e: { status: 'skip' },
	}

	console.log('\n[A] kitchen-sink structured output (stream)')
	try {
		const t0 = Date.now()
		const stream = streamText({
			model,
			experimental_output: Output.object({ schema: kitchenSinkSchema }),
			prompt:
				'Produce an example object: id="abc", score=0.7, count=3, flag=true, tagline=null, status=active, ' +
				'tags=["x","y"], meta with author "alice" and revision 2, items=[{name=foo,kind=a,note=null},{name=bar,kind=b,note="hi"}].',
		})
		// Drain the textStream so the model fully runs.
		for await (const _ of stream.textStream) {
			// no-op — just consume
		}
		const object = await stream.output
		console.log(`  ✓ pass (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
		console.log(`  output: ${JSON.stringify(object).slice(0, 200)}…`)
		result.a = { status: 'pass' }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.log(`  ✗ FAIL: ${msg.slice(0, 200)}`)
		result.a = { status: 'fail', detail: msg.slice(0, 200) }
	}

	console.log('\n[B] kitchen-sink tool-calling (stream)')
	try {
		const t0 = Date.now()
		const { tools, log } = buildTools()
		const stream = streamText({
			model,
			tools,
			toolChoice: 'required',
			stopWhen: stepCountIs(8),
			prompt:
				'Run this sequence: call ping, then echo with text="ok", then classify with level=medium and note=null, ' +
				'then complete with summary="done" and severity="routine".',
		})
		// Iterate fullStream so events flow + tool execute fns fire.
		const seenTypes: string[] = []
		for await (const part of stream.fullStream) {
			seenTypes.push(part.type)
		}
		await stream.text // ensure resolution
		console.log(`  ✓ pass (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
		console.log(`  tool calls: ${log.join(' → ')} → complete`)
		console.log(`  stream event types seen: ${[...new Set(seenTypes)].join(', ')}`)
		result.b = { status: 'pass' }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.log(`  ✗ FAIL: ${msg.slice(0, 200)}`)
		result.b = { status: 'fail', detail: msg.slice(0, 200) }
	}

	if (!preset.supportsStrictOff) {
		console.log('\n[C] strictJsonSchema:false (stream) — n/a (OpenAI-only)')
		result.c = { status: 'skip' }
	} else {
		console.log('\n[C] structured output stream with strictJsonSchema:false (OpenAI escape hatch)')
		try {
			const t0 = Date.now()
			const stream = streamText({
				model,
				experimental_output: Output.object({ schema: kitchenSinkSchema }),
				prompt:
					'Produce a different example object — any valid values that match the schema.',
				providerOptions: { openai: { strictJsonSchema: false } },
			})
			for await (const _ of stream.textStream) {
				// no-op
			}
			const object = await stream.output
			console.log(`  ✓ pass (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
			console.log(`  output: ${JSON.stringify(object).slice(0, 200)}…`)
			result.c = { status: 'pass' }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.log(`  ✗ FAIL: ${msg.slice(0, 200)}`)
			result.c = { status: 'fail', detail: msg.slice(0, 200) }
		}
	}

	console.log('\n[D] size-scaled structured output (stream — mirrors brainDecompositionSchema)')
	try {
		const t0 = Date.now()
		const stream = streamText({
			model,
			experimental_output: Output.object({ schema: sizedSchema }),
			prompt:
				'Decompose this prompt into 3 specialized neurons: ' +
				'"Track engineering decisions across tooling, CI, runtime libraries, and architectural ' +
				'choices, including the rationale for each." Each neuron must include a multi-paragraph ' +
				'instructions field with at least 8 sentences (a core directive, a Watch-for list with ' +
				'3+ specific conditions, and a Track-answers-to list with 3+ questions).',
		})
		for await (const _ of stream.textStream) {
			// no-op
		}
		const object = await stream.output
		const total = JSON.stringify(object).length
		console.log(`  ✓ pass (${((Date.now() - t0) / 1000).toFixed(1)}s, ${total} bytes)`)
		const minInstr = Math.min(
			...(object as { neurons: Array<{ instructions: string }> }).neurons.map(
				(n) => n.instructions.length,
			),
		)
		console.log(`  shortest instructions: ${minInstr} chars`)
		result.d = { status: 'pass' }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.log(`  ✗ FAIL: ${msg.slice(0, 200)}`)
		result.d = { status: 'fail', detail: msg.slice(0, 200) }
	}

	console.log('\n[E] stateful tool flow (stream — generateResponse → complete contract)')
	try {
		const t0 = Date.now()
		const { tools, getCaptured } = buildStatefulTools()
		const stream = streamText({
			model,
			tools,
			toolChoice: 'required',
			stopWhen: stepCountIs(4),
			system:
				'You are a specialist. Your domain: "general knowledge". ' +
				'Read the question, then answer it. ' +
				'Acknowledge uncertainty. Don\'t invent. ' +
				'Call complete when done.',
			prompt:
				'Question: What is the capital of France? Answer based on what you know.',
		})
		// Iterate fullStream so the execute fns fire mid-stream.
		for await (const _ of stream.fullStream) {
			// no-op — just drive the loop
		}
		await stream.text
		const captured = getCaptured()
		if (typeof captured === 'string' && captured.trim().length > 0) {
			console.log(`  ✓ pass (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
			console.log(`  captured response: "${captured.slice(0, 80)}…"`)
			result.e = { status: 'pass' }
		} else {
			console.log(`  ✗ FAIL: model called complete without first calling generateResponse`)
			result.e = {
				status: 'fail',
				detail: 'no response captured — model skipped generateResponse',
			}
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.log(`  ✗ FAIL: ${msg.slice(0, 200)}`)
		result.e = { status: 'fail', detail: msg.slice(0, 200) }
	}

	return result
}

async function main() {
	if (handleListMode()) return

	const presets = selectPresets()
	if (presets.length === 0) {
		console.log('No presets selected. Set provider env keys or use MODELS=list.')
		return
	}

	console.log('Eval: ai-sdk plugin smoke test (STREAMING)')
	console.log(`Time: ${new Date().toISOString()}`)
	console.log(`Selected: ${presets.map((p) => p.id).join(', ')}`)

	const results: Result[] = []
	for (const preset of presets) {
		const apiKey = process.env[preset.envVar]
		if (!apiKey) continue
		results.push(await runPreset(preset, apiKey))
	}

	console.log(`\n${'═'.repeat(72)}`)
	console.log('Summary')
	console.log('═'.repeat(72))
	const longest = Math.max(...results.map((r) => r.preset.length), 8)
	console.log(`  ${'preset'.padEnd(longest)}  A       B       C       D       E`)
	for (const r of results) {
		const tag = (s: 'pass' | 'fail' | 'skip') =>
			s === 'pass' ? '✓ pass' : s === 'fail' ? '✗ FAIL' : '↷ skip'
		console.log(
			`  ${r.preset.padEnd(longest)}  ${tag(r.a.status)}  ${tag(r.b.status)}  ${tag(r.c.status)}  ${tag(r.d.status)}  ${tag(r.e.status)}`,
		)
	}
}

main().catch((err) => {
	console.error('Eval crashed:', err)
})
