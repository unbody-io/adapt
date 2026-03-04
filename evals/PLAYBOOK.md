# Eval Playbook

## Rules

1. **Evals are not tests.** No pass/fail assertions. No green/red. No `assert*`, no `throw`. An eval produces raw output for semantic review — it never decides on its own whether something "passed."

2. **Evals are for semantic analysis.** We care about *quality of understanding*, *relevance of insight*, *behavioral patterns detected* — not mechanical correctness. The question is "did the learner understand?" not "did the function return true?"

3. **Raw output only.** No logging wrappers, no assertion libraries, no helper abstractions. Use `console.log` directly. Print the actual values — understanding text, query responses, event payloads, metrics. The output must be readable as-is by an LLM reviewing it.

4. **Claude Code is the reviewer.** Evals are designed to be run by Claude Code, which reads the raw console output, compares it against the eval's stated objectives (written as comments at the top of the file), and produces a semantic analysis report. The eval script's job is to surface the right data — the LLM's job is to judge it.

5. **Type-check before running.** Every eval must compile cleanly with `npx tsc --noEmit -p evals/tsconfig.json` before execution. Evals have their own tsconfig that extends the project config with looser settings (no unused locals, resolveJsonModule, etc).

6. **Cheap models by default.** Evals use OpenRouter with `google/gemini-2.0-flash-001` as the default model. Override via `MODEL` env var when needed. This keeps iteration fast and cheap.

## Eval Structure

```typescript
/**
 * Eval: <name>
 *
 * Objectives:
 *   1. <what we want to observe>
 *   2. <what we want to observe>
 *   3. <what we want to observe>
 *
 * Run:
 *   export $(cat .env.local | xargs) && npx tsx evals/scripts/<name>.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Setup ────────────────────────────────────────────────────────────────────

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Eval: <name>')
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}`)

	// ... setup learner/brain ...

	// ... run phases ...

	// ... console.log raw outputs at every step ...
}

main().catch((err) => {
	console.error('Eval crashed:', err)
	process.exit(1)
})
```

## What to Log

- Full understanding text after each synthesis
- Full query response (insight, confidence, relevance, gaps)
- Event payloads for key events (synthesized, observed, dismissed)
- Metrics snapshots at milestones
- Timing information

## What NOT to Do

- No `assert*` functions
- No pass/fail verdicts
- No logging wrappers (`logger.logSection`, `logger.logState`, etc)
- No try/catch swallowing errors to "continue"
- No programmatic comparison against ground truth — put ground truth in comments or the dataset metadata so the reviewer can compare

## Running Evals

```bash
# type-check
npx tsc --noEmit -p evals/tsconfig.json

# run
export $(cat .env.local | xargs) && npx tsx evals/scripts/<name>.ts

# run with different model
export $(cat .env.local | xargs) && MODEL=anthropic/claude-3.5-sonnet npx tsx evals/scripts/<name>.ts
```

## Reviewing Evals

Claude Code runs the eval, reads the output, and checks it against the objectives listed in the file header comment. It produces a report like:

```
## Eval Report: <name>

### Objective 1: <description>
<semantic analysis of whether the output satisfies this>

### Objective 2: <description>
<semantic analysis>

### Overall
<summary + notable observations>
```
