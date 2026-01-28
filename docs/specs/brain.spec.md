# Brain Specification v1

> The orchestration layer that ties Perceivers, Learners, and Storage together.

---

## Overview

The Brain is the **orchestrator**. It doesn't perceive data or build understanding directly — it coordinates the components that do.

**Core responsibilities:**

1. **Injection Flow** — Route incoming data through perceivers → storage → learners
2. **Query Flow** — Route queries to appropriate handlers (storage, learners, or both)
3. **Prompt Parsing** — Infer learners and perceivers from natural language prompts
4. **Subject Management** — Handle brain-level vs subject-level concerns
5. **Governance** — Manage learner lifecycle (activation, decay, split/merge)
6. **Feedback Loop** — Propagate learner insights back to perceiver configuration

---

## Injection Flow

### Basic Flow

```
brain.inject(rawData)
         ↓
┌────────────────────────────────────────────┐
│ 1. Store Raw (optional)                    │
│    - Preserve original for re-processing   │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ 2. Perceive                                │
│    - Select perceiver(s) based on input    │
│    - Run perception pipeline               │
│    - Output: { summary, content, metadata }│
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ 3. Store Perceived (optional)              │
│    - Embed summary → records index         │
│    - Embed content[] → chunks index        │
│    - Entity fields → graph nodes/edges     │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ 4. Route to Learners                       │
│    - Batch perceived data                  │
│    - Route to relevant learners            │
│    - Learners update understanding         │
└────────────────────────────────────────────┘
```

### Push Model

Brain uses a **push-only** model for data injection:

```typescript
// Single record
brain.inject(data)

// Batch
brain.inject([data1, data2, data3])

// With options
brain.inject(data, {
  subject: "user-123",        // Route to specific subject
  skipStorage: false,         // Store in records/chunks
  skipRaw: false,             // Store raw for re-processing
  priority: "normal"          // Batching priority
})
```

No pull/sync model. Brain receives data, doesn't fetch it.

### Perceiver Selection

Brain selects perceivers based on:

1. **Input type** — Text, image, video, audio, structured
2. **Scope** — Brain-level, subject-level, record-type specific
3. **Match functions** — Custom predicates defined on perceivers

```
Input arrives
    ↓
Detect input type
    ↓
Find matching perceivers:
  1. Brain-level (always run)
  2. Subject-level (if subject specified)
  3. Record-type (if match function returns true)
    ↓
Run perceivers in priority order
    ↓
Merge outputs into final PerceiverOutput
```

### Learner Routing

Not all data goes to all learners. Brain routes based on **relevance**:

```
Perceived data
    ↓
For each active learner:
  - Does this data match learner's purpose?
  - Quick relevance check (cheap)
    ↓
Batch data by learner
    ↓
Send batches to relevant learners
```

**Relevance detection options:**

1. **Embedding similarity** — Compare data embedding to learner's purpose embedding
2. **Keyword matching** — Fast pattern matching against learner purpose
3. **LLM routing** — Ask LLM which learners should receive data (expensive but accurate)

Configuration determines which approach to use.

---

## Batching

Batching is a **brain concern**, not a learner concern.

### Why Batch?

- Reduce LLM calls (learners often use LLMs for processing)
- Enable learners to see patterns across multiple data points
- Smooth out burst traffic

### Batching Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Time-based** | Flush every N seconds | Consistent latency |
| **Size-based** | Flush when batch reaches N items | Throughput optimization |
| **Hybrid** | Flush on time OR size, whichever first | Balance |
| **Immediate** | No batching, process immediately | Real-time requirements |

```typescript
const brain = Unbody.createBrain(prompt, {
  batching: {
    strategy: "hybrid",
    maxSize: 100,
    maxWait: "5s"
  }
})
```

### Per-Learner Batching

Different learners may need different batching:

```typescript
brain.addLearner({
  purpose: "Track urgent issues",
  batching: { strategy: "immediate" }  // No delay for urgent
})

brain.addLearner({
  purpose: "Understand weekly patterns",
  batching: { strategy: "time", maxWait: "1h" }  // OK to wait
})
```

---

## Subject Management

Subjects are **scopes within a brain**. A brain can have:

- Brain-level learners (shared across all subjects)
- Subject-level learners (scoped to one subject)

### Use Cases

| Pattern | Example |
|---------|---------|
| **One brain, many users** | Personal assistant brain with per-user subjects |
| **One brain, many entities** | Therapist platform with per-therapist subjects |
| **Single subject** | Simple use case, no subjects needed |

