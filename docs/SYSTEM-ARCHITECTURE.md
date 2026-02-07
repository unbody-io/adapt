# Brain System Architecture

> Comprehensive architectural and conceptual overview of the Brain learning system

**Version**: brain-v0 (current implementation)
**Last Updated**: 2026-02

---

## What is Brain?

Brain is an **adaptive learning system** that builds understanding over time from streaming data. Unlike stateless Q&A systems, Brain maintains persistent, evolving knowledge through specialized learning agents.

**Core Innovation**: Instead of one monolithic context, Brain decomposes learning into multiple focused "understandings" that evolve independently and synthesize at query time.

---

## Key Problems Solved

### 1. Context Window Limitations
Traditional LLMs have fixed context windows. Brain maintains **compressed understanding** that persists across sessions, not raw data.

### 2. Catastrophic Forgetting
Adding new information shouldn't corrupt existing knowledge. Brain uses **two-phase learning** to separate extraction from synthesis, reducing degradation risk.

### 3. Single-Perspective Limitation
Complex domains need multiple viewpoints. Brain **auto-generates specialized learners** from natural language prompts.

### 4. Black Box Confidence
Users need to know what the system doesn't know. Brain provides **calibrated confidence** and **explicit knowledge gaps**.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    USER PROMPT                           │
│ "Track my coding patterns, preferences, and evolution"   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │    BRAIN     │  ← Orchestrator
              │  (LLM-based  │
              │ decomposition)│
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │Learner1│  │Learner2│  │Learner3│  ← Specialized Agents
   │────────│  │────────│  │────────│
   │"Coding │  │"Style  │  │"Learning│
   │ patterns"│ │ prefs" │ │interests"│
   └────┬───┘  └────┬───┘  └────┬───┘
        │           │           │
        │ Each maintains:       │
        │ • Understanding (text)│
        │ • Evolution history   │
        │ • Activation level    │
        └───────────┴───────────┘
```

---

## Core Concepts

### Brain (Orchestrator)

The top-level coordinator that:
- **Decomposes** natural language prompts into learner specifications via LLM
- **Routes** incoming data to all learners in parallel
- **Synthesizes** responses from multiple learner perspectives via LLM
- **Manages** learner lifecycle through activation tracking

**Key Insight**: Brain doesn't learn directly - it delegates to specialized learners and coordinates their outputs.

### Learners (Specialized Agents)

Independent learning agents with:
- **Instructions**: Specific focus area (e.g., "Track coding philosophy")
- **Understanding**: Narrative text that evolves over time
- **Governance**: Self-assessed activation level based on participation

**Key Insight**: Each learner maintains its own compressed understanding, not raw data.

### Understanding (Compressed Knowledge)

The learner's accumulated knowledge as **plain text**. Properties:
- **Lossy Compression**: Summary, not transcript
- **Evolving**: Updates through synthesis, not replacement
- **Self-contained**: Can answer queries without seeing original data
- **Bounded**: Subject to maintenance strategies (compression, decay)

**Key Insight**: Understanding is the artifact that persists, not the observations.

---

## Learning Flow: Two-Phase Architecture

Brain uses a **two-phase approach** to reduce degradation risk:

### Phase 1: Observe (Extraction)

```
Raw Data → Observe → Observation (text + importance + relevance)
```

**Purpose**: Extract what's relevant to learner's focus
**Output**: Plain text observation + importance score (0-1) + relevance score (0-1)
**Cost**: Low (single LLM call per data chunk)
**Risk**: Low (doesn't modify understanding)

**Example**:
```
Input:  { type: 'code_review', comment: 'Too complex, use factory functions' }
Output: {
  status: 'observed',
  output: 'User prefers factory functions over dependency injection',
  importance: 0.85,
  relevance: 0.92
}
```

### Phase 2: Synthesize (Integration)

```
[Buffered Observations] + Current Understanding → Synthesize → New Understanding
```

**Purpose**: Integrate buffered observations into understanding
**Output**: Updated understanding text + significance level
**Cost**: High (rewrites understanding with full context)
**Risk**: Higher (modifies persistent state)

**Example**:
```
Input:  Current understanding + [10 buffered observations]
Output: {
  status: 'synthesized',
  newUnderstanding: 'The user values pragmatic simplicity...',
  significance: 'moderate',
  summary: 'Updated understanding based on recent coding decisions'
}
```

### Why Two Phases?

**Single-phase problems**:
- Every data point modifies understanding → high degradation risk
- No buffering → inefficient (too many expensive LLM calls)
- No importance filtering → noise accumulates in understanding

**Two-phase benefits**:
- Understanding only changes during synthesis (controlled updates)
- Buffer enables batch processing (efficient LLM usage)
- Importance and relevance scores filter noise before synthesis

---

## Observation Buffer & Synthesis Triggers

Observations accumulate in a buffer until synthesis triggers:

### Buffer Thresholds

1. **Count Threshold**: `minBufferSize: 5`
   - Minimum observations before synthesis allowed
   - Default trigger at `maxBufferSize: 10`

2. **Size Threshold**: `maxTokens: estimated`
   - When buffer text exceeds token limit → synthesize

3. **Force Synthesis**: Manual trigger
   - Used when injection completes
   - Ensures all buffered observations get processed

**Any threshold met** → synthesis runs → buffer clears → understanding updates

### Why Buffer?

- **Efficiency**: Batch processing reduces expensive synthesis calls
- **Context**: Synthesize sees patterns across multiple observations
- **Quality**: More observations → better pattern detection

---

## Understanding Maintenance Strategies

How understanding evolves and scales over time:

### Strategy 1: Continuous (Default)

Understanding **grows continuously** by merging new observations with existing knowledge.

```
t0: ""
t1: "User prefers Express over NestJS"
t2: "User prefers Express... Uses explicit error handling with Result types"
t3: "User prefers Express... Result types... Exploring Effect-TS patterns"
```

**Compression trigger**: Understanding exceeds `maxTokens` → cycle resets
**Use case**: Tracking evolving patterns over time

### Strategy 2: Cumulative

Similar to continuous but with **periodic compression** to distill core insights.

```
Core understanding + Recent observations → Compressed core + Fresh recent
```

**Compression trigger**: Understanding size threshold
**Use case**: Balance between history and recency

### Strategy 3: Decay

Recent observations **weighted higher** than old ones, with gradual forgetting.

```
Old observations fade → Recent observations dominate → Eventual reset
```

**Decay trigger**: Time-based or observation-based
**Use case**: Tracking current state, not full history

---

## Query Flow: Multi-Perspective Synthesis

When user asks a question, Brain orchestrates learner responses:

```
User Query
    │
    ▼
