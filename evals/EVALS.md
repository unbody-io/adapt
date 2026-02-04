# Living Brain Evaluation Scripts

## Overview

Comprehensive evaluation scripts that demonstrate and verify every API, flow, and edge case in the Living Brain system. Each script is a runnable TypeScript program that logs detailed observations and validates behavior.

## Directory Structure

```
/evals/
├── EVALS.md              # This file - implementation plan
├── /helpers/             # Shared utilities
│   ├── logger.ts         # Colored console logging utilities
│   └── assertions.ts     # Test assertion helpers
├── /learner/             # Isolated learner tests
├── /brain/               # Brain-level tests
├── /integration/         # Complex multi-component flows
└── /reports/             # Generated logs (gitignored)
```

## Standard Script Format

Every script follows this structure:

```typescript
import { Brain, TextLearner } from '../src'
import { anthropic } from '@ai-sdk/anthropic'
import { log, logSuccess, logError, logSection } from './helpers/logger'

// ==================== CONFIG ====================
const MODEL = anthropic('claude-sonnet-4-20250514')

// ==================== MAIN ====================
async function main() {
  console.log('\n=== Eval: <Name> ===\n')

  try {
    // 1. Setup
    logSection('Setup')
    // ... initialization

    // 2. Before State
    logSection('Before State')
    log('Initial state:', { /* ... */ })

    // 3. Action
    logSection('Action')
    // ... perform operation

    // 4. Events
    logSection('Events Captured')
    log('Emitted events:', capturedEvents)

    // 5. After State
    logSection('After State')
    log('Final state:', { /* ... */ })

    // 6. Assertions
    logSection('Assertions')
    logSuccess('✓ Check 1 passed')
    logSuccess('✓ Check 2 passed')

    logSuccess('\n✓ All checks passed')
    process.exit(0)
  } catch (error) {
    logError('\n✗ Eval failed', error)
    process.exit(1)
  }
}

main()
```

## Observability Requirements

Each script MUST log:

1. **Before State**: Config, understanding, metrics, learner count
2. **Action**: Exact operation being performed
3. **Events**: All emitted events with full payloads
4. **After State**: New understanding, changed metrics, new learners
5. **Assertions**: What was verified (pass/fail)

---

## Learner Evals (`/evals/learner/`)

### `01-lifecycle.ts`

**Tests**: Complete learner lifecycle: Create → Init → Learn → Query → Update

**Verifies**:
- Learner construction with config
- Initialization generates observe/synthesize prompts
- Learning increases understanding (observe → buffer → synthesize)
- Querying returns insights with confidence
- Updating config works mid-lifecycle

**Key Logs**:
- Initial empty understanding
- Observe phase: observations added to buffer
- Synthesize phase: understanding text updated, evolution entry added
- Query result: insight, confidence, gaps
- Update: old vs new instructions, regenerated prompts

---

### `02-update-immutability.ts`

**Tests**: Immutability validation - try updating protected fields

**Verifies**:
- Updating `id` throws error
- Updating `origin` throws error
- Updating `type` throws error
- Updating `model` throws error
- Updating `blueprintModel` throws error

**Key Logs**:
- Each immutable field update attempt
- Error message for each rejection
- Verify error message matches expected format

---

### `03-update-instructions.ts`

**Tests**: Instructions update triggers prompt regeneration

**Verifies**:
- Learner has initial observe/synthesize prompts
- Update instructions via `learner.update({ instructions: "..." })`
- New prompts generated (different from originals)
- `learner:prompts:regenerated` event emitted
- Understanding preserved through update

**Key Logs**:
- Before: old instructions, old observe prompt (first 200 chars), old synthesize prompt (first 200 chars)
- After: new instructions, new observe prompt (first 200 chars), new synthesize prompt (first 200 chars)
- Event payload

---

### `04-update-thresholds.ts`

**Tests**: Threshold updates change buffer behavior

**Verifies**:
- Initial thresholds: `minImportance: 0.5`, `maxObservations: 10`
- Update to `minImportance: 0.8`, `maxObservations: 5`
- Learn with low importance (0.6) → dismissed (below new threshold)
- Buffer fills faster (hits 5 instead of 10)
- `learner:config:updated` event emitted

**Key Logs**:
- Before thresholds
- Update operation
- After thresholds
- Learning behavior with new thresholds (observe dismissed vs accepted)
- Buffer state before/after

---

### `05-signal-dismissal.ts`

**Tests**: Dismissal rate threshold crossing emits signal

