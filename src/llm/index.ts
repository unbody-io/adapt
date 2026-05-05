import {
	NoObjectGeneratedError,
	type CallSettings,
	type LanguageModel as AiLanguageModel,
	type ModelMessage,
	Output as AiOutput,
	type ToolChoice,
	generateText,
	streamText as aiStreamText,
	tool as aiTool,
} from 'ai'
import { type ZodSchema, z } from 'zod'

export type { CallSettings, LanguageModelUsage } from 'ai'

// ── JSON + model config ────────────────────────────────────────────────────

export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
	| JsonPrimitive
	| JsonValue[]
	| { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export interface AdaptModelConfig<
	TPlugin extends string = string,
	TProvider extends string = string,
	TOptions extends JsonObject = JsonObject,
> {
	plugin?: TPlugin
	provider?: TProvider
	id: string
	options?: TOptions
}

export type LanguageModel = AiLanguageModel | AdaptModelConfig

export function isAdaptModelConfig(value: unknown): value is AdaptModelConfig {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof (value as { id?: unknown }).id === 'string'
	)
}

// ── Adapt-owned request/result contract ────────────────────────────────────

export type AdaptContent =
	| { type: 'text'; text: string }
	| { type: 'json'; value: unknown }

export type AdaptMessage =
	| { role: 'user'; content: AdaptContent[] }
	| { role: 'assistant'; content: AdaptContent[]; toolCalls?: AdaptToolCall[] }
	| {
			role: 'tool'
			toolCallId: string
			toolName: string
			content: AdaptContent[]
	  }

export type AdaptOutputSpec =
	| { type: 'text' }
	| {
			type: 'object'
			schema: ZodSchema
			name?: string
			description?: string
	  }