┌─────────────────────────────────────────┐
│ Brain: Query ALL learners in parallel   │
└────────────┬────────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
Learner1  Learner2  Learner3
    │        │        │
    │ Each returns:  │
    │ • relevant: boolean
    │ • confidence: 0-1
    │ • insight: text
    │ • gaps: string
    │        │        │
    └────────┼────────┘
             │
             ▼
┌───────────────────────────────────────┐
│ Brain Synthesis (LLM)                 │
│ • Integrate perspectives              │
│ • Resolve conflicts                   │
│ • Aggregate gaps                      │
└────────────┬──────────────────────────┘
             │
             ▼
    Unified Response
    • insight: synthesized answer
    • sources: [learner1, learner2, ...]
    • gaps: aggregated unknowns
    • confidence: weighted average
```

### Query Methods

**Direct Query** (Default): Single LLM call with structured output
- Fast, deterministic, cost-effective
- Best for straightforward questions

**Tool-Based Query**: LLM uses tools in loop until complete
- More flexible, can reason step-by-step
- Best for complex questions requiring multi-step thinking

---

## Self-Governance & Activation

Learners self-assess their relevance through **activation tracking**:

### Activation Mechanics

Computed from:
- **Observation Relevance**: Average relevance of recent observations (0-1)
- **Participation Rate**: Frequency of observations vs dismissals
- **Query Performance**: Confidence and relevance in recent queries

Formula: Weighted combination of these signals

### Lifecycle States

```
ACTIVE (high activation)
    ↓ declining relevance
MONITORING (medium activation)
    ↓ prolonged inactivity
DORMANT (low activation)
```

**Why?**: Inactive learners don't participate in queries, reducing noise and cost.

---

## Self-Evolution & Signal System (Living Brain)

The Brain can autonomously evolve its learner set through a **signal-driven evolution system**:

### Signal System

Learners continuously monitor their own effectiveness and emit **signals** when they detect issues:

**Signal Types**:

1. **High Dismissal Rate**: `dismissalRate > maxDismissalRate (0.8)`
   - Learner is rejecting most observations
   - Suggests scope mismatch or redundancy

2. **Low Confidence**: `avgConfidence < minConfidence (0.3)`
   - Query responses consistently have low confidence
   - Suggests inadequate understanding or scope issues

3. **Stagnation**: `observationsSinceLastSynthesis > maxObservationsWithoutSynthesis (100)`
   - No synthesis happening despite many observations
   - Suggests all observations deemed irrelevant

**Signal Flow**:

```
Learner crosses threshold
    ↓