**Verifies**:
- Initial state: 0 observations, 0 dismissals
- Learn 15 batches: 3 accepted, 12 dismissed (80% dismissal rate)
- `learner:signal` event emitted with dismissalRate metric
- Signal description mentions dismissal percentage

**Key Logs**:
- Observation count progression (1, 2, 3... 15)
- Dismissal count progression
- Calculated dismissal rate
- Signal event payload

---

### `06-signal-confidence.ts`

**Tests**: Low confidence queries trigger signal

**Verifies**:
- Query 5 times with questions outside learner's scope
- All return low confidence (< 0.3)
- After 5th query, `learner:signal` emitted
- Signal description mentions low confidence

**Key Logs**:
- Each query result with confidence value
- Running average confidence
- Signal event payload after 5th query

---

### `07-signal-buffer-overflow.ts`

**Tests**: Buffer overflow threshold crossing

**Verifies**:
- Thresholds: `maxObservations: 10`, `bufferOverflowMultiplier: 1.5`
- Fill buffer with 16+ observations (exceeds 10 * 1.5 = 15)
- `learner:signal` emitted with bufferCount metric
- Signal description mentions buffer overflow

**Key Logs**:
- Buffer state after each batch
- When overflow threshold crossed
- Signal event payload

---

### `08-signal-stagnation.ts`

**Tests**: No synthesis in 100+ observations triggers signal

**Verifies**:
- Set high synthesis threshold (e.g., `maxObservations: 200`)
- Learn 110 low-importance observations (never triggers synthesis)
- After 100th observation without synthesis, `learner:signal` emitted
- Signal description mentions stagnation

**Key Logs**:
- Observation count
- Last synthesis observation count (stays at 0)
- Signal event after 100 observations

---

### `09-understanding-persistence.ts`

**Tests**: setUnderstanding() survives config updates

**Verifies**:
- Learner starts with understanding "Initial knowledge"
- Call `setUnderstanding("Manually set understanding")`
- Update learner config (name, description, thresholds)
- Understanding still equals "Manually set understanding"

**Key Logs**:
- Initial understanding
- After setUnderstanding
- After config update
- Final understanding verification

---

## Brain Evals (`/evals/brain/`)

### `01-initialization.ts`

**Tests**: Brain initialization and learner decomposition

**Verifies**:
- Brain constructed with prompt
- `initialize()` triggers LLM to generate learner configs
- Multiple learners created (typically 2-4)
- Each learner has unique id, name, instructions
- All learners initialized (have prompts)
- `brain:init:completed` event emitted

**Key Logs**:
- Brain prompt
- LLM-generated learner configs
- Created learner IDs
- Each learner's name and instructions
- Initialization events

---

### `02-signal-buffering.ts`

**Tests**: Evaluator signal buffering and auto-evaluation threshold

**Verifies**:
- **Scenario 1**: Send 4 signals → no evaluation triggered (buffer < 5)
- **Scenario 2**: Send 5 signals → evaluation triggered automatically
- Evaluation generates decisions
- Decisions executed sequentially

**Key Logs**:
- Each signal sent (source, description)
- Buffer state after each signal
- When threshold reached (5th signal)
- Evaluation started/completed events
- Generated decisions

---

### `03-manual-evolution-create.ts`

**Tests**: `brain.createLearner(guidance)`

**Verifies**:
- Call `createLearner("Track API versioning strategies")`
- New learner created with appropriate instructions
- Learner added to `brain.learners` map
- `brain:learner:added` event emitted
- `evolution:action:executed` event emitted with newLearnerIds

**Key Logs**:
- Guidance provided
- New learner ID, name, instructions
- Events emitted
- Brain learner count before/after

---

### `04-manual-evolution-merge.ts`

**Tests**: `brain.mergeLearners([id1, id2], guidance)`

**Verifies**:
- Two learners exist with separate understandings
- Call `mergeLearners()`
- New merged learner created
- Original two learners deleted
- New learner's understanding contains knowledge from both
- `evolution:action:executed` event with newLearnerIds + deletedLearnerIds

**Key Logs**:
- Original learners: IDs, understandings (first 200 chars each)
- Merge guidance
- New learner: ID, understanding (first 500 chars)
- Deleted learner IDs
- Event payload

---

### `05-manual-evolution-split.ts`

**Tests**: `brain.splitLearner(id, guidance)`