export type AdaptUsage = {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

export type AdaptFinishReason =
	| 'stop'
	| 'length'
	| 'tool-calls'
	| 'error'
	| 'unknown'

export type AdaptToolCall = {
	type: 'tool-call'
	toolCallId: string
	toolName: string
	input: unknown
	providerMetadata?: unknown
}

export type AdaptToolResult = {
	type: 'tool-result'
	toolCallId: string
	toolName: string
	output: unknown
}

export type AdaptToolContext = {
	toolCallId: string
	toolName: string
	messages: AdaptMessage[]
}

export type AdaptToolSpec = {
	description?: string
	inputSchema: any
}

export type Tool<INPUT = any, OUTPUT = any> = AdaptTool<INPUT, OUTPUT>

export type AdaptTool<INPUT = any, OUTPUT = any> = AdaptToolSpec & {
	execute?: (input: INPUT, context: any) => OUTPUT | Promise<OUTPUT>
}

export function tool(definition: AdaptTool<any, any>): AdaptTool<any, any> {
	return definition
}

export const Output = {
	object<TSchema extends ZodSchema>(args: {
		schema: TSchema
		name?: string
		description?: string
	}): AdaptOutputSpec {
		return {
			type: 'object',
			schema: args.schema,
			...(args.name ? { name: args.name } : {}),
			...(args.description ? { description: args.description } : {}),
		}
	},
	text(): AdaptOutputSpec {
		return { type: 'text' }
	},
}

export type AdaptStepResult = {
	text: string
	output?: unknown
	toolCalls: AdaptToolCall[]
	toolResults: AdaptToolResult[]
	usage?: AdaptUsage
}

export type StopCondition = (options: {
	steps: AdaptStepResult[]
}) => boolean | PromiseLike<boolean>

export function stepCountIs(stepCount: number): StopCondition {
	return ({ steps }) => steps.length >= stepCount
}

export function hasToolCall(toolName: string): StopCondition {
	return ({ steps }) =>
		steps.some((step) =>
			step.toolCalls.some((toolCall) => toolCall.toolName === toolName),
		)
}

export type AdaptModelTurnRequest<
	TModel extends AdaptModelConfig = AdaptModelConfig,
	TPluginOptions = unknown,
> = {
	model: TModel
	system?: string
	messages: AdaptMessage[]
	output?: AdaptOutputSpec
	tools?: Record<string, AdaptTool>
	toolChoice?: ToolChoice<Record<string, never>>
	settings?: AdaptCallSettings
	metadata?: AdaptCallMetadata
	pluginOptions?: TPluginOptions
	signal?: AbortSignal
}

export type AdaptCallSettings = CallSettings & {
	providerOptions?: unknown
	headers?: Record<string, string | undefined>
	timeout?: unknown
	maxRetries?: number
}

export type AdaptCallMetadata = {
	purpose?: string
	brainId?: string
	neuronId?: string
	operationId?: string
}

export type AdaptModelTurnResult<TJson = any, TRaw = unknown> = {
	text?: string
	json?: TJson
	toolCalls?: AdaptToolCall[]
	usage?: AdaptUsage
	finishReason?: AdaptFinishReason
	providerMetadata?: unknown
	raw?: TRaw
}

export type AdaptModelStreamEvent<TRaw = unknown> =
	| { type: 'text-delta'; text: string; raw?: TRaw }
	| { type: 'json-delta'; value: unknown; raw?: TRaw }
	| { type: 'tool-call'; toolCall: AdaptToolCall; raw?: TRaw }
	| { type: 'usage'; usage: AdaptUsage; raw?: TRaw }
	| { type: 'finish'; finishReason: AdaptFinishReason; raw?: TRaw }
	| { type: 'error'; error: unknown; raw?: TRaw }

/**
 * The streaming counterpart of {@link AdaptModelTurnResult}.
 *
 * Plugin's `streamCall` returns this; Adapt's public `streamText` returns this
 * unchanged. Mirror's `plugin.call`'s contract — same input ({@link AdaptModelTurnRequest}),
 * full result instead of a partial — so AI SDK is one plugin among many, not
 * privileged.
 */
export type AdaptStreamResult<TRaw = unknown> = {
	textStream: AsyncIterable<string>
	fullStream: AsyncIterable<AdaptModelStreamEvent<TRaw>>
	text: Promise<string>
	usage: Promise<AdaptUsage>
	toolCalls: Promise<AdaptToolCall[]>
	steps: Promise<AdaptStepResult[]>
}

export interface AdaptLLMPlugin<
	TModel extends AdaptModelConfig = AdaptModelConfig,
	TPluginOptions = unknown,
	TRaw = unknown,
> {
	id: string
	version?: string
	model: {
		toConfig(input: unknown): TModel
		validateConfig?(config: TModel): void
	}
	call<TJson = unknown>(
		request: AdaptModelTurnRequest<TModel, TPluginOptions>,
	): Promise<AdaptModelTurnResult<TJson, TRaw>>
	streamCall?(
		request: AdaptModelTurnRequest<TModel, TPluginOptions>,
	): Promise<AdaptStreamResult<TRaw>>
}

export type AdaptGenerateRequest<
	TModel extends LanguageModel = LanguageModel,
	TPluginOptions = unknown,
> = AdaptCallSettings & {
	/**
	 * The LLM plugin that owns the runtime for this call. Required.
	 * Each Brain/Neuron instance holds its own plugin and threads it through
	 * to every internal generate()/streamText() call.
	 */
	llm: AdaptLLMPlugin
	model: TModel
	system?: string
	prompt?: string
	messages?: AdaptMessage[]
	output?: AdaptOutputSpec
	repairSchema?: ZodSchema
	tools?: Record<string, AdaptTool>
	toolChoice?: ToolChoice<Record<string, never>>
	stopWhen?: StopCondition | StopCondition[]
	maxSteps?: number
	onStepFinish?: (step: AdaptStepResult) => void | Promise<void>
	metadata?: AdaptCallMetadata
	pluginOptions?: TPluginOptions
	abortSignal?: AbortSignal
	[key: string]: unknown
}

export type AdaptGenerateResult<TJson = any> = {
	text: string
	output: TJson
	reasoning: Array<{ text: string }>
	reasoningText?: string
	toolCalls: AdaptToolCall[]
	toolResults: AdaptToolResult[]
	steps: AdaptStepResult[]
	finishReason: AdaptFinishReason
	usage: Required<AdaptUsage>
	providerMetadata?: unknown
	raw?: unknown
}

// ── Plugin identity ────────────────────────────────────────────────────────

const DEFAULT_PLUGIN_ID = 'ai-sdk'

/**
 * Normalize a model input (live AI SDK model, gateway string, or already-an-AdaptModelConfig)
 * into an AdaptModelConfig using the supplied plugin's `model.toConfig` rule.
 */
export function toModelConfig(
	input: LanguageModel,
	plugin: AdaptLLMPlugin,
): AdaptModelConfig {
	if (isAdaptModelConfig(input)) return input
	return plugin.model.toConfig(input)
}

// ── Default AI SDK plugin ──────────────────────────────────────────────────

export type AiSdkProviderFactory = (
	modelId: string,
	config: AdaptModelConfig<'ai-sdk'>,
) => AiLanguageModel

export type AiSdkLLMOptions = {
	/**
	 * Provider factories keyed by provider name. The plugin uses these to turn
	 * persisted model configs back into live AI SDK models on restore.
	 */
	providers?: Record<string, AiSdkProviderFactory>
	/**
	 * Opt into Vercel AI Gateway for any model whose provider is not
	 * registered here. Defaults to false. When true, unresolved models fall
	 * back to AI SDK's `"provider:modelId"` Gateway string form (which
	 * requires `AI_GATEWAY_API_KEY`). Off by default to surface missing
	 * providers loudly instead of silently failing with a Gateway 401.
	 */
	gateway?: boolean
}

export function createAiSdkLLM(options: AiSdkLLMOptions = {}): AdaptLLMPlugin {
	const providers = options.providers ?? {}
	const gateway = options.gateway === true
	// Per-plugin cache — instance-scoped so a new plugin instance does
	// not leak live models from a previous instance into the new resolver.
	const liveAiSdkModels = new Map<string, AiLanguageModel>()

	function modelKey(config: AdaptModelConfig): string {
		return JSON.stringify({
			plugin: config.plugin ?? DEFAULT_PLUGIN_ID,
			provider: config.provider,
			id: config.id,
			options: config.options ?? {},
		})
	}

	function toConfig(input: unknown): AdaptModelConfig<'ai-sdk'> {
		if (isAdaptModelConfig(input)) {
			return {
				...input,
				plugin: input.plugin ?? DEFAULT_PLUGIN_ID,
			} as AdaptModelConfig<'ai-sdk'>
		}

		if (typeof input === 'string') {
			const colonIdx = input.indexOf(':')
			const config =
				colonIdx > 0
					? {
							plugin: DEFAULT_PLUGIN_ID,
							provider: input.slice(0, colonIdx),
							id: input.slice(colonIdx + 1),
						}
					: {
							plugin: DEFAULT_PLUGIN_ID,
							id: input,
						}
			return config as AdaptModelConfig<'ai-sdk'>
		}

		if (
			typeof input === 'object' &&
			input !== null &&
			'provider' in input &&
			'modelId' in input
		) {
			const model = input as AiLanguageModel & {
				provider: string
				modelId: string
			}
			const config: AdaptModelConfig<'ai-sdk'> = {
				plugin: DEFAULT_PLUGIN_ID,
				provider: model.provider,
				id: model.modelId,
			}
			liveAiSdkModels.set(modelKey(config), model)
			return config
		}

		throw new Error('Unsupported AI SDK model input')
	}

	function resolveModel(config: AdaptModelConfig<'ai-sdk'>): AiLanguageModel {
		const cached = liveAiSdkModels.get(modelKey(config))
		if (cached) return cached

		const provider = config.provider ? providers[config.provider] : undefined
		if (provider) return provider(config.id, config)

		if (gateway) {
			return (
				config.provider ? `${config.provider}:${config.id}` : config.id
			) as AiLanguageModel
		}

		throw new Error(
			`Cannot run model ${JSON.stringify(config)}. The AI SDK plugin cannot resolve provider "${config.provider ?? 'unknown'}". ` +
				`Pass a configured plugin via the \`llm\` option, e.g. createAiSdkLLM({ providers: { ${config.provider ?? '...'}: ${config.provider ?? '...'} } }), ` +
				`or opt into AI Gateway with createAiSdkLLM({ gateway: true }) (requires AI_GATEWAY_API_KEY).`,
		)
	}

	function toAiTools(
		tools: Record<string, AdaptToolSpec> | undefined,
	): Record<string, unknown> | undefined {
		if (!tools) return undefined
		return Object.fromEntries(
			Object.entries(tools).map(([name, spec]) => [
				name,
				aiTool({
					description: spec.description,
					inputSchema: spec.inputSchema as never,
				}),
			]),
		)
	}

	function toAiOutput(output: AdaptOutputSpec | undefined) {
		if (!output || output.type === 'text') return undefined
		return AiOutput.object({
			schema: output.schema,
			...(output.name ? { name: output.name } : {}),
			...(output.description ? { description: output.description } : {}),
		})
	}

	function toAiMessages(messages: AdaptMessage[]): ModelMessage[] {
		return messages.map((message) => {
			if (message.role === 'user') {
				return {
					role: 'user',
					content: contentToText(message.content),
				} satisfies ModelMessage
			}

			if (message.role === 'assistant') {
				const content: Array<Record<string, unknown>> = []
				const text = contentToText(message.content)
				if (text) content.push({ type: 'text', text })
				for (const toolCall of message.toolCalls ?? []) {
					content.push({
						type: 'tool-call',
						toolCallId: toolCall.toolCallId,
						toolName: toolCall.toolName,
						input: toolCall.input,
					})
				}
				return {
					role: 'assistant',
					content,
				} as ModelMessage
			}

			return {
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: message.toolCallId,
						toolName: message.toolName,
						output: {
							type: 'json',
							value: jsonSafe(firstJsonContent(message.content) ?? contentToText(message.content)),
						},
					},
				],
			} as ModelMessage
		})
	}

	const plugin: AdaptLLMPlugin<AdaptModelConfig<'ai-sdk'>> & {
		resolveModel(config: AdaptModelConfig<'ai-sdk'>): AiLanguageModel
	} = {
		id: DEFAULT_PLUGIN_ID,
		model: { toConfig },
		resolveModel,
		async call<TJson = any>(
			request: AdaptModelTurnRequest<AdaptModelConfig<'ai-sdk'>>,
		): Promise<AdaptModelTurnResult<TJson>> {
			// Plugin.call always runs a single model turn — Adapt's pipeline
			// owns the multi-step loop. Strip any AI SDK multi-step controls
			// (stopWhen, maxSteps) that may have leaked through settings, and
			// do NOT pass our own stopWhen — AI SDK's default is single-step.
			const {
				stopWhen: _stopWhen,
				maxSteps: _maxSteps,
				...settings
			} = (request.settings ?? {}) as Record<string, unknown>
			const result = await generateText({
				model: resolveModel(request.model),
				...(request.system ? { system: request.system } : {}),
				messages: toAiMessages(request.messages),
				output: toAiOutput(request.output),
				tools: toAiTools(request.tools) as never,
				toolChoice: request.toolChoice as never,
				abortSignal: request.signal,
				...settings,
			} as any)

			// `result.output` is a getter that throws `NoOutputGeneratedError`
			// when no `output: Output.object(...)` was requested — guard against
			// that and return `undefined` instead.
			let json: TJson | undefined
			if (request.output && request.output.type === 'object') {
				try {
					json = result.output as TJson
				} catch {
					json = undefined
				}
			}

			return {
				text: result.text,
				json,
				toolCalls: result.toolCalls.map((toolCall) => ({
					type: 'tool-call',
					toolCallId: toolCall.toolCallId,
					toolName: toolCall.toolName,
					input: 'input' in toolCall ? toolCall.input : undefined,
					providerMetadata: toolCall.providerMetadata,
				})),
				usage: {
					inputTokens: result.usage?.inputTokens,
					outputTokens: result.usage?.outputTokens,
					totalTokens: result.usage?.totalTokens,
				},
				finishReason: normalizeFinishReason(result.finishReason),
				providerMetadata: result.providerMetadata,
				raw: result,
			}
		},
		async streamCall(request) {
			// Streaming path: tools get their execute fns wired through to AI
			// SDK so it can auto-execute mid-stream. Non-streaming `call` above
			// strips execute by going through `toAiTools`; here we want it.
			const aiTools = request.tools
				? Object.fromEntries(
						Object.entries(request.tools).map(([name, t]) => [
							name,
							aiTool({
								description: t.description,
								inputSchema: t.inputSchema as never,
								...(t.execute ? { execute: t.execute as never } : {}),
							}),
						]),
					)
				: undefined

			const aiResult = aiStreamText({
				model: resolveModel(request.model),
				...(request.system ? { system: request.system } : {}),
				messages: toAiMessages(request.messages),
				output: toAiOutput(request.output),
				tools: aiTools as never,
				toolChoice: request.toolChoice as never,
				abortSignal: request.signal,
				...(request.settings ?? {}),
			} as Parameters<typeof aiStreamText>[0])

			const fullStream: AsyncIterable<AdaptModelStreamEvent> = (async function* () {
				for await (const part of aiResult.fullStream) {
					if (part.type === 'text-delta') {
						yield { type: 'text-delta', text: part.text, raw: part }
					} else if (part.type === 'tool-call') {
						yield {
							type: 'tool-call',
							toolCall: {
								type: 'tool-call',
								toolCallId: part.toolCallId,
								toolName: part.toolName,
								input: 'input' in part ? part.input : undefined,
								providerMetadata: part.providerMetadata,
							},
							raw: part,
						}
					} else if (part.type === 'finish') {
						yield {
							type: 'usage',
							usage: {
								inputTokens: part.totalUsage?.inputTokens,
								outputTokens: part.totalUsage?.outputTokens,
								totalTokens: part.totalUsage?.totalTokens,
							},
							raw: part,
						}
						yield {
							type: 'finish',
							finishReason: normalizeFinishReason(part.finishReason),
							raw: part,
						}
					}
				}
			})()

			return {
				textStream: aiResult.textStream,
				fullStream,
				text: Promise.resolve(aiResult.text),
				usage: Promise.resolve(aiResult.totalUsage).then((u) => ({
					inputTokens: u?.inputTokens,
					outputTokens: u?.outputTokens,
					totalTokens: u?.totalTokens,
				})),
				toolCalls: Promise.resolve(aiResult.toolCalls).then((calls) =>
					calls.map((toolCall) => ({
						type: 'tool-call' as const,
						toolCallId: toolCall.toolCallId,
						toolName: toolCall.toolName,
						input: 'input' in toolCall ? toolCall.input : undefined,
						providerMetadata: toolCall.providerMetadata,
					})),
				),
				steps: Promise.resolve(aiResult.steps).then((aiSteps) =>
					aiSteps.map((s) => ({
						text: s.text ?? '',
						output: undefined,
						toolCalls: (s.toolCalls ?? []).map((toolCall) => ({
							type: 'tool-call' as const,
							toolCallId: toolCall.toolCallId,
							toolName: toolCall.toolName,
							input: 'input' in toolCall ? toolCall.input : undefined,
							providerMetadata: toolCall.providerMetadata,
						})),
						toolResults: (s.toolResults ?? []).map((r) => ({
							type: 'tool-result' as const,
							toolCallId: r.toolCallId,
							toolName: r.toolName,
							output: 'output' in r ? r.output : undefined,
						})),
						usage: {
							inputTokens: s.usage?.inputTokens,
							outputTokens: s.usage?.outputTokens,
							totalTokens: s.usage?.totalTokens,
						},
					})),
				),
			}
		},
	}

	return plugin
}

