---
title: Models
description: Tested models and providers.
---

Adapt requires models that support tool calling and structured JSON output. The table below lists models we've tested. The list will be updated as we go.

| Provider    | Model                                                | Compatible | Notes                                                                                                          |
|-------------|------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------------------|
| OpenAI      | `gpt-4o-mini`                                        | ✓          |                                                                                                                |
| Google      | `gemini-2.5-flash`                                   | ✓          |                                                                                                                |
| Anthropic   | `claude-haiku-4-5`                                   | ✓          |                                                                                                                |
| OpenRouter  | `google/gemini-2.0-flash-001`                        | ✓          |                                                                                                                |
| OpenRouter  | `google/gemma-4-31b-it`                              | ✓          |                                                                                                                |
| OpenRouter  | `x-ai/grok-4.3`                                      | ✓          |                                                                                                                |
| OpenRouter  | `~openai/gpt-mini-latest`                            | ✓          |                                                                                                                |
| OpenRouter  | `~moonshotai/kimi-latest`                            | ✓          |                                                                                                                |
| OpenRouter  | `mistralai/ministral-3b-2512`                        | ✓          |                                                                                                                |
| OpenRouter  | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | ✗          | No endpoint supports `tool_choice`.                                                                            |
| OpenRouter  | `~anthropic/claude-haiku-latest`                     | ✗          | Provider error on structured output.                                                                           |
| OpenRouter  | `qwen/qwen3.6-flash`                                 | ✗          | Provider error on both calls.                                                                                  |
| Together.ai | `deepseek-ai/DeepSeek-V3.1`                          | ✗          | Together doesn't enforce structured output — model truncates large JSON.                                       |
| Together.ai | `Qwen/Qwen3.5-397B-A17B`                             | ✓          |                                                                                                                |
| Together.ai | `LiquidAI/LFM2-24B-A2B`                              | ✓          |                                                                                                                |
| Together.ai | `Qwen/Qwen3.5-9B`                                    | ✓          |                                                                                                                |
| Together.ai | `google/gemma-4-31B-it`                              | ✓          |                                                                                                                |
| LM Studio   | `liquid/lfm2.5-1.2b`                                 | ✓          | Disable the model's "Structured Output" toggle — server forces json-mode otherwise.                            |
| llama.cpp   | `LiquidAI/LFM2.5-1.2B-Instruct-GGUF`                 | ✗          | Tool calling works; default `llama-server` doesn't constrain JSON to the schema.                               |
