# Learner Eval Runbook

When told "eval the learner" or any variant, consult this document.

## Quick Reference

| Shorthand | What it covers | Script(s) |
|---|---|---|
| eval learner | Full lifecycle | `learner-11-full-lifecycle.ts` + `learner-09-comprehensive-update.ts` |
| eval learner init | Init completeness, state keys, defaults | `learner-11-full-lifecycle.ts` Phase 1 |
| eval learner update | All update scenarios, regen vs config-only | `learner-11-full-lifecycle.ts` Phase 2 + `learner-09-comprehensive-update.ts` |
| eval learner ingestion | learn pipeline: observe → buffer → understand | `store-02-pipeline.ts` + `learner-03-learn.ts` |
| eval learner query | Query relevance, confidence, gaps | `learner-04-query.ts` |
| eval learner storage | Store persistence, restore from store | `store-01-standalone.ts` + `store-02-pipeline.ts` + `learner-11-full-lifecycle.ts` Phase 4 |
| eval learner config cascading | Model cascade, update propagation | `learner-11-full-lifecycle.ts` Phase 2 + Phase 3 |
| eval learner signals | Health signals (stagnation, dismissal, confidence) | `learner-05-signal-dismissal.ts` + `learner-06-signal-confidence.ts` + `learner-08-signal-stagnation.ts` |
| eval learner lifecycle timing | Update at every lifecycle point | `learner-11-full-lifecycle.ts` Phase 3 |

## How to Run

All evals require API keys from `.env.local`:

```bash
export $(cat .env.local | xargs) && npx tsx evals/scripts/<script>.ts
```

Optional env vars:

- `MODEL=google/gemini-2.0-flash-001` — override default model
- `STORE=memory` or `STORE=sqlite` — run against one backend (where applicable)

## Categories

### Init

**What to verify:** After `init()`, all state is generated and persisted.

**Expected state keys in store.state:** `observe_identity`, `observe_prompt`, `understand_identity`, `understand_prompt`, `observation_schema`, `understanding_schema`

**Expected in-memory getters:** `isInitialized() = true`, `getObserveSystemPrompt()` non-null, `getUnderstandSystemPrompt()` non-null, `getObservationSchema()` non-null, `getUnderstandingSchema()` non-null

**Expected defaults:** health.activation = 0, health.status = "dormant", metrics.query.count = 0, metrics.ingestion.dismissalRate = 0

**What to look for in output:**
- All 6 state keys present
- Prompts contain domain-relevant keywords from instructions
- Schemas are well-formed JSON Schema objects
- `learner:init:started` and `learner:init:completed` events emitted

### Update

**What to verify:** Different update types produce different side effects.

**Config-only updates** (name, description, origin, thresholds, health config):
- State values change
- Prompts do NOT change
- No `learner:prompts:regenerated` event
- `learner:config:updated` event with correct `changedFields`

**Reactive updates** (instructions, focus, observer.blueprintModel, understand.blueprintModel):
- Prompts change (instructions → both prompts; focus → observe only)
- `learner:prompts:regenerated` event emitted
- New prompts reflect new domain/focus keywords

**Model updates** (model, query.model, observer.model):
- No prompt regeneration
- Query method updated live (for query.model)

**Governance updates** (strategy, maxTokens for text; maxItems, dedup for list):
- Type-specific state changes
- No prompt regeneration

**What to look for in output:**
- `Prompts changed?` should be `false` for config-only, `true` for reactive
- Event lists should/shouldn't contain `learner:prompts:regenerated`
- Store state should reflect new values after each update

### Ingestion

**What to verify:** `learn()` pipeline works end-to-end.

**Flow:** Input → observe (LLM) → observations stored → buffer accumulates → threshold crossed → understand (LLM) → understanding stored → observations marked processed

**What to look for in output:**
- Observations have status `pending` initially, `processed` after understand
- Understanding record exists after threshold crossed
- Dismissed content has status `observe:dismissed`
- Events: `learner:observe:started`, `learner:observed`, `learner:synthesize:started`, `learner:synthesized`
- Importance scores make sense for the domain

### Query

**What to verify:** `query()` returns relevant answers based on knowledge.

**What to look for in output:**
- In-domain questions: `relevant = true`, confidence > 0.3
- Out-of-domain questions: `relevant = false` or low confidence
- `insight` contains domain-appropriate content
- `gaps` identifies what couldn't be answered
- Empty knowledge → short-circuit (confidence = 0)

### Storage / Persistence

**What to verify:** State round-trips correctly through store.

**What to look for in output:**
- After restore: prompts match originals
- After restore: schemas match originals
- After restore: understanding matches original
- Restore path emits `learner:init:completed` but NOT LLM generation events
- Works for both MemoryStore and SQLiteStore

### Config Cascading

**What to verify:** Updates propagate correctly through the learner's behavior.

**What to look for in output:**
- After instructions change: next `learn()` observes through new domain lens
- After instructions change: `query()` responds differently to same question
- After focus change: observe prompt narrows but understand prompt stays
- After threshold change: dismissal behavior changes (high minImportance → more dismissals)

### Lifecycle Timing

**What to verify:** `update()` takes effect at every lifecycle point.

**Scenarios:**
- Update after init, before any learn → new instructions affect first observation
- Update between learn batches → second batch uses new instructions
- Update after understand → new learn uses new config, produces new understanding
- Update before/after query → same question gets different answers

**What to look for in output:**
- Domain switch visible in observation content
- Query confidence shifts after domain switch
- Understanding content reflects domain that was active during synthesis

### Signals

**What to verify:** Health signals fire at correct thresholds.

**Thresholds:**
- Dismissal: `maxDismissalRate` (default 0.8) → `learner:signal:high-dismissal`
- Confidence: `minConfidence` (default 0.3) → `learner:signal:low-confidence`
- Stagnation: `maxObservationsWithoutSynthesis` → `learner:signal:stagnation`

**What to look for in output:**
- Signal fires exactly once (flag prevents re-fire)
- Signal payload includes current rate/count
- Signal thresholds are configurable via `update()`

## Script Index

| # | Script | Category | Description |
|---|---|---|---|
| 01 | `learner-01-lifecycle.ts` | lifecycle | Basic create → init → learn → query |
| 02 | `learner-02-update.ts` | update | Config update, prompt regen, events |
| 03 | `learner-03-learn.ts` | ingestion | Batch learning, buffer → synthesis |
| 04 | `learner-04-query.ts` | query | Query API, confidence, gaps |
| 05 | `learner-05-signal-dismissal.ts` | signals | High dismissal rate signal |
| 06 | `learner-06-signal-confidence.ts` | signals | Low query confidence signal |
| 08 | `learner-08-signal-stagnation.ts` | signals | Stagnation signal |
| 09 | `learner-09-comprehensive-update.ts` | update | Full E2E: domain switch + behavioral proof |
| 10 | `learner-10-update-in-brain.ts` | update | Update propagation through brain |
| 11 | `learner-11-full-lifecycle.ts` | full lifecycle | Init + update + learn + query + restore, both stores |
| — | `store-01-standalone.ts` | storage | 150 unit tests on Collection API |
| — | `store-02-pipeline.ts` | storage | Pipeline: init → learn → understand → restore |