**Verifies**:
- One broad learner exists
- Call `splitLearner(id, "Split into X and Y")`
- Multiple new learners created (typically 2)
- Original learner deleted
- New learners have focused instructions
- `evolution:action:executed` event with newLearnerIds + deletedLearnerIds

**Key Logs**:
- Original learner: ID, instructions, understanding
- Split guidance
- New learners: IDs, instructions for each
- Deleted learner ID
- Event payload

---

### `06-manual-evolution-update.ts`

**Tests**: `brain.updateLearner(id, guidance)`

**Verifies**:
- Learner exists with config A
- Call `updateLearner(id, "Narrow scope to X")`
- Learner config updated (instructions changed)
- Learner ID unchanged (same instance)
- Brain's `learnerNames` map updated if name changed
- `evolution:action:executed` event with updatedLearnerIds

**Key Logs**:
- Before: learner name, instructions, thresholds
- Update guidance
- After: learner name, instructions, thresholds
- What changed
- Event payload

---

### `07-manual-evolution-delete.ts`

**Tests**: `brain.deleteLearner(id)`

**Verifies**:
- Learner exists
- Call `deleteLearner(id)`
- Learner removed from `brain.learners`
- Learner removed from `brain.learnerNames`
- `evolution:action:executed` event with deletedLearnerIds

**Key Logs**:
- Before: learner count, learner IDs
- Deleted learner ID
- After: learner count, remaining learner IDs
- Event payload

---

### `08-brain-update-prompt.ts`

**Tests**: `brain.update({ prompt: "new purpose" })`

**Verifies**:
- Initial prompt
- Update to new prompt
- `brain.prompt` changed
- Authoritative signal emitted to evaluator
- Signal has `source: 'brain'` and contains old/new prompt
- If signal threshold reached, evaluation triggered
- `brain:config:updated` event emitted

**Key Logs**:
- Old prompt
- New prompt
- Signal payload (full description)
- Whether evaluator triggered
- Config updated event

---

### `09-brain-update-config.ts`

**Tests**: `brain.update({ model, evolution: {...} })`

**Verifies**:
- Update model
- Update blueprintModel
- Update evolution.enabled (toggle on/off)
- Update evolution.evaluatorSignalThreshold (change buffer size)
- Update evolution.autoEvaluate (toggle)
- `brain:config:updated` event emitted with all changes

**Key Logs**:
- Before config: model, blueprintModel, evolution settings
- Updates applied
- After config
- Event payload

---

### `10-distributed-learning.ts`

**Tests**: `brain.inject(data)` distributes to all learners

**Verifies**:
- Brain has 3 learners
- Inject array of 20 items
- Items split into batches (batchSize: 10 → 2 batches)
- Each batch sent to ALL 3 learners in parallel
- Each learner processes independently
- Some learners observe, some dismiss (based on relevance)
- `brain:inject:completed` event with batch results

**Key Logs**:
- Item count, batch count
- Batch 1: results from each learner (observed/dismissed)
- Batch 2: results from each learner
- Understanding changes for each learner

---

### `11-brain-query-synthesis.ts`

**Tests**: `brain.ask(query)` synthesizes from all learners

**Verifies**:
- Brain has multiple learners
- Call `ask("What have you learned about X?")`
- Query sent to ALL learners in parallel
- Each learner returns insight, confidence, gaps
- Brain synthesizes unified response
- Response includes sources (which learners contributed)
- `brain:ask:completed` event with synthesis result

**Key Logs**:
- Query
- Each learner response: insight, confidence, gaps
- Synthesized insight
- Sources
- Combined gaps

---

### `12-cascade-config.ts`

**Tests**: Brain model cascades to learners

**Verifies**:
- Brain created with `model: modelA`
- Learners inherit `modelA` from brain
- Update brain: `brain.update({ model: modelB })`
- Verify `brain.config.learning.model === modelB`
- New learners created after update use `modelB`
- (Existing learners keep `modelA` - models are immutable)

**Key Logs**:
- Initial brain model
- Learner 1 model (should match brain)
- Updated brain model
- New learner model (should match updated brain)
- Old learner model (should still be original)

---

## Integration Evals (`/evals/integration/`)

### `01-organic-evolution-full-flow.ts`

**Tests**: Complete autonomous evolution cycle

**Verifies**:
1. Brain initialized with learners
2. Inject data causing one learner to repeatedly dismiss (high dismissal rate)
3. Learner emits signal
4. Signal buffered in evaluator
5. After 5 signals, evaluator triggered automatically
6. LLM generates evolution decisions (e.g., "update learner to broaden scope")
7. Evolution handler executes decision
8. Learner config updated
9. Re-inject same data → learner now accepts

