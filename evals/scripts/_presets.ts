/**
 * Shared model presets for every eval that hits real LLMs.
 *
 * Each preset:
 *   - id          stable name (used in MODELS env filter)
 *   - envVar      env var that must be set for the preset to run
 *   - build       async fn returning { model, providerKey, factory } —
 *                 model is the live AI SDK LanguageModel,
 *                 providerKey matches model.provider (used as the key in
 *                 createAiSdkLLM({ providers: { ... } })),
 *                 factory is a sync (modelId) => model resolver suitable
 *                 for the AdaptLLMPlugin's `providers` map.
 *   - supportsStrictOff  true ONLY for direct openai presets (the
 *                        @ai-sdk/openai provider honors
 *                        providerOptions.openai.strictJsonSchema:false).
 *
 * Usage in evals:
 *   - selectPresets()                    — filters PRESETS by MODELS env
 *                                           and skips ones whose env key
 *                                           isn't set
 *   - selectPresets({ require: 2 })      — same, plus throws when fewer
 *                                           than N presets are selectable
 *   - handleListMode()                   — handles MODELS=list and exits
 *
 * Add new presets at the bottom of the array.
 */

import type { LanguageModel } from 'ai'
import type { AiSdkProviderFactory } from '../../src'

export interface PresetBuild {
	model: LanguageModel
	providerKey: string
	factory: AiSdkProviderFactory
}

export interface Preset {
	id: string
	envVar: string
	build: (apiKey: string) => Promise<PresetBuild>
	supportsStrictOff?: boolean
}

function asFactory(provider: (id: string) => unknown): AiSdkProviderFactory {
	return ((id: string) =>
		provider(id) as unknown as ReturnType<AiSdkProviderFactory>) as AiSdkProviderFactory
}

function providerKeyOf(model: LanguageModel): string {
	return (model as { provider?: string }).provider ?? 'unknown'
}