Emit 'learner:signal' event
    ↓
Brain receives and forwards to Evaluator
    ↓
Evaluator buffers signal
    ↓
When buffer reaches threshold → Evaluation
```


### Evaluator Component

The **Evaluator** is the decision-making component that:

1. **Buffers Signals**: Accumulates signals until threshold reached (default: 5)
2. **Uses Tools to Investigate**: LLM can selectively fetch learner understandings as needed
3. **Generates Decisions**: Returns structured evolution decisions via tool call
4. **Outputs Guidance**: Provides natural language guidance for action handlers

**Tool-Based Architecture**:

The evaluator uses a **two-tool approach** for intelligent decision-making:

```
Signals arrive → evaluate() called
       ↓
LLM sees: signals + brain purpose + all learner metadata (lightweight)
       ↓
LLM reasons: "High dismissal on A and B, let me check overlap"
       ↓
LLM calls: getUnderstandings(["A", "B"])  ← investigation tool
       ↓
Tool returns understanding texts
       ↓
LLM continues reasoning, makes decision
       ↓
LLM calls: finalizeDecisions([...])  ← done tool
       ↓
Extract decisions from tool call
```

**Available Tools**:

| Tool                                 | Purpose                                                   |
|--------------------------------------|-----------------------------------------------------------|
| `getUnderstandings({ learnerIds })`  | Fetch accumulated knowledge for specified learners        |
| `finalizeDecisions({ decisions })`   | Return final evolution decisions (terminates evaluation)  |

**Why Tools?**: Unlike structured output that requires all context upfront, tools let the LLM investigate selectively. A learner with 10KB of understanding only gets fetched if the LLM needs to diagnose it.

**Evaluation Process**:

```typescript
// Evaluator receives 5+ signals
const decisions = await evaluator.evaluate()

// LLM investigates via tools and returns decisions
[
  {
    action: 'split',
    reasoning: 'Learner1 has high dismissal rate on backend topics',
    guidance: 'Split into frontend-focused and backend-focused learners',
    targets: ['learner1']
  },
  {
    action: 'merge',
    reasoning: 'Learner2 and Learner3 have 80% overlap in responses',
    guidance: 'Combine into single unified testing practices learner',
    targets: ['learner2', 'learner3']
  }
]
```

**Decision Frameworks**:

The evaluator uses two specialized frameworks depending on signal types:

1. **System Directive Framework** (source: "brain"): Applied when the brain's purpose changes. Classifies intent (related pivot, unrelated pivot, expansion, narrowing, refinement, reset) and applies matching rules.

2. **Governance Framework** (source: learner ID): Applied for learner performance signals. Guides investigation through diagnostic questions:
   - Is the topic exhausted? (stagnation often means success)
   - Is the scope too narrow?
   - Is there overlap with another learner?
   - Is this a systemic issue?


### Evolution Actions

Five evolution actions can modify the learner set:


1. **create**: Generate new learner from guidance
   - Use case: Coverage gap identified
   - Process: LLM generates config → Brain creates learner

2. **merge**: Combine multiple learners into one
   - Use case: Redundant or overlapping learners
   - Process: LLM synthesizes configs + understandings → Create unified learner → Delete originals

3. **split**: Divide one learner into multiple focused learners
   - Use case: Learner too broad or unfocused
   - Process: LLM generates focused configs → Create new learners → Delete original

4. **update**: Update existing learner configuration
   - Use case: Scope refinement, threshold tuning
   - Process: LLM generates config updates → Apply to learner → Regenerate prompts if needed

5. **delete**: Remove ineffective or dormant learner
   - Use case: Permanently irrelevant learner
   - Process: Remove from Brain → Clean up references

**Action Handler Pattern**:
```
Decision (guidance)
    ↓
LLM generates config/understanding
    ↓
Execute structural change
    ↓
