# Learner Types Refactor + ListLearner Implementation

Implementation spec for extracting BaseLearner, refactoring the learning/query architecture, and implementing ListLearner.

---

## Scope

1. Extract `BaseLearner` abstract class from current `TextLearner`
2. Refactor `TwoPhaseMethod` → `DefaultMethod` (keep pluggable, rename)
3. Each learner type gets its own `LearningMethod` variant (`TextDefaultMethod`, `ListDefaultMethod`)
4. Remove direct query method — tool-based only (keep `QueryMethod` pluggable)
5. Implement `ListLearner` with structured LLM synthesis
6. Update Brain class to support multiple learner types
7. **No persistent storage** — everything stays in-memory

---

## Architecture Overview

```
BaseLearner (abstract)
  ├── LearningMethod (pluggable interface)
  │   ├── TextDefaultMethod  (text-specific observe prompt + synthesis)
  │   └── ListDefaultMethod  (list-specific observe prompt + synthesis)
  ├── QueryMethod (pluggable interface, existing)
  │   └── ToolBasedMethod (default, only supported method going forward)
  ├── Governance (shared)
  ├── Metrics (shared)
  ├── Evolution history (shared)
  ├── Buffer (shared, owned by LearningMethod)
  └── Events (shared)

TextLearner extends BaseLearner
  → wires TextDefaultMethod + QueryMethod with text-specific tools

ListLearner extends BaseLearner
  → wires ListDefaultMethod + QueryMethod with list-specific tools
```

---

## 1. BaseLearner

### What moves to BaseLearner

Everything that's shared across all learner types, extracted from current `TextLearner`:

- **Identity**: id, name, instructions, description, focus, origin
- **Governance**: activation, dormancy, signals, threshold checking
- **Metrics**: ingestion stats, query stats, rolling windows
- **Evolution history**: EvolutionEntry[], tracking what changed
- **Events**: TypedEmitter, all shared event emission
- **Signal detection**: threshold checks for Living Brain
- **Config management**: shared config resolution, cascade handling
- **Lifecycle**: init(), learn(), query() orchestration (delegates to methods)

### What stays per learner type

- **Understanding shape**: `string` for Text, `ListItem[]` for List
- **LearningMethod variant**: TextDefaultMethod vs ListDefaultMethod
- **Query tools**: text-specific vs list-specific
- **Type-specific config**: maintenance/governance options (strategies for text, dedup/pruning for list)
- **Type-specific accessors**: `getUnderstanding()` returns different shapes

### Abstract contract

```typescript
abstract class BaseLearner<TUnderstanding> {
  // Identity
  readonly id: string
  readonly instructions: string
  readonly origin: LearnerOrigin

  // Shared state
  protected governance: LearnerGovernance
  protected metrics: LearnerMetrics
  protected evolution: EvolutionEntry[]

  // Pluggable methods
  protected _learningMethod: LearningMethod
  protected _queryMethod: QueryMethod

  // Lifecycle (shared orchestration)
  async init(): Promise<void>
  async learn(batch: string[]): Promise<LearnOutput>
  async query(question: string, options?: QueryOptions): Promise<QueryResult>

  // Shared logic
  protected handleLearnResult(result: LearnOutput): void
  protected checkSignals(): Signal[]
  protected updateGovernance(...): void
  protected emitEvent(...): void

  // Abstract — each subclass implements
  abstract getUnderstanding(): TUnderstanding
  abstract setUnderstanding(value: TUnderstanding): void
}
```

---

## 2. LearningMethod Refactor

### Current state

- `TwoPhaseMethod` is a class in `src/learners/text-learner/learning-methods/two-phase/`
- Owns: buffer, observe phase, synthesize phase, prompt generation/caching
- Hardcoded to text-based synthesis (direct: full understanding in prompt → rewritten prose out)

### Target state

Rename concept from "TwoPhaseMethod" to just "LearningMethod" with a `DefaultMethod` base pattern. Each learner type has its own variant.