export const PRESETS: Preset[] = [
	{
		id: 'openai-gpt-4o-mini',
		envVar: 'OPENAI_API_KEY',
		supportsStrictOff: true,
		async build(apiKey) {
			const { createOpenAI } = await import('@ai-sdk/openai')
			const provider = createOpenAI({ apiKey })
			const model = provider('gpt-4o-mini')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'google-gemini-2.5-flash',
		envVar: 'GOOGLE_GEMINI_API_KEY',
		async build(apiKey) {
			const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
			const provider = createGoogleGenerativeAI({ apiKey })
			const model = provider('gemini-2.5-flash')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'anthropic-haiku-4-5',
		envVar: 'ANTHROPIC_API_KEY',
		async build(apiKey) {
			const { createAnthropic } = await import('@ai-sdk/anthropic')
			const provider = createAnthropic({ apiKey })
			const model = provider('claude-haiku-4-5')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-gemini-2.0-flash',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('google/gemini-2.0-flash-001')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-gemini-3.1-flash-lite-preview',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('google/gemini-3.1-flash-lite-preview')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-gemma-4-31b',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('google/gemma-4-31b-it')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-grok-4-3',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('x-ai/grok-4.3')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-gpt-mini-latest',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('~openai/gpt-mini-latest')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-kimi-latest',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('~moonshotai/kimi-latest')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'openrouter-ministral-3b',
		envVar: 'OPENROUTER_API_KEY',
		async build(apiKey) {
			const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
			const provider = createOpenRouter({ apiKey })
			const model = provider('mistralai/ministral-3b-2512')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'togetherai-deepseek-v3-1',
		envVar: 'TOGETHERAI_API_KEY',
		async build(apiKey) {
			const { createTogetherAI } = await import('@ai-sdk/togetherai')
			const provider = createTogetherAI({ apiKey })
			const model = provider('deepseek-ai/DeepSeek-V3.1')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'togetherai-qwen-3-5',
		envVar: 'TOGETHERAI_API_KEY',
		async build(apiKey) {
			const { createTogetherAI } = await import('@ai-sdk/togetherai')
			const provider = createTogetherAI({ apiKey })
			const model = provider('Qwen/Qwen3.5-397B-A17B')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'togetherai-lfm2-24b',
		envVar: 'TOGETHERAI_API_KEY',
		async build(apiKey) {
			const { createTogetherAI } = await import('@ai-sdk/togetherai')
			const provider = createTogetherAI({ apiKey })
			const model = provider('LiquidAI/LFM2-24B-A2B')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'togetherai-qwen-3-5-9b',
		envVar: 'TOGETHERAI_API_KEY',
		async build(apiKey) {
			const { createTogetherAI } = await import('@ai-sdk/togetherai')
			const provider = createTogetherAI({ apiKey })
			const model = provider('Qwen/Qwen3.5-9B')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	{
		id: 'togetherai-gemma-4-31b',
		envVar: 'TOGETHERAI_API_KEY',
		async build(apiKey) {
			const { createTogetherAI } = await import('@ai-sdk/togetherai')
			const provider = createTogetherAI({ apiKey })
			const model = provider('google/gemma-4-31B-it')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	// LM Studio (local). Set LMSTUDIO_BASE_URL=http://localhost:1234/v1 in
	// .env.local. The build function receives that URL via `apiKey` (the
	// envVar value — naming is historical; for LM Studio it carries the
	// baseURL, not a key). Make sure the model is loaded in LM Studio first.
	{
		id: 'lmstudio-lfm2-5-1-2b',
		envVar: 'LMSTUDIO_BASE_URL',
		async build(baseURL) {
			const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
			// LM Studio only accepts response_format: 'json_schema' | 'text' —
			// the AI SDK default 'json_object' is rejected. Setting
			// supportsStructuredOutputs:true switches the SDK to send json_schema.
			const provider = createOpenAICompatible({
				name: 'lmstudio',
				baseURL,
				supportsStructuredOutputs: true,
			})
			const model = provider('liquid/lfm2.5-1.2b')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
	// llama.cpp's llama-server (local). Set LLAMACPP_BASE_URL=http://localhost:8080/v1
	// in .env.local. Start the server with:
	//   llama-server -hf LiquidAI/LFM2-1.2B-GGUF --jinja --port 8080
	{
		id: 'llamacpp-lfm2-5-1-2b',
		envVar: 'LLAMACPP_BASE_URL',
		async build(baseURL) {
			const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
			const provider = createOpenAICompatible({
				name: 'llamacpp',
				baseURL,
				supportsStructuredOutputs: true,
			})
			const model = provider('LiquidAI/LFM2.5-1.2B-Instruct-GGUF')
			return { model, providerKey: providerKeyOf(model), factory: asFactory(provider) }
		},
	},
]

/** Returns true if the user invoked MODELS=list and the script should exit. */
export function handleListMode(): boolean {
	if (process.env.MODELS?.trim() !== 'list') return false
	console.log('Available presets:')
	for (const p of PRESETS) {
		const has = process.env[p.envVar] ? '✓' : '·'
		console.log(`  ${has} ${p.id.padEnd(36)}  (${p.envVar})`)
	}
	console.log('\nUse: MODELS=<id1>,<id2> npx tsx evals/scripts/<eval>.ts')
	return true
}

/**
 * Apply MODELS env filter, drop presets without the env key set.
 * Throws if `require` is set and fewer than that many presets resolved.
 */
export function selectPresets(opts: { require?: number } = {}): Preset[] {
	const filter = process.env.MODELS?.trim()
	const requested = filter
		? new Set(filter.split(',').map((s) => s.trim()).filter(Boolean))
		: null

	if (requested) {
		const unknown = [...requested].filter((id) => !PRESETS.find((p) => p.id === id))
		if (unknown.length > 0) {
			throw new Error(
				`Unknown preset id(s): ${unknown.join(', ')}. Run with MODELS=list to see options.`,
			)
		}
	}

	const filtered = requested
		? PRESETS.filter((p) => requested.has(p.id))
		: PRESETS

	const available = filtered.filter((p) => process.env[p.envVar])

	if (opts.require && available.length < opts.require) {
		const missing = filtered
			.filter((p) => !process.env[p.envVar])
			.map((p) => `${p.id} (${p.envVar} not set)`)
			.join(', ')
		throw new Error(
			`Need at least ${opts.require} resolvable presets, got ${available.length}. ` +
				`Skipped: ${missing || '(none)'}`,
		)
	}

	return available
}