Emit 'evolution:action:executed' event
```

### Evolution Configuration

```typescript
{
  evolution: {
    enabled: true,                    // Enable autonomous evolution
    evaluatorSignalThreshold: 5,      // Signals before evaluation
    autoEvaluate: true                // Auto-evaluate when threshold reached
  }
}
```

**Manual Evolution API**:
```typescript
// Trigger evaluation manually
await brain.evaluateEvolution()

// Direct evolution actions
await brain.createLearner('Track API design patterns')
await brain.mergeLearners(['learner1', 'learner2'], 'Unified testing learner')
await brain.splitLearner('learner3', 'Split into unit and integration learners')
await brain.updateLearner('learner4', 'Narrow scope to React hooks only, increase importance threshold')
await brain.deleteLearner('learner5')
```

### Signal Thresholds Configuration

Signal thresholds are configurable at the learner level:

```typescript
{
  governance: {
    signalThresholds: {
      maxDismissalRate: 0.8,                    // Ceiling threshold
      minConfidence: 0.3,                        // Floor threshold
      maxObservationsWithoutSynthesis: 100       // Stagnation detection
    }
  }
}
```

**Naming Pattern**: `min`/`max` prefixes follow standard monitoring conventions:
- `maxDismissalRate`: Alert when dismissal rate **exceeds** this ceiling
- `minConfidence`: Alert when confidence **falls below** this floor

### Why Living Brain?

**Organic Evolution**: System adapts its structure based on actual usage patterns, not predetermined rules.

**Self-Correcting**: Detects and resolves issues like redundancy, gaps, and overload automatically.

**Transparent**: All evolution actions are event-driven and auditable.

**Conservative**: Evaluator can output zero decisions if signals don't warrant changes.

---

## Cascading Configuration

Model selection flows from **specific → general**:

```
Operation-level model
    ↓ (if not set)
Phase-level model (observe/synthesize/query)
    ↓ (if not set)
Learner-level model
    ↓ (if not set)
Brain-level model (required)
```

**Example Cost Optimization**:
```
Brain model: sonnet-4.5          (balanced default)
    ↓
Observe model: flash-001         (fast, cheap - high volume)
Synthesize model: opus-4.5       (smart, expensive - critical thinking)
Query model: sonnet-4.5          (balanced - user-facing)
```

**Why?**: Optimize cost vs quality - use fast models for high-volume operations, smart models for critical reasoning.

---

## Runtime Configuration: brain.update()

Brain configuration can be updated at runtime. Changes are categorized by their downstream effect:

### Category 1: Brain-Only (No Downstream Effect)

These update brain config without affecting learners:

| Field                              | Notes                                    |
|------------------------------------|------------------------------------------|
| `init.model`                       | Decomposition model (init-time only)     |
| `query.model`                      | Brain-level query synthesis model        |
| `ingest.batchSize`                 | Batch size for inject operations         |
| `evolution.enabled`                | Enable/disable evolution system          |
| `evolution.evaluatorSignalThreshold` | Signal count before auto-evaluation    |
| `evolution.autoEvaluate`           | Whether to auto-evaluate on threshold    |

### Category 2: Mechanical Cascade (Direct to Learners)

These are forwarded to all learners via `learner.update()`:

| Field                                | Forwarded as                             |
|--------------------------------------|------------------------------------------|
| `model`                              | `learner.update({ model })`              |
| `blueprintModel`                     | `learner.update({ blueprintModel })`     |
| `learning.observe.model`             | `learner.update({ observe: { model } })` |
| `learning.synthesize.thresholds.*`   | `learner.update({ synthesize: {...} })`  |
| `learning.maintenance.strategy`      | `learner.update({ maintenance: {...} })` |

Learners handle their own internal cascade and decide what to do with each field.

### Category 3: Signal-Driven (Evaluator Decides)

These are semantic changes that affect learner purpose/identity. Brain generates a **bypass signal** to the evaluator:

| Field                  | Notes                              |
|------------------------|------------------------------------|
| `prompt`               | Brain's purpose changed            |
| `learning.instructions`| Learner instructions change request|
| `learning.name`        | Learner name change request        |
| `learning.description` | Learner description change request |

**Bypass signals** trigger immediate evaluation regardless of threshold. The evaluator decides how to restructure learners based on the purpose change (update existing, delete irrelevant, create new).

**Flow**:
```
brain.update({ prompt: "new purpose" })
       ↓
Signal with bypass: true
       ↓
Immediate evaluation
       ↓
Evaluator returns decisions
       ↓
Execute: update/delete/create learners
       ↓
