# Model Capabilities Matrix

Results from `npx tsx evals/scripts/model-capabilities.ts`

## Legend

- **Pass** = all tests passed
- **Partial** = some tests passed
- **Fail** = no tests passed
- **N/A** = not tested

## Results

| Model | Provider | Text | Structured Output | Tool Calling | SO + Tools | Reasoning | Score |
|-------|----------|------|-------------------|--------------|------------|-----------|-------|
| deepseek-r1:1.5b | ollama | Pass | Fail | Fail | Fail | Pass | 3/8 |
| strm-4b-v1 (Q4_K_M) | ollama | Pass | Partial | Partial | Fail | Pass | 5/8 |
| LFM2-1.2B-Tool (Q4_K_M) | ollama | Pass | Partial | Fail | Fail | Fail | 3/8 |
| qwen2.5:3b | ollama | Pass | Partial | Pass | Fail | Fail | 5/8 |
| qwen2.5:7b | ollama | Pass | Pass | Pass | Pass | Fail | 7/8 |
| liquid/lfm-2-24b-a2b | openrouter | - | Fail | Fail | - | - | 0/13 |

## Notes

### deepseek-r1:1.5b (ollama)
- Text + reasoning work fine
- No structured output support (model ignores JSON schema, outputs prose)
- Ollama reports "does not support tools" for this model

### strm-4b-v1 (Q4_K_M) (ollama)

- Text + reasoning work fine
- Structured output: 1/2 — promptContext passes, observeOutput fails (importance out of range)
- Tool calling: single tool call works, multi-step fails (skips search)
- SO + tools: fails — skips search

### qwen2.5:3b (ollama)

- Text + tool calling work perfectly (single + multi-step)
- Structured output: 1/2 — nullable fields (promptContext) pass, but numeric constraints violated (importance=2 instead of 0-1 range)
- SO + tools: calls search but doesn't call complete
- Not a reasoning model — no thinking deltas
- Provider fix: `supportsStructuredOutputs: true` needed in `@ai-sdk/openai-compatible` config

### qwen2.5:7b (ollama)

- 7/8 — all pass except reasoning (expected, not a reasoning model)
- Structured output: 2/2 after numeric clamping fix in `src/llm/index.ts`
- First model to pass SO + Tools (search → complete with structured input)

### LFM2-1.2B-Tool (Q4_K_M) (ollama)

- Text + structured output (partial) work
- Structured output: 1/2 — promptContext passes, observeOutput fails (importance out of range)
- Tool calling: Ollama says "does not support tools" despite model name
- No reasoning deltas

### liquid/lfm-2-24b-a2b (openrouter)
- Structured output: 0/8 — ignores schema entirely, returns markdown prose
- Tool calling: 0/5 — OpenRouter says "No endpoints found that support tool use"
