# Task: Observe Passthrough Mode

## Why

Internal learners receive pre-curated system data. The observer wastes LLM calls and actively rejects valid data (query gap learner: 75% dismissal rate).

## What

Add `passthrough: boolean` to learner governance config. When true, `learn()` skips observe — data goes straight to the buffer with importance 1.0. No LLM call. Understand phase runs normally.

## Where

- `GovernanceConfig` in types — add `passthrough?: boolean`
- `BaseLearner.learn()` — early return path when passthrough, store observations directly
- `BaseLearner.init()` — skip `initObserve` when passthrough (saves another LLM call)
- `src/brain/internal-learners.ts` — add `passthrough: true` to all 4 internal learner governance configs

## Verify

Re-run `brain-internal-learners-eval.ts`. Internal learners should have 0% dismissal rate.