```
src/learners/
  ├── base/
  │   ├── class.ts              ← BaseLearner
  │   ├── types.ts              ← shared types
  │   └── learning-method/
  │       ├── types.ts           ← LearningMethod interface
  │       └── buffer.ts          ← ObservationBuffer (shared)
  │
  ├── text-learner/
  │   ├── class.ts              ← TextLearner extends BaseLearner<string>
  │   ├── learning-method/
  │   │   ├── index.ts           ← TextDefaultMethod implements LearningMethod
  │   │   ├── observe/           ← text-specific observe prompt + logic
  │   │   └── synthesize/        ← text-specific synthesis (single LLM call, prose rewrite)
  │   ├── query-tools/           ← text-specific query tools (read_understanding)
  │   └── strategies/            ← cumulative, decay, continuous (text-specific)
  │
  └── list-learner/
      ├── class.ts              ← ListLearner extends BaseLearner<ListItem[]>
      ├── learning-method/
      │   ├── index.ts           ← ListDefaultMethod implements LearningMethod
      │   ├── observe/           ← list-specific observe prompt
      │   └── synthesize/        ← list-specific synthesis (structured LLM call → operations)
      ├── query-tools/           ← list-specific query tools (get_items, search_items)
      └── governance/            ← dedup, maxItems, pruning (mechanical)
```

### LearningMethod interface

```typescript
interface LearningMethod {
  readonly name: string

  // Prompt state
  observePrompt: string | null
  synthesizePrompt: string | null

  // Lifecycle
  init(instructions: string, focus?: string): Promise<InitOutput>
  update(config: LearningMethodUpdateConfig): Promise<UpdateResult>

  // Core pipeline
  learn(
    learnerId: string,
    instructions: string,
    understanding: any,       // type varies per learner
    data: string[],
    options?: LearnOptions,
    callbacks?: LearnCallbacks
  ): Promise<LearnOutput>

  // Buffer access
  getBufferState(): BufferState
  getBufferedObservations(): BufferedObservation[]
}
```

### What's shared vs per-variant

| Concern | Shared (in interface/base) | Per variant |
|---------|---------------------------|-------------|
| Buffer | ObservationBuffer class | — |
| Threshold checking | shouldSynthesize() | Threshold values may differ |
| Observe pipeline | Call LLM with prompt → get observations | The prompt itself |
| Synthesis pipeline | — | Entirely per variant |
| Prompt caching | Pattern (cache + regen tracking) | Prompt content |

---

## 3. Synthesis Per Learner Type

### Key decision

Synthesis mechanism is owned by each LearningMethod variant. No forced uniformity.

### TextDefaultMethod synthesis

Same as today — single LLM call:
- Input: current understanding (prose) + buffered observations
- Output: new understanding (prose) + evolution entry + significance
- Post-synthesis: apply strategy (cumulative/decay/continuous)

### ListDefaultMethod synthesis

Single **structured** LLM call — NOT agentic:
- Input: current items + buffered observations
- Output: structured operations

```typescript
// LLM output schema
{
  operations: Array<
    | { type: "add", item: { data: any, metadata?: any } }
    | { type: "update", id: string, changes: { data?: any, metadata?: any } }
    | { type: "remove", id: string, reason: string }
  >,
  evolution: string,        // what changed and why
  significance: "routine" | "notable" | "critical"
}
```

Code then executes these operations mechanically against the in-memory list.

### Why not agentic for ListLearner

The pattern for list synthesis is always: match observation to item → add/update/remove. This is a single decision pass, not an exploratory multi-step reasoning task. A structured LLM call is simpler, cheaper, and more predictable.

Graph/Vector learners (future) will need agentic synthesis because their understanding is too large for context and requires iterative search.

---

## 4. Observe Phase

### Stays simple

- Input: `string[]` (batch of data)
- Output: `string[]` (observations) + importance score
- Mechanism: single LLM call with learner-specific prompt
- Observe does NOT see existing understanding — it only extracts from input

### Per-learner observe prompts

The observe prompt differs because each learner type extracts different things:

- **TextLearner**: "Extract relevant patterns, insights, and notable information"
- **ListLearner**: "Extract items, entities, actions, and signals relevant to tracking"

The prompt generation (via `initObserve()`) already uses LLM to generate optimized prompts from the learner's instructions. This stays the same — just the base prompt/guidance differs per type.

---

## 5. Query Architecture

### Keep pluggable

`QueryMethod` interface stays as-is. It's already properly abstracted with a factory.

### Drop direct method

Remove `DirectMethod`. Only `ToolBasedMethod` going forward.

### Per-learner query tools

Each learner type provides its own tools to the QueryMethod:

**TextLearner query tools:**
- `read_understanding()` → returns current prose understanding

**ListLearner query tools:**
- `get_items(filter?)` → returns items, optionally filtered
- `search_items(query)` → semantic search across items
- `get_item(id)` → get specific item by ID