**Key Logs**:
- Initial learner instructions
- Dismissal rate progression
- Signal emissions
- Evaluator triggered
- LLM decisions
- Executed actions
- Updated learner instructions
- Behavior change verification

---

### `02-merge-understanding-transfer.ts`

**Tests**: Merge preserves knowledge from both learners

**Verifies**:
- Learner A learns about "React hooks"
- Learner B learns about "React performance"
- Both have distinct understandings
- Merge: `mergeLearners([A, B], "Combine into React best practices")`
- New learner's understanding mentions both hooks AND performance
- Query new learner about hooks → relevant answer
- Query new learner about performance → relevant answer

**Key Logs**:
- Learner A understanding (full text)
- Learner B understanding (full text)
- Merged learner understanding (full text)
- Query results demonstrating preserved knowledge

---

### `03-split-then-specialize.ts`

**Tests**: Split distributes knowledge, both continue learning

**Verifies**:
- Learner X tracks "Frontend AND Backend"
- Split: `splitLearner(X, "Split into frontend-only and backend-only")`
- New learners: FE learner, BE learner
- FE learner understanding contains frontend knowledge
- BE learner understanding contains backend knowledge
- Inject frontend data → FE accepts, BE dismisses
- Inject backend data → BE accepts, FE dismisses

**Key Logs**:
- Original learner understanding
- FE learner: ID, instructions, understanding
- BE learner: ID, instructions, understanding
- FE learning behavior with FE data
- BE learning behavior with BE data
- Cross-specialization test (FE with BE data)

---

### `04-update-mid-lifecycle.ts`

**Tests**: Update during active learning preserves knowledge

**Verifies**:
- Learner learns batch 1 → understanding updated
- Update instructions: `updateLearner(id, "Narrow scope to X")`
- Understanding preserved (not reset)
- Learn batch 2 with new instructions → understanding grows
- Query about batch 1 content → still accessible
- Query about batch 2 content → accessible

**Key Logs**:
- After batch 1: understanding, evolution history
- Update operation: old instructions, new instructions
- After update: understanding (should be unchanged), new instructions
- After batch 2: understanding (should include batch 1 + batch 2)
- Query results

---

### `05-prompt-change-adaptation.ts`

**Tests**: Brain prompt update triggers learner evolution

**Verifies**:
- Brain prompt: "Track software testing practices"
- Learners generated focus on testing
- Update: `brain.update({ prompt: "Track testing AND deployment practices" })`
- Authoritative signal emitted
- Evaluator processes signal
- LLM generates decision: "create new learner for deployment"
- New deployment learner created
- Original testing learners remain

**Key Logs**:
- Initial learners: IDs, names, instructions
- Prompt update: old, new
- Signal payload
- Evaluator decision
- Action executed: new learner details
- Final learner list

---

### `06-sequential-execution-safety.ts`

**Tests**: Sequential execution prevents conflicts

**Verifies**:
- Create scenario: `updateLearner(X)` then `deleteLearner(X)` in one evaluation
- Evaluator returns 2 decisions: [update X, delete X]
- Orchestrator executes sequentially (not parallel)
- Update executes → learner X updated
- Delete executes → learner X removed
- No race condition, no error

**Key Logs**:
- Decisions array
- Action 1 execution: update started, completed
- Action 2 execution: delete started, completed
- Sequential timing verification (timestamps)

---

### `07-evaluator-zero-decisions.ts`

**Tests**: LLM can return empty decisions array

**Verifies**:
- Send 5 benign signals (e.g., "learner X processed data successfully")
- Evaluator triggered
- LLM analyzes signals
- LLM returns: `{ decisions: [] }`
- No actions executed
- System remains unchanged

**Key Logs**:
- Signals sent (all positive/neutral)
- Evaluator triggered
- LLM output: empty decisions array
- Verification: no learners created/deleted/updated

---

### `08-error-recovery.ts`

**Tests**: Graceful error handling

**Scenarios**:
1. Try updating non-existent learner ID → error thrown, caught, logged
2. Try merging with only 1 learner → error thrown
3. LLM returns invalid JSON → error caught, system stable
4. Try updating immutable field via evolution → error thrown

**Key Logs**:
- Each error scenario
- Error message
- System state after error (unchanged)
- Verify brain still functional after errors

---

### `09-event-emission-complete.ts`

