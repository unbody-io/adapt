# Task: Instruction Flexibility

## Why

Instructions go through LLM interpretation to generate observer/understand identities. The original text is never in the runtime prompt. Complex or demanding instructions may get diluted — "track ONLY X, ignore Y" could become a generic identity that tracks the broad domain.

We don't know how bad this actually is. Need to test first.

## Verification (Phase 1 — before any changes)

Write `evals/scripts/learner-instruction-fidelity-eval.ts`. Feed various instruction styles into `initObserve` and `initUnderstand`, log the generated blueprints, then feed test data through and check if instructions were honored. Save results to `evals/reports/`.

Instruction styles to test:

- **Simple** (1-2 sentences): "Track mentions of TypeScript features"
- **Specific** (constrained): "Track ONLY CSS Grid and Flexbox. Ignore all other CSS properties."
- **Behavioral** (override defaults): "Accept everything — never dismiss any data."
- **Format** (affect output): "Present understanding as CONFIRMED: [...], SUSPECTED: [...], CONTRADICTED: [...]"
- **Complex** (multi-part with watch-for lists and questions)

For each: log generated identity, feed test data, check accept/dismiss decisions match intent.

## Implementation (Phase 2 — combined with Playbook Alignment if both verified)

Based on eval results, decide the fix:

- If only behavioral overrides fail → passthrough spec already handles "accept everything" cases, just improve identity prompt to preserve specificity
- If instructions are routinely diluted → inject raw instructions into the runtime system prompt
- If unpredictable → add structured override sections to learner config

Re-run same eval after changes. Compare baseline vs new results.