### Query flow

Same for all learners:
1. QueryMethod receives question + learner's tools
2. LLM uses tools to access understanding
3. LLM generates response with relevance, confidence, insight, gaps

---

## 6. ListLearner Details

### Understanding shape

```typescript
interface ListItem {
  id: string
  data: Record<string, any>     // flexible, LLM-determined shape
  metadata: {
    confidence: number          // 0.0-1.0
    firstSeen: string           // ISO timestamp
    lastUpdated: string         // ISO timestamp
    signals: string[]           // evidence trail
  }
}
```

### Configuration

```typescript
interface ListLearnerConfig extends BaseLearnerConfig {
  governance: {
    // ... shared governance fields
    deduplication: "strict" | "semantic" | "none"
    maxItems: number
    pruning: "oldest" | "least-relevant" | "none"
  }
}
```

### Governance (mechanical, post-synthesis)

After synthesis executes operations, mechanical governance runs:

1. **Deduplication** (if `strict`): exact-match on item data → merge, keep higher confidence
2. **Deduplication** (if `semantic`): this one needs LLM — defer to future, use `strict` for now
3. **maxItems enforcement**: if items.length > maxItems → prune
4. **Pruning** (if `oldest`): sort by lastUpdated, remove oldest
5. **Pruning** (if `least-relevant`): sort by confidence, remove lowest

All mechanical code, no LLM calls.

### Accessors

```typescript
class ListLearner extends BaseLearner<ListItem[]> {
  getItems(): ListItem[]
  getItem(id: string): ListItem | undefined
  getItemCount(): number
}
```

---

## 7. Brain Class Updates

### Current state

Brain's `learners` map is `Map<string, TextLearner>`. Decomposition only generates TextLearner configs.

### Changes needed

1. **Type the map**: `Map<string, BaseLearner<any>>` (or a union type)
2. **Learner registry**: Track learner type alongside the instance
3. **Decomposition update**: Init phase can now generate different learner types based on the prompt
4. **Factory**: `createLearner(type, config)` that instantiates the right class
5. **Config cascade**: Different config fields cascade to different learner types

### Decomposition

The LLM that generates learners from the brain prompt now needs to decide learner TYPE:

```typescript
// Generated learner config now includes type
{
  type: "text" | "list",
  instructions: "...",
  name: "...",
  // type-specific config
}
```

The decomposition prompt needs updating to explain when to use Text vs List:
- **Narrative patterns/evolution** → TextLearner
- **Collections of entities/items to track** → ListLearner

---

## 8. Implementation Order

### Phase 1: Extract BaseLearner

1. Create `src/learners/base/` with BaseLearner abstract class
2. Move shared logic from TextLearner → BaseLearner
3. TextLearner extends BaseLearner, passes all existing tests
4. No behavior change — pure refactor

### Phase 2: Refactor LearningMethod

1. Formalize `LearningMethod` interface in `src/learners/base/learning-method/types.ts`
2. Move `ObservationBuffer` to `src/learners/base/learning-method/buffer.ts`
3. Rename current `TwoPhaseMethod` → `TextDefaultMethod`, move to `src/learners/text-learner/learning-method/`
4. TextLearner wires `TextDefaultMethod`
5. All existing tests pass

### Phase 3: Clean up QueryMethod

1. Remove `DirectMethod`
2. Move `QueryMethod` interface + `ToolBasedMethod` to shared location (`src/learners/base/query-method/`)
3. TextLearner provides its query tools (read_understanding)
4. All existing tests pass

### Phase 4: Implement ListLearner

1. Create `src/learners/list-learner/`
2. Implement `ListDefaultMethod` (observe prompt + structured synthesis)
3. Implement list query tools (get_items, search_items)
4. Implement mechanical governance (dedup, maxItems, pruning)
5. `ListLearner` extends `BaseLearner<ListItem[]>`

### Phase 5: Update Brain

1. Update learner map typing
2. Add learner factory
3. Update decomposition prompt to include learner type selection
4. Update config cascade for list-specific config
5. Integration tests with mixed learner types

---

## 9. What's NOT in scope

- Persistent storage (Turso, SQLite, or any DB)
- GraphLearner / VectorLearner
- Semantic deduplication (needs LLM, defer)
- Agentic synthesis
- New query methods beyond tool-based
- Changes to the evolution/evaluator system (it works with BaseLearner)