Return result with evolutionResults
```

---

## LLM Layer: Centralized Abstraction

All LLM interactions go through a **thin wrapper** over Vercel AI SDK:

```
┌──────────────────────────────────────────────────────┐
│ Application (Brain, Learners, Query Methods)         │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ LLM Wrapper: generate()                              │
│ • Mirrors ai-sdk generateText API exactly            │
│ • Adds JSON repair fallback                          │
│ • Single point for usage tracking                    │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ Vercel AI SDK: generateText()                        │
│ • Structured output: Output.object({ schema })       │
│ • Tool loops: stopWhen: stepCountIs(N)               │
│ • Usage tracking: result.usage                       │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ LLM Provider (OpenRouter)                            │
│ • Multi-provider access (Gemini, Claude, GPT-4, etc) │
└──────────────────────────────────────────────────────┘
```

**Benefits**:
- Single point of control for all LLM interactions
- JSON repair handles malformed structured output
- Consistent error handling and retries
- Centralized usage tracking and cost monitoring

---

## Event System: Real-Time Observability

Brain and learners emit typed events for monitoring and UI updates:

### Event Categories

**Brain Events**:
- `brain:init:started` → Learner generation begins
- `brain:init:completed` → All learners created and ready
- `brain:inject:batch:started` → Processing data batch
- `brain:inject:batch:completed` → Batch processed by all learners
- `brain:ask:started` → Query initiated
- `brain:ask:synthesis:completed` → Final response synthesized

**Learner Events**:
- `learner:observed` → Observation extracted from data
- `learner:observe:dismissed` → Data deemed irrelevant
- `learner:synthesized` → Understanding updated
- `learner:understanding:updated` → New understanding available
- `learner:activation:changed` → Activation level changed

**Why Events?**:
- Real-time monitoring and debugging
- UI updates via Server-Sent Events (SSE)
- Audit trail for understanding evolution
- Performance and cost tracking

---

## Design Patterns & Decisions

### 1. Identity Generation Pattern

**Problem**: System prompts need to be reusable but context-specific

**Solution**: One-time LLM call generates learner "identity" (role, focus, perspective), used to build system prompts

```
Learner Instructions
    ↓
LLM generates Identity { role, focus, style, perspective }
    ↓