### Subject API

```typescript
// Create/access subject
const subject = brain.subject("user-123")

// Inject data to subject
subject.inject(data)  // Routes to subject-level learners

// Query subject
subject.query("What have I been learning?")

// Add subject-level learner
subject.addLearner({
  purpose: "Understand this user's preferences"
})
```

### Data Routing with Subjects

```
brain.inject(data)                    → Brain-level learners only
brain.inject(data, { subject: "x" }) → Brain-level + Subject-level learners
brain.subject("x").inject(data)       → Brain-level + Subject-level learners
```

### Subject Lifecycle

Subjects are **lazy** — created on first access.

```typescript
// This creates subject if it doesn't exist
const subject = brain.subject("new-user")

// Subject-level learners start dormant
// Ignite when they receive relevant data
```

---

## Prompt Parsing

Brain can infer learners and perceivers from natural language prompts.

### Example

```typescript
const brain = Unbody.createBrain(`
  Track my digital life.
  Understand my learning interests and how they evolve.
  Help me find connections between topics I'm exploring.
  Remember my commitments and promises.
`)
```

Brain infers:

**Learners:**
- TextLearner: "Understand learning interests and their evolution"
- TextLearner: "Understand topic connections and relationships"
- ListLearner: "Track commitments and promises"

**Perceivers:**
- Topic extraction
- Entity extraction (people, tools, concepts)
- Temporal metadata extraction
- Commitment/promise detection

### Inference Process

```
Parse prompt
    ↓
Identify tracking concerns (what to pay attention to)
    ↓
Map concerns to learner types:
  - Patterns/evolution → TextLearner
  - Collections → ListLearner
  - Relationships → GraphLearner
    ↓
Identify extraction needs (what to extract from data)
    ↓
Map to perceiver tools:
  - "sentiment" → sentiment tool
  - "topics" → topic extraction
  - "entities" → entity extraction
    ↓
Create initial (dormant) learners
Configure perceivers with inferred tools
```

### Override and Extend

Developer can always override or extend inferred components:

```typescript
const brain = Unbody.createBrain(prompt)

// Override inferred learner
brain.addLearner({
  purpose: "Track commitments",  // Replaces inferred version
  type: "list",
  maintenance: { maxItems: 50 }  // Custom config
})

// Add learner brain didn't infer
brain.addLearner({
  purpose: "Detect burnout signals"
})

// Override perceiver
brain.addPerceiver({
  name: "extractTopics",
  override: true,
  execute: customTopicExtractor
})
```

---

## Governance

Brain manages learner lifecycle through governance mechanics.

### Activation Management

```
┌─────────────────────────────────────────────────┐
│ Learner-local (handled by learner)              │
├─────────────────────────────────────────────────┤
│ - Update activation on data/query              │
│ - Check threshold before participating          │
│ - Detect own ignition                           │
└─────────────────────────────────────────────────┘
                      ↑
                      │ activation scores
                      ↓
┌─────────────────────────────────────────────────┐
│ Brain-global (handled by brain)                 │
├─────────────────────────────────────────────────┤
│ - Apply time decay to all learners              │
│ - Detect dormant learners, mark for removal     │
│ - Detect split/merge opportunities              │
│ - Execute split/merge operations                │
└─────────────────────────────────────────────────┘
```

### Decay

Brain applies decay to prevent learner proliferation:

```typescript
// Background process
for (const learner of brain.learners) {
  const timeSinceAccess = now - learner.governance.lastAccessed
  const decayFactor = calculateDecay(timeSinceAccess)
  learner.governance.activation *= decayFactor
}
```

### Split Detection

Brain detects when a learner is tracking too broad a concern:

**Signals:**
- Learner has high activation but low confidence on queries
- Learner's understanding is hitting size limits frequently
- Many queries partially match but none fully match

**Action:**
```
Detect learner tracking too broadly
    ↓
Analyze learner's understanding for natural clusters
    ↓
Create two new learners with narrower purposes
    ↓
Deprecate original learner
```

### Merge Detection

Brain detects when learners have overlapping purposes:

**Signals:**
- Multiple learners frequently respond to same queries
- High similarity between learner purpose embeddings
- Redundant understanding content

**Action:**
```
Detect overlapping learners
    ↓
Create new learner with combined purpose
    ↓
Merge understanding from both
    ↓
Deprecate original learners
```

---

## Feedback Loop

Learners can inform perceiver configuration through the brain.

### Mechanism