**Tests**: All events emit correctly with full payloads

**Verifies**:
- Attach listeners to ALL event types
- Perform operations triggering each event
- Verify each event:
  - Emitted exactly once
  - Payload matches expected shape
  - Payload contains expected data

**Events Tested**:
- brain:init:*
- brain:inject:*
- brain:ask:*
- brain:signal:received
- brain:config:updated
- evaluator:evaluation:*
- evolution:action:*
- learner:observe:*
- learner:synthesize:*
- learner:signal
- learner:config:updated
- learner:prompts:regenerated

**Key Logs**:
- Event name
- Payload (full)
- Assertion: payload shape valid

---

### `10-governance-metrics.ts`

**Tests**: Governance metrics evolve correctly

**Verifies**:
- Initial governance: `activation: 0`, `status: 'dormant'`
- Learn high-relevance data → activation increases
- After multiple learns → `status: 'active'` (activation > 0.3)
- Query learner → retrievalCount increments
- Track successRate over queries

**Key Logs**:
- Governance state after each operation:
  - activation (numeric)
  - status ('dormant' | 'active')
  - retrievalCount
  - successRate
  - lastAccessed
- Metric progression graph (text-based)

---

## Helper Utilities

### `/evals/helpers/logger.ts`

```typescript
import chalk from 'chalk'

export function logSection(title: string) {
  console.log(chalk.bold.cyan(`\n=== ${title} ===`))
}

export function log(label: string, data: any) {
  console.log(chalk.blue(`${label}`))
  console.log(JSON.stringify(data, null, 2))
}

export function logSuccess(message: string) {
  console.log(chalk.green(message))
}

export function logError(message: string, error: any) {
  console.log(chalk.red(message))
  console.error(error)
}

export function logMetric(name: string, value: number | string) {
  console.log(chalk.yellow(`  ${name}: ${value}`))
}
```

### `/evals/helpers/assertions.ts`

```typescript
export function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

export function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) {
    throw new Error(message)
  }
}

export function assertArrayLength(array: any[], expectedLength: number, message: string) {
  if (array.length !== expectedLength) {
    throw new Error(`${message}\nExpected length: ${expectedLength}\nActual length: ${array.length}`)
  }
}

export function assertIncludes(haystack: string, needle: string, message: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}\nExpected to include: "${needle}"\nActual: "${haystack}"`)
  }
}

export function assertThrows(fn: () => any, message: string) {
  try {
    fn()
    throw new Error(`${message} - Expected function to throw but it didn't`)
  } catch (error) {
    // Expected
  }
}
```

---

## Running Evals

```bash
# Run all evals
npm run eval

# Run category
npm run eval:learner
npm run eval:brain
npm run eval:integration

# Run specific eval
tsx evals/learner/01-lifecycle.ts

# Run with output capture
tsx evals/brain/01-initialization.ts > evals/reports/brain-01.log 2>&1
```

---

## Success Criteria

An eval passes when:
1. ✅ Script runs without throwing uncaught errors
2. ✅ All assertions pass
3. ✅ Expected events emitted
4. ✅ State changes match expectations
5. ✅ Script exits with code 0

An eval fails when:
1. ❌ Uncaught error thrown
2. ❌ Assertion fails
3. ❌ Expected event not emitted
4. ❌ State doesn't match expectations
5. ❌ Script exits with non-zero code

---

## Implementation Order

**Phase 1: Foundation** (implement first)
1. Helper utilities (logger, assertions)
2. Learner evals 01-04 (basic lifecycle, updates)
3. Brain evals 01, 03 (initialization, manual create)

**Phase 2: Signals & Evolution** (implement second)
4. Learner evals 05-08 (all signal types)
5. Brain evals 02, 04-07 (signal buffering, all manual evolution)
6. Integration eval 01 (organic evolution full flow)

**Phase 3: Advanced Flows** (implement third)
7. Brain evals 08-12 (brain updates, distributed learning, synthesis)
8. Integration evals 02-06 (merge, split, update scenarios)

**Phase 4: Edge Cases** (implement last)
9. Learner eval 02, 09 (immutability, persistence)
10. Integration evals 07-10 (zero decisions, errors, events, metrics)

---

## Notes

- All scripts are **runnable** - they execute actual LLM calls
- Scripts are **idempotent** - can be run multiple times
- Scripts are **self-documenting** - logs explain what's happening
- Scripts are **isolated** - each creates its own instances
- Reports are **gitignored** - too verbose for version control