System Prompt Template + Identity → Reusable System Prompt
```

**Benefit**: Separates prompt generation (expensive, one-time) from usage (reusable, consistent)

### 2. Discriminated Unions for Results

**Problem**: Operations can succeed, fail, or dismiss - need type-safe handling

**Solution**: Status field determines result shape

```typescript
{ status: 'observed', output: string, importance: number }
{ status: 'dismissed', reason: string }
{ status: 'error', error: string }
```

**Benefit**: Type safety ensures all cases handled, no silent failures

### 3. Buffer-Triggered Synthesis

**Problem**: When to update understanding?

**Solution**: Multiple thresholds (count, size, importance) trigger synthesis

**Why not continuous?**: Batching reduces LLM calls, improves pattern detection, lowers degradation risk

### 4. Parallel Learner Processing

**Problem**: How to route data to learners?

**Solution**: Send to all learners in parallel, each decides relevance via observe phase

**Why not selective?**: Simpler orchestration, learners self-filter, emergent specialization

---

## Key Tradeoffs

### 1. Compressed Understanding vs Raw Data Storage

**Choice**: Store compressed understanding (text), not raw observations

**Tradeoffs**:
- ✅ Constant memory usage regardless of data volume
- ✅ Faster queries (no search through raw data)
- ✅ Privacy-friendly (original data can be discarded)
- ❌ Lossy compression (details may be forgotten)
- ❌ Can't re-analyze original data with new questions

**Design Decision**: Favor scalability and privacy over perfect recall

### 2. Two-Phase vs Single-Phase Learning

**Choice**: Separate observe (extraction) from synthesize (integration)

**Tradeoffs**:
- ✅ Lower degradation risk (controlled understanding updates)
- ✅ Importance-based filtering before synthesis
- ✅ More efficient (buffer reduces synthesis frequency)
- ❌ Additional complexity (two LLM calls per learning cycle)
- ❌ Buffering delay (understanding not immediately updated)

**Design Decision**: Favor stability and quality over immediacy

### 3. Auto-Generated vs Manual Learners

**Choice**: LLM decomposes user prompt into learners automatically

**Tradeoffs**:
- ✅ User-friendly (natural language interface)
- ✅ Adaptive specialization (learners match use case)
- ✅ No upfront domain modeling required
- ❌ Non-deterministic (same prompt may generate different learners)
- ❌ Upfront cost (tokens spent on decomposition)
- ❌ Less control over learner structure

**Design Decision**: Favor ease of use and adaptability over determinism

### 4. Parallel Routing vs Selective Routing

**Choice**: Send data to all learners, let them self-filter

**Tradeoffs**:
- ✅ Simple orchestration (no routing logic)
- ✅ Learners self-govern (emergent specialization)
- ✅ No missed opportunities (all learners see all data)
- ❌ Higher cost (all learners run observe phase)
- ❌ Wasted processing on irrelevant data
- ❌ Scales linearly with learner count

**Design Decision**: Favor simplicity and emergence over efficiency at small scale

---

## System Constraints & Limitations

### Memory
- Understanding stored in-memory only (no persistence)
- No serialization/deserialization of learner state
- Limited by Node.js heap (~2GB default)

### Scaling
- Single-process architecture (no distribution)
- Learners processed in parallel within process
- Suitable for: 5-50 learners, 100-10K data items
- Not suitable for: 1000+ learners, millions of data items

### Cost
- LLM calls per injection: `learners × (observe calls + synthesis calls)`
- Typical ratio: 10 observations → 1 synthesis per learner
- Recommend fast models for observe phase to control costs

### Latency
- Query latency: `max(learner queries) + synthesis`
- Parallel queries help, but slowest learner bottlenecks
- Synthesis adds ~1-2s for response integration

---

## Comparison to Alternative Approaches

### vs RAG (Retrieval-Augmented Generation)
- **RAG**: Store raw data → retrieve relevant chunks → generate answer
- **Brain**: Compress understanding → query compressed knowledge → synthesize
- **Tradeoff**: RAG preserves all details, Brain scales with constant memory

### vs Fine-Tuning
- **Fine-tuning**: Update model weights on training data
- **Brain**: Maintain external understanding, base model unchanged
- **Tradeoff**: Fine-tuning permanent and opaque, Brain reversible and inspectable

### vs Long-Context Models
- **Long-context**: Fit all data in single prompt (100K-1M tokens)
- **Brain**: Compress via synthesis, query compressed form
- **Tradeoff**: Long-context needs full data each query, Brain maintains state

### vs Agent Frameworks (AutoGPT, LangChain)
- **Agent frameworks**: Tools + reasoning loops for task execution
- **Brain**: Persistent learning + understanding evolution
- **Tradeoff**: Agents stateless and task-focused, Brain stateful and learning-focused

---

## Future Directions

### 1. Persistence & Serialization
- Save/load learner state (understanding + metadata)
- Resume from snapshots across sessions
- Export/import learner configurations

### 2. Advanced Learner Types
- ListLearners: structured tracking (commitments, tasks, entities)
- GraphLearners: relationship understanding
- VisionLearners: image/video pattern recognition

### 3. Multi-Modal Learning
- Vision learners (process images, diagrams, screenshots)
- Audio learners (process conversations, podcasts)
- Structured learners (process databases, APIs, spreadsheets)

### 4. Selective Routing
- Learn which learners should see which data
- Reduce wasted observe calls
- Scale to 100+ learners efficiently

### 5. Vector Integration
- Hybrid approach: compressed understanding + vector search
- Use vectors for recall, understanding for synthesis
- Best of both worlds

---

## Current Implementation vs Ultimate Vision

### What Exists Today (brain-v0)

Brain-v0 implements the **core learning mechanics**:

```
Raw Data
    ↓
Brain (orchestrator)
    ↓
Learners (two-phase learning)
    ├─ Observe: extract relevant observations
    ├─ Buffer: accumulate until threshold
    └─ Synthesize: update understanding
    ↓
Understanding (compressed knowledge, in-memory)
    ↓