```
Time T1: Perceiver has no category constraints
         CategoryLearner observes patterns

Time T2: CategoryLearner reports: "I see 3 categories: A, B, C"
         Brain updates perceiver config

Time T3: New records get classified into known categories
```

### Implementation

```typescript
// Learner can emit signals
learner.emit("insight", {
  type: "categories-discovered",
  categories: ["tutorial", "opinion", "news"]
})

// Brain listens and updates perceivers
brain.on("learner-insight", (learner, insight) => {
  if (insight.type === "categories-discovered") {
    brain.updatePerceiver("classify", {
      categories: insight.categories
    })
  }
})
```

### Re-perceive

When perceiver config changes, brain can re-process old records:

```typescript
brain.reperceive({
  filter: { createdAt: { $lt: configChangeTime } },
  perceivers: ["classify"]  // Only run updated perceiver
})
```

---

## Configuration

### Full Configuration

```typescript
const brain = Unbody.createBrain(prompt, {
  // Storage adapters
  storage: {
    raw: s3Adapter,
    records: weaviateAdapter,
    chunks: weaviateAdapter
  },

  // Batching defaults
  batching: {
    strategy: "hybrid",
    maxSize: 100,
    maxWait: "5s"
  },

  // Governance settings
  governance: {
    decayRate: 0.95,           // Daily decay multiplier
    dormantThreshold: 0.1,     // Below this = dormant
    removalThreshold: 0.01,    // Below this for 30 days = remove
    splitThreshold: 0.8,       // Confidence threshold for split
    mergeThreshold: 0.9        // Similarity threshold for merge
  },

  // Routing strategy
  routing: {
    learnerSelection: "embedding",  // or "keyword" or "llm"
    parallelLearners: true
  },

  // Embedding configuration
  embedding: {
    model: "openai",
    dimensions: 1536
  }
})
```

### Minimal Configuration

```typescript
// Learners only, no storage
const brain = Unbody.createBrain(prompt)

// With storage
const brain = Unbody.createBrain(prompt, {
  storage: {
    records: weaviateAdapter,
    chunks: weaviateAdapter
  }
})
```

---

## Brain Interface

```typescript
interface Brain {
  // Injection
  inject(data: unknown, options?: InjectOptions): Promise<void>
  inject(data: unknown[], options?: InjectOptions): Promise<void>

  // Query (see Query Flow spec)
  query(query: string, options?: QueryOptions): Promise<QueryResult>

  // Subject management
  subject(id: string): Subject

  // Component management
  addLearner(config: LearnerConfig): Learner
  addPerceiver(config: PerceiverConfig): Perceiver
  updatePerceiver(name: string, config: Partial<PerceiverConfig>): void

  // Introspection
  getLearners(): Learner[]
  getPerceivers(): Perceiver[]
  getSubjects(): Subject[]

  // Maintenance
  reperceive(options: ReperceiveOptions): Promise<void>

  // Events
  on(event: BrainEvent, handler: EventHandler): void
}

interface Subject {
  id: string
  inject(data: unknown, options?: InjectOptions): Promise<void>
  query(query: string, options?: QueryOptions): Promise<QueryResult>
  addLearner(config: LearnerConfig): Learner
  getLearners(): Learner[]
}
```

---

## Query Flow

See [Query Flow spec](query-flow.spec.md) (TODO) for how queries are routed and answered.

Preview:
- Query arrives
- Brain decides: storage query, learner query, or both
- Multiple learners may respond (competition)
- Brain synthesizes responses
- Returns unified answer with sources

---

## Open Questions

1. **Learner routing accuracy** — How accurate does learner routing need to be? False positives (sending irrelevant data) waste compute. False negatives (missing relevant data) hurt understanding.

2. **Split/merge thresholds** — What are good defaults? Need experimentation.

3. **Prompt parsing reliability** — How reliable is LLM-based prompt parsing? Need fallback for ambiguous prompts.

4. **Subject isolation** — Should subject-level learners be completely isolated, or can they access brain-level context?

5. **Concurrent modifications** — How to handle concurrent inject calls that might trigger split/merge?

---

## Summary

The Brain orchestrates:

| Concern | Brain Role |
|---------|------------|
| Injection | Route data through perceivers → storage → learners |
| Batching | Group data before sending to learners |
| Subjects | Manage scopes and route data appropriately |
| Governance | Decay, split, merge learners |
| Feedback | Propagate learner insights to perceivers |
| Configuration | BYODB, batching strategy, routing strategy |

Brain is coordination, not computation. The real work happens in Perceivers (perception) and Learners (understanding).