/**
 * Resolve a runtime LLM plugin for a Brain or Neuron from the user's config.
 *
 * Precedence:
 * 1. Explicit `llm` plugin instance — used as-is. Covers BYO runtimes.
 * 2. Build a fresh default AI SDK plugin and pre-cache any live AI SDK
 *    models found in `models`. Covers the common case where the user passes
 *    `model: openai('gpt-4o')` and never thinks about plugins.
 *
 * If `llm` is not given AND no live AI SDK models are passed, returns an
 * AI SDK plugin with no providers — calls will throw a clear "register a
 * provider" error on first use, which is the right failure mode.
 */
export function resolveRuntimeLLM(opts: {
	llm?: AdaptLLMPlugin
	models?: Array<LanguageModel | undefined>
}): AdaptLLMPlugin {
	if (opts.llm) return opts.llm
	const plugin = createAiSdkLLM()
	for (const model of opts.models ?? []) {
		if (model === undefined) continue
		try {
			// Side-effect: caches live AI SDK models so they resolve back later.
			plugin.model.toConfig(model)
		} catch {
			// Non-AI-SDK input we can't normalize — skip silently. The first LLM
			// call will throw with a helpful message if the model isn't usable.
		}
	}
	return plugin
}

// ── Adapt semantic pipeline ────────────────────────────────────────────────

