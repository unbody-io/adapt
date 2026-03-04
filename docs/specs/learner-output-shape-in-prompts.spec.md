# Task: Output Shape in Prompts

## Why

Some models (especially via OpenRouter) don't reliably follow structured output schemas alone. The text learner understand prompt already includes the expected JSON format inline — but the observer and list learner don't consistently do this. We're seeing truncated/malformed JSON from Gemini.

Need to research whether redundant schema-in-prompt actually helps, then apply consistently if it does.

## What

1. Web search for best practices on structured output with Gemini/OpenRouter — does including the expected shape in the prompt text improve reliability vs schema-only?
2. Audit all LLM calls in the learner pipeline — which ones include output format in the prompt text vs rely on schema alone?
3. If evidence supports it, add the expected JSON shape to prompts that are missing it.

## Where

- `src/learners/observer/prompts/system.ts` — already has format in prompt (check if adequate)
- `src/learners/text-learner/understand/prompts/system.ts` — already has format in prompt
- `src/learners/list-learner/understand/index.ts` — tool-driven, no explicit format
- `src/learners/observer/prompts/identity.ts` — has format hint
- `src/learners/text-learner/understand/prompts/identity.ts` — has format hint

## Verify

Run existing evals before and after. Track rate of `NoObjectGeneratedError` / JSON parse failures.
