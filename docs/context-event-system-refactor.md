# Context: Event-Driven System Refactor

Context document for refactoring Brain from hybrid async/callback to fully event-driven architecture.

---

## Current Architecture

### Hierarchy

```
Brain
├── prompt, model, learners: Map<string, TextLearner>
├── initialize() → auto-generates learners via LLM
├── inject(data) → routes to ALL learners, returns batched results
├── ask(query) → queries ALL learners, synthesizes response
└── addLearner() / getLearners()

TextLearner
├── id, instructions, understanding (narrative text)
├── evolution: EvolutionEntry[], governance: LearnerGovernance
├── ingest(batch) → processes data, updates understanding
└── ask(query) → generates insight from understanding
```

### Key Files

| File | Purpose |
|------|---------|
| `src/brain/class.ts` | Brain orchestration |
| `src/brain/types.ts` | BrainConfig, BrainInjectResult, etc. |
| `src/brain/agent.ts` | SynthesisAgent for combining responses |
| `src/learners/text-learner/class.ts` | TextLearner implementation |
| `src/learners/text-learner/types.ts` | LearnerObserver pattern |
| `src/learners/text-learner/agent.ts` | LearnerAgent with tools |
| `src/learners/types.ts` | IngestResult, AskResult, etc. |

---

## Current Async Flow

**Brain.inject(data)**
1. Splits into batches by `batchSize` (default: 20)
2. Processes batches SEQUENTIALLY
3. Within each batch, calls all learners IN PARALLEL
4. Returns `{ id, batches: [{ id, index, results }] }`

**Brain.ask(query)**
1. Queries ALL learners IN PARALLEL
2. Passes to SynthesisAgent
3. Returns `{ insight, sources, gaps }`

**TextLearner.ingest(batch)**
1. Estimates tokens, chunks if > `maxInputTokens` (default: 30000)
2. Processes chunks SEQUENTIALLY via `processChunk()`
3. Each chunk: agent → updates understanding → applies strategy
4. Emits observer events

---

## Existing Observer Pattern (TextLearner only)

```typescript
// src/learners/text-learner/types.ts
interface LearnerObserver {
  onInitialized?: (event: LearnerInitializedEvent) => void | Promise<void>
  onInitError?: (event: LearnerInitErrorEvent) => void | Promise<void>
  onStart?: (event: LearnerStartEvent) => void | Promise<void>
  onStep?: (event: LearnerStepEvent) => void | Promise<void>
  onEnd?: (event: LearnerEndEvent) => void | Promise<void>
}

interface LearnerStartEvent {
  operation: 'ingest' | 'ask'
  input: unknown
  understanding: string
}

interface LearnerStepEvent {
  operation: 'ingest' | 'ask'
  stepNumber: number
  toolCalls?: Array<{ toolName: string; input: unknown }>
  usage?: TokenUsage
  finishReason: string
}

interface LearnerEndEvent {
  operation: 'ingest' | 'ask'
  totalSteps: number
  usage?: TokenUsage
  durationMs: number
  success: boolean
  error?: string
  entry?: EvolutionEntry  // Only for ingest
}
```

---

## Target API

```typescript
const brain = new Brain({ prompt, model })

// Fire-and-forget operations
brain.inject(data)
brain.ask(query)
brain.addLearner(config)

// Single event stream
brain.start().on(event => {
  // brain:init:started
  // brain:init:learners-created
  // brain:inject:started
  // brain:inject:batch-started
  // brain:inject:batch-ended
  // learner:ingest:started
  // learner:understanding:updated
  // learner:ask:completed
  // ...
})
```

---

## Proposed Events

```
brain:init:started
brain:init:learners-created    { learners: LearnerConfig[] }
brain:init:failed              { error }

brain:inject:started           { injectId, itemCount }
brain:inject:batch-started     { injectId, batchId, batchIndex }
brain:inject:batch-ended       { injectId, batchId, results }
brain:inject:completed         { injectId, batches }
brain:inject:failed            { injectId, error }

brain:ask:started              { queryId, query }
brain:ask:learners-queried     { queryId, responses }
brain:ask:synthesized          { queryId, insight, sources, gaps }
brain:ask:failed               { queryId, error }

learner:init:started           { learnerId }
learner:init:completed         { learnerId, systemPrompt }
learner:init:failed            { learnerId, error }

learner:ingest:started         { learnerId, chunkId?, input }
learner:ingest:step            { learnerId, stepNumber, toolCalls }
learner:ingest:completed       { learnerId, chunkId?, relevance }
learner:ingest:failed          { learnerId, error }

learner:understanding:updated  { learnerId, entry, understanding }

learner:ask:started            { learnerId, query }
learner:ask:step               { learnerId, stepNumber, toolCalls }
learner:ask:completed          { learnerId, insight, confidence, gaps }
learner:ask:failed             { learnerId, error }
```

---

## Current IDs

- `inject_xxx` - Inject operation
- `batch_xxx` - Batch within inject
- `chunk_xxx` - Chunk within learner ingest

May need: `query_xxx`, `init_xxx`

---

## Dependencies

Current: `ai`, `zod`, `nanoid`

---

## Run Eval

```bash
bun evals/brain.eval.ts
```

Uses OpenRouter from `.env.local`.
