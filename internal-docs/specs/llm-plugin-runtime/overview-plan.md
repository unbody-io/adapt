# LLM Plugin Runtime Redesign

**Issue**: closes [#9](https://github.com/unbody-io/adapt/issues/9).

**Status**: draft implementation spec.

---

## Problem

Adapt currently treats AI SDK `LanguageModel` values as both:

1. **Model identity** — the thing persisted to the store.
2. **Runtime execution capability** — the thing passed to `generateText` / `streamText`.

Those are different concerns. A model can be represented as JSON and persisted. The runtime behavior that calls an LLM cannot: it may include provider functions, credentials, retry policy, tracing, Effect services, local clients, custom routing, or other closures.

The current restore path serializes model slots as `{ provider, modelId }`, then deserializes them as AI SDK `"provider:modelId"` strings. AI SDK interprets those strings through Vercel AI Gateway, so direct-provider users hit `GatewayAuthenticationError` after:

```ts
const brain = await Brain.restore("./brain.db")
await brain.ask("...")
```

The root bug is not only the Gateway fallback. The deeper issue is that Adapt core is too coupled to AI SDK as its LLM execution contract.

---

## Goals

- Keep `Brain.create(config)` and `Brain.restore(pathOrStore)` as the public lifecycle API.
- Persist model identity as runtime-agnostic JSON model config.
- Move LLM execution behind an Adapt-owned plugin contract.
- Keep AI SDK as the default plugin, not as Adapt core's semantic contract.
- Let users bring their own LLM runtime by implementing the plugin contract.
- Make `Brain.restore(pathOrStore)` work without re-passing `model` every time, provided the needed plugin/runtime is registered for the process.
- Ensure restored direct-provider models never silently fall back to AI Gateway strings.
- Centralize all LLM use cases through one Adapt semantic pipeline: text, structured output, tools, tool loops, usage aggregation, and streaming.

## Non-goals

- Replacing `Brain.create` / `Brain.restore` with a new runtime object API.
- Persisting runtime functions, provider clients, secrets, hooks, or closures.
- Making Adapt core understand provider-specific model semantics like `openai`, `google`, or `anthropic`.
- Guaranteeing `Brain.restore(path)` can run after process restart with no registered runtime and no Gateway. There must be some process-local execution capability.
- Shipping a first-class integration for every runtime in the initial change.

---

## Core Distinction

Model config is data:

```ts
{
  plugin: "ai-sdk",
  provider: "openai",
  id: "gpt-4o",
  options: {}
}
```

LLM execution is behavior:

```ts
plugin.call({
  model,
  system,
  messages,
  output,
  tools,
})
```

Adapt core persists and passes model config. The active plugin decides what that config means at runtime.

Core must not do this:

```ts
if (model.provider === "openai") return openai(model.id)
```

The AI SDK plugin may do that. An Effect plugin, Ollama plugin, LangChain plugin, or in-house plugin may do something completely different with the same persisted config shape.

---

## Public API

### Existing Lifecycle Stays

```ts
const brain = await Brain.create({
  prompt,
  model: openai("gpt-4o"),
})

const restored = await Brain.restore("./brain.db")
```

`Brain.create` and `Brain.restore` remain the public entry points.

### Fresh Create With Default AI SDK Plugin

Fresh create with a live AI SDK model keeps working without setup:

```ts
const brain = await Brain.create({
  prompt,
  model: openai("gpt-4o"),
})
```

The default AI SDK plugin can normalize the live model into persisted model config:

```ts
{
  plugin: "ai-sdk",
  provider: "openai",
  id: "gpt-4o"
}
```

### Create With Explicit Plugin Runtime

Users can provide a runtime plugin at create time:

```ts
const brain = await Brain.create({
  prompt,
  model: {
    plugin: "effect",
    provider: "openai",
    id: "gpt-4o",
  },
  llm: effectLLM,
})
```

The `llm` value is runtime-only. It is not persisted.

### Process-Level Runtime Registration

Because `Brain.restore(pathOrStore)` remains single-argument, restored brains need a process-level way to find runtime plugins:

```ts
Brain.configure({
  llm: createAiSdkLLM({
    providers: {
      openai,
      google,
    },
  }),
})

const brain = await Brain.restore("./brain.db")
```

`Brain.configure({ llm })` is not required for the default fresh-create path. It is needed when restore must interpret persisted model config without receiving a live model object again.

The configure API can also support multiple plugins:

```ts
Brain.configure({
  plugins: [aiSdkLLM, effectLLM],
})
```

Initial implementation can choose either `llm` for a single default plugin or `plugins` for a registry. The model config includes `plugin` so multiple-plugin support is the long-term shape.

---

## Model Config

```ts
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type AdaptModelConfig<
  TPlugin extends string = string,
  TProvider extends string = string,
  TOptions extends JsonObject = JsonObject,
> = {
  plugin?: TPlugin
  provider?: TProvider
  id: string
  options?: TOptions
}
```

Rules:

- Model config must be JSON-serializable.
- `id` is the plugin-facing model identifier.
- `plugin` identifies which runtime plugin should handle the model.
- `provider` is optional and plugin-owned. Adapt persists it but does not interpret it.
- `options` is plugin-owned, non-secret configuration.
- Secrets do not belong in persisted model config.

Existing AI SDK `LanguageModel` input is supported by the AI SDK plugin's `toConfig()` normalization.

---

## Plugin Anatomy

Adapt owns the semantic pipeline. Plugins own model IO.

```ts
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
  ): AsyncIterable<AdaptModelStreamEvent<TRaw>>
}
```

Plugin responsibilities:

- Convert supported model inputs into persisted model config.
- Validate plugin-specific model config.
- Execute one model turn.
- Convert provider-specific responses into Adapt's fixed minimum envelope.
- Preserve provider-specific data under `raw` / `providerMetadata`.

Plugin non-responsibilities:

- Persisting state.
- Executing Adapt tools.
- Owning the Adapt tool loop.
- Owning schema validation semantics.
- Deciding cross-step stop behavior.

---

## Turn Request

The plugin boundary is message-based.

```ts
export type AdaptModelTurnRequest<
  TModel extends AdaptModelConfig = AdaptModelConfig,
  TPluginOptions = unknown,
> = {
  model: TModel
  system?: string
  messages: AdaptMessage[]
  output?: AdaptOutputSpec
  tools?: Record<string, AdaptToolSpec>
  settings?: AdaptCallSettings
  metadata?: AdaptCallMetadata
  pluginOptions?: TPluginOptions
  signal?: AbortSignal
}
```

### Messages

```ts
export type AdaptMessage =
  | { role: "user"; content: AdaptContent[] }
  | {
      role: "assistant"
      content: AdaptContent[]
      toolCalls?: AdaptToolCall[]
    }
  | {
      role: "tool"
      toolCallId: string
      toolName: string
      content: AdaptContent[]
    }

export type AdaptContent =
  | { type: "text"; text: string }
  | { type: "json"; value: unknown }
```

`system` is separate from `messages` because providers differ in how system instructions are represented. Plugins map `system` to their runtime correctly.

`prompt` can exist as a convenience field on Adapt's high-level `generate()` function, but it is normalized into a user message before reaching the plugin.

### Output

The request field is named `output`, not `responseFormat`.

```ts
export type AdaptOutputSpec =
  | { type: "text" }
  | {
      type: "object"
      schema: unknown
      name?: string
      description?: string
    }
```

Adapt owns validation of `output.type === "object"` against the schema. Plugins may use provider-native structured output when available, but the final result must still be validated by Adapt.

### Tools

Plugins receive tool specs, not executable functions:

```ts
export type AdaptToolSpec = {
  description?: string
  inputSchema: unknown
}

export type AdaptTool = AdaptToolSpec & {
  execute(input: unknown, context: AdaptToolContext): Promise<unknown>
}
```

The plugin may use native tool-calling APIs to make the model emit tool calls. Adapt executes the tool functions, appends tool-result messages, and decides whether to continue the loop.

### Settings

`settings` means provider-neutral generation controls:

```ts
export type AdaptCallSettings = {
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  seed?: number
}
```

These are not plugin configuration. They are per-call generation controls Adapt already passes around today via AI SDK `CallSettings`.

If a plugin does not support a setting, it may ignore it or emit a warning in provider metadata. Plugin-specific knobs go in `pluginOptions`, not `settings`.

### Metadata

```ts
export type AdaptCallMetadata = {
  purpose:
    | "brain:init"
    | "brain:ask"
    | "brain:inspect"
    | "brain:evolution"
    | "neuron:observe"
    | "neuron:understand"
    | "neuron:query"
    | "neuron:strategy"
    | string
  brainId?: string
  neuronId?: string
  operationId?: string
}
```

Metadata is for tracing, logging, routing, and observability. It must not affect Adapt semantics unless a plugin explicitly chooses to use it.

---

## Turn Result

The result can be generic, but it must include Adapt's fixed minimum envelope.

```ts
export type AdaptModelTurnResult<TJson = unknown, TRaw = unknown> = {
  text?: string
  json?: TJson
  toolCalls?: AdaptToolCall[]
  usage?: AdaptUsage
  finishReason?: "stop" | "length" | "tool-calls" | "error" | "unknown"
  providerMetadata?: unknown
  raw?: TRaw
}
```

Generics provide freedom for:

- structured output type (`TJson`)
- plugin-specific raw provider result (`TRaw`)
- plugin-specific model config
- plugin-specific options

The minimum envelope is fixed because Adapt internally needs to know whether the model produced text, structured JSON, tool calls, usage, and a stop reason.

---

## Adapt Semantic Pipeline

Plugins execute one model turn. Adapt owns the higher-level generation behavior.

```ts
export async function generate<TJson = unknown>(
  request: AdaptGenerateRequest,
): Promise<AdaptGenerateResult<TJson>>
```

High-level request:

```ts
export type AdaptGenerateRequest<
  TModel extends AdaptModelConfig = AdaptModelConfig,
  TPluginOptions = unknown,
> = {
  model: TModel
  system?: string
  prompt?: string
  messages?: AdaptMessage[]
  output?: AdaptOutputSpec
  tools?: Record<string, AdaptTool>
  maxSteps?: number
  settings?: AdaptCallSettings
  metadata?: AdaptCallMetadata
  pluginOptions?: TPluginOptions
  signal?: AbortSignal
}
```

Pipeline responsibilities:

1. Normalize `prompt` into `messages`.
2. Resolve the plugin from `model.plugin` or the configured default.
3. Convert executable tools into tool specs before calling the plugin.
4. Call `plugin.call()` for one model turn.
5. Validate object output against `output.schema`.
6. Apply JSON repair fallback when structured output fails and text is available.
7. Execute tool calls.
8. Append assistant/tool messages.
9. Repeat until `maxSteps`, no tool calls, or terminal finish reason.
10. Aggregate usage across turns.
11. Return Adapt's normalized result.

This keeps behavior consistent across AI SDK and BYO plugins. A plugin can use native provider features internally, but Adapt remains the observable semantic contract.

---

## Streaming

Streaming should return Adapt-owned events, not raw AI SDK `StreamTextResult`.

```ts
export type AdaptModelStreamEvent<TRaw = unknown> =
  | { type: "text-delta"; text: string; raw?: TRaw }
  | { type: "json-delta"; value: unknown; raw?: TRaw }
  | { type: "tool-call"; toolCall: AdaptToolCall; raw?: TRaw }
  | { type: "usage"; usage: AdaptUsage; raw?: TRaw }
  | { type: "finish"; finishReason: AdaptFinishReason; raw?: TRaw }
  | { type: "error"; error: unknown; raw?: TRaw }
```

Initial implementation may keep existing raw stream behavior temporarily behind compatibility wrappers, but the target public contract for true BYO is Adapt stream events.

---

## AI SDK Plugin

AI SDK remains the default plugin.

```ts
const aiSdkLLM = createAiSdkLLM({
  providers: {
    openai,
    google,
    anthropic,
  },
})
```

The AI SDK plugin owns mapping persisted model config to AI SDK models:

```ts
function resolve(model: AdaptModelConfig) {
  if (model.provider === "openai") return openai(model.id)
  if (model.provider === "google") return google(model.id)
  if (model.provider === "anthropic") return anthropic(model.id)

  throw new Error(`Unsupported AI SDK provider: ${model.provider}`)
}
```

Adapt core does not contain this mapping.

Fresh create with a live AI SDK model works because the default plugin can inspect `model.provider` and `model.modelId` and persist:

```ts
{
  plugin: "ai-sdk",
  provider: model.provider,
  id: model.modelId
}
```

Restore direct-provider support requires the AI SDK plugin to be registered with provider functions for the providers used by the persisted model configs. If not registered, Adapt throws a clear plugin-resolution error.

### Packaging Decision

The architecture supports all AI SDK providers. The package strategy is separate:

- Keep core light and let users register provider functions.
- Provide optional batteries-included provider packages later.
- Avoid making Adapt core import every provider package unless dependency weight is explicitly accepted.

---

## Restore Semantics

On restore:

1. Store returns persisted model configs.
2. Brain and neurons keep those configs in state.
3. No model slot is deserialized into an AI SDK Gateway string.
4. The first LLM operation resolves a plugin and calls it with the persisted model config.

If no plugin can handle the model:

```txt
Cannot run model { plugin: "ai-sdk", provider: "openai", id: "gpt-4o" }.
Plugin "ai-sdk" is not registered for this process, or it cannot resolve provider "openai".
Register a compatible LLM plugin with Brain.configure(...).
```

This is preferable to leaking `GatewayAuthenticationError`.

---

## Implementation Plan

### Phase 1: Types and Runtime Registry

- Add Adapt LLM types under `src/llm/`.
- Add plugin registry and `Brain.configure(...)`.
- Preserve the current default AI SDK behavior for fresh create.
- Define conversion helpers for model config serialization.

### Phase 2: AI SDK Plugin

- Move direct AI SDK calls behind `createAiSdkLLM`.
- Map Adapt messages, output specs, tools, settings, and metadata to AI SDK calls.
- Convert AI SDK responses into `AdaptModelTurnResult`.
- Preserve JSON repair fallback in the Adapt pipeline.

### Phase 3: State Model Slots

- Change brain model slots from `LanguageModel` to `AdaptModelConfig`.
- Change neuron model slots from `LanguageModel` to `AdaptModelConfig`.
- Stop rehydrating models as `"provider:modelId"` strings.
- Update serialization/deserialization helpers.

### Phase 4: Call Site Migration

- Replace static imports of `generate`, `streamText`, `Output`, `tool`, and `stepCountIs` as core semantic dependencies.
- Route brain init, ask, inspect, evaluator, evolution, observer, understand, query, list schema generation, and text strategies through the Adapt pipeline.
- Convert tool definitions to Adapt tools.
- Convert `stepCountIs(n)` to `maxSteps: n`.
- Convert `Output.object({ schema })` to `output: { type: "object", schema }`.

### Phase 5: Restore and Error Behavior

- Ensure `Brain.restore(pathOrStore)` stays single-argument.
- Ensure standalone `TextNeuron.restore` / `ListNeuron.restore` get the same model/runtime behavior.
- Add actionable missing-plugin errors.
- Remove restore-time Gateway string fallback.

### Phase 6: Streaming

- Introduce Adapt stream events.
- Wrap or migrate existing streaming methods.
- Decide whether 0.0.6 keeps compatibility aliases for raw AI SDK stream results or makes the stream return type part of the breaking change.

### Phase 7: Tests

- Fresh `Brain.create({ model: openai(...) })` still works with no setup.
- Restored model slots are persisted configs, not Gateway strings.
- `Brain.restore(path)` followed by `ask()` uses a registered plugin without re-passing model.
- Missing plugin/provider throws an Adapt-owned error.
- Custom plugin handles create and restore.
- Structured output validates and repairs.
- Tool calls execute through Adapt's loop.
- Streaming emits Adapt stream events.
- Standalone neuron restore follows the same rules.

### Phase 8: Docs

- Replace restore-then-`update({ model })` warnings.
- Document model config vs runtime plugin.
- Document default AI SDK plugin behavior.
- Document `Brain.configure(...)`.
- Add custom plugin example.
- Add AI SDK provider resolver example.

---

## Open Decisions

- Exact registry API: `Brain.configure({ llm })`, `Brain.configure({ plugins })`, or both.
- AI SDK provider packaging strategy.
- Whether `settings` should remain named `settings` or become `callOptions`.
- Whether streaming compatibility with raw AI SDK `StreamTextResult` is kept temporarily.
- Whether model config uses `id` only, or stores both `id` and legacy `modelId` during migration.