export async function generate<TJson = any>(
	params: AdaptGenerateRequest,
): Promise<AdaptGenerateResult<TJson>> {
	const {
		llm,
		model,
		system,
		prompt,
		messages: initialMessages,
		output,
		repairSchema,
		tools,
		toolChoice,
		stopWhen,
		maxSteps,
		onStepFinish,
		metadata,
		pluginOptions,
		abortSignal,
		...settings
	} = params

	const plugin = llm
	const modelConfig = isAdaptModelConfig(model)
		? (model as AdaptModelConfig)
		: plugin.model.toConfig(model)
	plugin.model.validateConfig?.(modelConfig)

	const messages = normalizeMessages(prompt, initialMessages)
	const stopConditions = normalizeStopConditions(stopWhen, maxSteps)
	const steps: AdaptStepResult[] = []
	const allToolCalls: AdaptToolCall[] = []
	const allToolResults: AdaptToolResult[] = []
	const totalUsage: Required<AdaptUsage> = {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	}

	let finalText = ''
	let finalOutput: unknown
	let finishReason: AdaptFinishReason = 'unknown'
	let providerMetadata: unknown
	let raw: unknown

	while (true) {
		let turn: AdaptModelTurnResult<unknown>
		try {
			turn = await plugin.call({
				model: modelConfig,
				system,
				messages,
				output,
				tools,
				toolChoice,
				settings,
				metadata,
				pluginOptions,
				signal: abortSignal,
			})
		} catch (error) {
			const repaired = tryRepairStructuredError(error, output, repairSchema)
			if (!repaired.repaired) throw error
			turn = {
				text: '',
				json: repaired.output,
				toolCalls: [],
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				finishReason: 'stop',
			}
		}

		const toolCalls = turn.toolCalls ?? []
		const toolResults = await executeToolCalls(toolCalls, tools, messages)
		const outputValue = validateOutput(turn, output, repairSchema)
		const step: AdaptStepResult = {
			text: turn.text ?? '',
			output: outputValue,
			toolCalls,
			toolResults,
			usage: turn.usage,
		}

		steps.push(step)
		allToolCalls.push(...toolCalls)
		allToolResults.push(...toolResults)
		addUsage(totalUsage, turn.usage)

		finalText = turn.text ?? ''
		finalOutput = outputValue
		finishReason = turn.finishReason ?? 'unknown'
		providerMetadata = turn.providerMetadata
		raw = turn.raw

		await onStepFinish?.(step)

		// Stop conditions:
		// - User-supplied stopWhen / maxSteps reached.
		// - No tool calls at all → model is done responding.
		// - No executable tool calls → only sentinel tools (e.g. `complete`,
		//   `generateResponse`) were called; the caller reads those from
		//   `result.toolCalls` and decides what to do.
		const shouldStop = await isStop(stopConditions, steps)
		const executedCount = toolResults.length
		if (shouldStop || toolCalls.length === 0 || executedCount === 0) {
			break
		}

		// Continue the loop. Append the assistant's tool calls + matching tool
		// results. AI SDK requires every tool_call in an assistant message to
		// have a matching tool_result before the next call, so we synthesize
		// empty results for sentinel tool calls (no `execute`).
		messages.push({
			role: 'assistant',
			content: turn.text ? [{ type: 'text', text: turn.text }] : [],
			toolCalls,
		})
		const resultByCallId = new Map(
			toolResults.map((r) => [r.toolCallId, r] as const),
		)
		for (const toolCall of toolCalls) {
			const result = resultByCallId.get(toolCall.toolCallId)
			messages.push({
				role: 'tool',
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				content: [
					{
						type: 'json',
						value: result
							? jsonSafe(result.output)
							: { ok: true, message: 'tool call acknowledged' },
					},
				],
			})
		}
	}

	return {
		text: finalText,
		output: finalOutput as TJson,
		reasoning: [],
		reasoningText: undefined,
		toolCalls: allToolCalls,
		toolResults: allToolResults,
		steps,
		finishReason,
		usage: totalUsage,
		providerMetadata,
		raw,
	}
}