Query → Brain synthesis → Response
```

**What's included**:
- Brain orchestrator with LLM-based learner decomposition
- TextLearners with two-phase learning (observe + synthesize)
- Understanding maintenance strategies (continuous, cumulative, decay)
- Query synthesis across multiple learners
- Cascading configuration for cost optimization
- Event system for observability

**What's missing**:
- Augmentation pipeline (perceivers)
- Persistent storage layers
- Subjects (multi-tenant scoping)
- Multi-modal learners (vision, audio, structured data)

### Ultimate Vision: Full Cognitive Architecture

The complete Brain system will integrate **three layers**:

```
┌──────────────────────────────────────────────────────────────┐
│                       RAW DATA                               │
│  (text, images, audio, videos, databases, APIs)              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│               PERCEIVERS (Augmentators)                      │
│  Stateless agents that extract, enrich, normalize            │
│                                                              │
│  Tools: OCR, transcription, entity extraction, chunking,     │
│         summarization, classification, enrichment            │
│                                                              │
│  Output: { summary, content[], metadata }                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   STORAGE (Optional BYODB)                   │
│  Three-layer persistence for recall and context             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ RAW LAYER                                          │     │
│  │ • Original data preservation                       │     │
│  │ • Re-processing capability                         │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ RECORDS LAYER                                      │     │
│  │ • High-level semantic search (summary embeddings)  │     │
│  │ • "Find documents about X"                         │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ CHUNKS LAYER                                       │     │
│  │ • Precise semantic search (content embeddings)     │     │
│  │ • "Find the paragraph about Y"                     │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ GRAPH LAYER                                        │     │
│  │ • Entity relationships and connections             │     │
│  │ • "How are X and Y related?"                       │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   LEARNERS (Understanding)                   │
│  Stateful agents that build compressed understanding         │
│                                                              │
│  • TextLearners: narrative understanding                    │
│  • ListLearners: structured tracking (commitments, tasks)   │
│  • GraphLearners: relationship understanding                │
│  • VisionLearners: image/video pattern recognition          │
│                                                              │
│  Two-phase learning: Observe → Buffer → Synthesize          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    UNDERSTANDING                             │
│  Compressed, evolving knowledge (persistent)                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   QUERIES    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Storage (Recall) │      │Learners (Pattern)│
    │ "What happened?" │      │ "What's the      │
    │ "Find specific..." │    │  pattern?"       │
    └──────────────────┘      └──────────────────┘
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Query Synthesis │
                  │ (LLM combines)  │
                  └────────┬────────┘
                           │
                           ▼
                      Response
```

### Why Build Learning-First?

The current implementation focuses on **learning mechanics** because:

1. **Core Complexity**: Learning algorithms (observe, synthesize, maintenance) are the hardest problems
2. **Foundation**: Everything else (augmentation, storage) is simpler once learning works
3. **Validation**: Can test learning quality with raw data before adding pipeline complexity
4. **Iteration**: Easier to experiment with learning strategies in isolation

The augmentation pipeline and storage layers are **important but orthogonal** - they extend capability without changing core learning mechanics.

### Evolution Path

**Phase 1**: Core learning system
- ✅ Brain orchestration
- ✅ Learner decomposition
- ✅ Two-phase learning
- ✅ Understanding synthesis
- ✅ Query synthesis

**Phase 2 (Complete)**: Self-Evolution
- ✅ Signal system with threshold monitoring
- ✅ Evaluator component with tool-based investigation
- ✅ Evolution action handlers (create, merge, split, update, delete)
- ✅ Full autonomous evolution flow

**Phase 3**: Persistence & Recovery
- ⚪ Save/load learner state
- ⚪ Serialize understanding
- ⚪ Resume from snapshots

**Phase 4**: Storage Integration
- ⚪ Raw data preservation
- ⚪ Vector search (records + chunks)
- ⚪ Hybrid queries (storage + learners)

**Phase 5**: Augmentation Pipeline
- ⚪ Perceiver agents (extraction, enrichment)
- ⚪ Multi-modal input processing
- ⚪ Entity normalization

**Phase 6**: Advanced Features
- ⚪ Subjects (multi-tenant scoping)
- ⚪ Graph relationships
- ⚪ Advanced learner types (List, Graph, Vision)

---

## Summary

**Brain is a learning orchestrator** that:

1. **Decomposes** natural language prompts into specialized learners via LLM
2. **Maintains** compressed understanding as persistent narrative text
3. **Separates** extraction (observe) from integration (synthesize) for stability
4. **Synthesizes** multi-perspective responses with confidence and gap awareness
5. **Self-governs** through activation tracking and lifecycle management

**Core Innovation**: Persistent, multi-perspective understanding that evolves continuously while avoiding catastrophic forgetting and context limitations through two-phase learning and compressed representations.

**Current Status**: Phase 2 complete (self-evolution)
**Organization**: [Unbody](https://unbody.io)
**License**: MIT