export async function streamText(
	params: AdaptGenerateRequest,
): Promise<AdaptStreamResult> {
	const {
		llm,
		model,
		system,
		prompt,
		messages: initialMessages,
		output,
		tools,
		toolChoice,
		stopWhen,
		maxSteps,
		metadata,
		pluginOptions,
		abortSignal,
		repairSchema: _repairSchema,
		onStepFinish: _onStepFinish,
		...settings
	} = params

	if (!llm.streamCall) {
		throw new Error(
			`Plugin "${llm.id}" does not implement streamCall. Streaming requires a plugin with a streamCall method.`,
		)
	}

	const modelConfig = isAdaptModelConfig(model)
		? (model as AdaptModelConfig)
		: llm.model.toConfig(model)
	llm.model.validateConfig?.(modelConfig)

	// Pass through AI-SDK-shaped loop control via settings — same shape as the
	// non-streaming `generate` path, just unstripped (streaming wants stopWhen).
	const streamSettings: AdaptCallSettings = {
		...(settings as AdaptCallSettings),
		...(stopWhen !== undefined ? { stopWhen } : {}),
		...(maxSteps !== undefined ? { maxSteps } : {}),
		...(toolChoice !== undefined ? { toolChoice } : {}),
	} as AdaptCallSettings

	return llm.streamCall({
		model: modelConfig,
		system,
		messages: normalizeMessages(prompt, initialMessages),
		output,
		tools,
		toolChoice,
		settings: streamSettings,
		metadata,
		pluginOptions,
		signal: abortSignal,
	})
}

function normalizeMessages(
	prompt: string | undefined,
	messages: AdaptMessage[] | undefined,
): AdaptMessage[] {
	if (messages?.length) return [...messages]
	if (prompt !== undefined) {
		return [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
	}
	return [{ role: 'user', content: [{ type: 'text', text: '' }] }]
}

async function executeToolCalls(
	toolCalls: AdaptToolCall[],
	tools: Record<string, AdaptTool> | undefined,
	messages: AdaptMessage[],
): Promise<AdaptToolResult[]> {
	if (!tools) return []
	const results: AdaptToolResult[] = []
	for (const toolCall of toolCalls) {
		const toolDef = tools[toolCall.toolName]
		if (!toolDef?.execute) continue
		const output = await toolDef.execute(toolCall.input, {
			toolCallId: toolCall.toolCallId,
			toolName: toolCall.toolName,
			messages,
		})
		results.push({
			type: 'tool-result',
			toolCallId: toolCall.toolCallId,
			toolName: toolCall.toolName,
			output,
		})
	}
	return results
}

function normalizeStopConditions(
	stopWhen: StopCondition | StopCondition[] | undefined,
	maxSteps: number | undefined,
): StopCondition[] {
	if (stopWhen) return Array.isArray(stopWhen) ? stopWhen : [stopWhen]
	return [stepCountIs(maxSteps ?? 1)]
}

async function isStop(
	conditions: StopCondition[],
	steps: AdaptStepResult[],
): Promise<boolean> {
	for (const condition of conditions) {
		if (await condition({ steps })) return true
	}
	return false
}

function validateOutput(
	turn: AdaptModelTurnResult,
	output: AdaptOutputSpec | undefined,
	repairSchema: ZodSchema | undefined,
): unknown {
	if (!output || output.type === 'text') return undefined
	const schema = output.schema ?? repairSchema
	if (turn.json !== undefined) {
		return schema.parse(turn.json)
	}
	if (turn.text) {
		const repaired = repairJson(turn.text)
		const parsed = JSON.parse(repaired)
		const clamped = clampNumericFields(parsed, schema)
		return schema.parse(clamped)
	}
	return undefined
}

function tryRepairStructuredError(
	error: unknown,
	output: AdaptOutputSpec | undefined,
	repairSchema: ZodSchema | undefined,
): { repaired: true; output: unknown } | { repaired: false } {
	const schema = output?.type === 'object' ? output.schema : repairSchema
	if (!schema) return { repaired: false }
	if (!(error instanceof NoObjectGeneratedError) || !error.text) {
		return { repaired: false }
	}

	console.error(
		'[LLM] NoObjectGeneratedError — raw text (%d chars):',
		error.text.length,
		error.text.slice(0, 500),
	)

	try {
		const repaired = repairJson(error.text)
		const parsed = JSON.parse(repaired)
		const clamped = clampNumericFields(parsed, schema)
		return { repaired: true, output: schema.parse(clamped) }
	} catch (repairError) {
		console.error(
			'[LLM] JSON repair failed:',
			repairError instanceof Error ? repairError.message : repairError,
		)
		return { repaired: false }
	}
}

function addUsage(total: Required<AdaptUsage>, usage: AdaptUsage | undefined) {
	total.inputTokens += usage?.inputTokens ?? 0
	total.outputTokens += usage?.outputTokens ?? 0
	total.totalTokens += usage?.totalTokens ?? 0
}

function normalizeFinishReason(reason: string | undefined): AdaptFinishReason {
	if (
		reason === 'stop' ||
		reason === 'length' ||
		reason === 'tool-calls' ||
		reason === 'error'
	) {
		return reason
	}
	return 'unknown'
}

function contentToText(content: AdaptContent[]): string {
	return content
		.map((part) =>
			part.type === 'text' ? part.text : JSON.stringify(part.value),
		)
		.join('\n')
}

function firstJsonContent(content: AdaptContent[]): unknown {
	for (const part of content) {
		if (part.type === 'json') return part.value
	}
	return undefined
}

function jsonSafe(value: unknown): JsonValue {
	if (value === undefined) return null
	return JSON.parse(JSON.stringify(value)) as JsonValue
}

// ============================================================================
// Numeric Clamping (for providers that don't enforce min/max)
// ============================================================================

function clampNumericFields(obj: unknown, schema: ZodSchema): unknown {
	if (obj == null) return obj

	let jsonSchema: Record<string, unknown>
	try {
		jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
	} catch {
		return obj
	}

	return clampWithJsonSchema(obj, jsonSchema)
}

function clampWithJsonSchema(
	obj: unknown,
	schema: Record<string, unknown>,
): unknown {
	if (obj == null) return obj

	if (typeof obj === 'number' && schema.type === 'number') {
		let value = obj
		if (typeof schema.minimum === 'number' && value < schema.minimum)
			value = schema.minimum
		if (typeof schema.maximum === 'number' && value > schema.maximum)
			value = schema.maximum
		return value
	}

	if (typeof obj === 'object' && !Array.isArray(obj) && schema.properties) {
		const props = schema.properties as Record<string, Record<string, unknown>>
		const result: Record<string, unknown> = {
			...(obj as Record<string, unknown>),
		}
		for (const [key, fieldSchema] of Object.entries(props)) {
			if (key in result) {
				result[key] = clampWithJsonSchema(result[key], fieldSchema)
			}
		}
		return result
	}

	if (Array.isArray(obj) && schema.items) {
		const itemSchema = schema.items as Record<string, unknown>
		return obj.map((item) => clampWithJsonSchema(item, itemSchema))
	}

	return obj
}

// ============================================================================
// JSON Repair Pipeline
// ============================================================================

function repairJson(text: string): string {
	let repaired = text
	repaired = stripMarkdownCodeBlock(repaired)
	repaired = stripGarbagePrefix(repaired)
	repaired = fixDoubleBrace(repaired)
	repaired = fixQuotedObjectPrefix(repaired)
	repaired = repairJsonNewlines(repaired)
	return repaired
}

function stripMarkdownCodeBlock(text: string): string {
	return text
		.replace(/^```(?:json)?\s*\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim()
}

function stripGarbagePrefix(text: string): string {
	const jsonStartPattern = /\{\s*"[a-zA-Z_]/
	const match = text.match(jsonStartPattern)

	if (match && match.index !== undefined) {
		return text.slice(match.index)
	}

	const loosePattern = /\{\s*"/
	const looseMatch = text.match(loosePattern)
	if (looseMatch && looseMatch.index !== undefined) {
		return text.slice(looseMatch.index)
	}

	return text
}

function fixDoubleBrace(text: string): string {
	return text.replace(/^\{\s*\{/, '{')
}

function fixQuotedObjectPrefix(text: string): string {
	const quotedObjectPattern = /^"\s*\{/
	if (quotedObjectPattern.test(text)) {
		return text.replace(/^"\s*/, '')
	}
	return text
}

function repairJsonNewlines(text: string): string {
	let result = ''
	let inString = false
	let escaped = false

	for (let i = 0; i < text.length; i++) {
		const char = text[i]

		if (escaped) {
			result += char
			escaped = false
			continue
		}

		if (char === '\\') {
			result += char
			escaped = true
			continue
		}

		if (char === '"') {
			inString = !inString
			result += char
			continue
		}

		if (inString && (char === '\n' || char === '\r')) {
			result += '\\n'
		} else {
			result += char
		}
	}

	return result
}
