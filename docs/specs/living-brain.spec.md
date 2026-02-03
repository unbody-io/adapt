# Living Brain Specification

> **Status:** Design Specification
> **Version:** 1.0
> **Date:** 2026-02-03

## Table of Contents

1. [Overview & Concepts](#1-overview--concepts)
2. [System Architecture](#2-system-architecture)
3. [Detailed Component Specs](#3-detailed-component-specs)
4. [API/Interface Definitions](#4-apiinterface-definitions)
5. [Event & Data Schemas](#5-event--data-schemas)
6. [Configuration Schemas](#6-configuration-schemas)

---

## 1. Overview & Concepts

### 1.1 Vision

The Living Brain extends the base Brain architecture with **autonomous evolution capabilities**. Instead of a static set of learners, the system continuously adapts its structure based on signals from operations, learner self-reporting, and external input.

The Brain becomes a **living system** that:
- Spawns new learners when gaps are detected
- Merges redundant learners
- Splits overly broad learners
- Adjusts learner configurations based on performance
- Prunes inactive or ineffective learners

### 1.2 Core Principles

**1. Autonomous Adaptation**
Evolution happens automatically without human approval. The system is fully self-governing.

**2. Signal-Driven**
All evolution decisions are triggered by observable signals from:
- Learners self-reporting performance issues (mechanical thresholds)
- Manual signals from users or external systems
- Brain monitor analysis (TBD - future enhancement)

**3. Intelligent Decision Making**
A centralized **Judge** component receives signals, analyzes system state, and makes evolution decisions using LLM intelligence.

**4. Consistent Execution Pattern**
All evolution actions follow the same pattern:
```
Guidance (natural language) → LLM → Generated Config/Understanding → Execute
```

**5. Full Runtime Mutability**
Every parameter of every learner can be updated at runtime. The system is never "locked in."

### 1.3 Key Components

```
┌─────────────────────────────────────────────────────────┐
│                         Brain                           │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │   Learner   │  │   Learner   │  │    Learner     │  │
│  │  (signals)  │  │  (signals)  │  │   (signals)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬───────┘  │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│                    ┌───────────┐                        │
│                    │   Judge   │                        │
│                    │ (buffers  │                        │
│                    │  signals) │                        │
│                    └─────┬─────┘                        │
│                          │                              │
│                          ▼                              │
│                   ┌─────────────┐                       │
│                   │  Evolution  │                       │
│                   │   Actions   │                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
         ▲
         │
    External Signals
    (brain.signal())
```

---

## 2. System Architecture

### 2.1 Evolution Flow

```
1. Signal Emission
   ├─ Learner mechanical threshold crossed → emit signal event
   ├─ External source → brain.signal(description)
   └─ Brain forwards to Judge

2. Judge Buffering
   └─ Accumulate signals until buffer threshold reached (fixed: 5 signals)

3. Judge Evaluation
   ├─ Receive full system context (lightweight learner overview)
   ├─ Tools available to fetch detailed learner state
   ├─ LLM analyzes signals + context
   └─ Output: 0 to N evolution decisions

4. Brain Execution
   ├─ Receive decisions from Judge
   ├─ Execute sequentially in order
   ├─ Each action uses LLM to generate configs/understandings
   └─ Emit evolution events

5. System Update
   └─ Learner set changes, new signals may be generated
```

### 2.2 Decision → Execution Mapping

| Judge Decision | Brain Action | LLM Usage |
|----------------|--------------|-----------|
| `spawn` | Create new learner | Generate learner config from guidance |
| `merge` | Merge 2+ learners | Synthesize configs + understandings into one |
| `split` | Split learner into 2+ | Divide config + understanding into multiple |
| `adjust` | Update learner config | Generate partial/full config updates from guidance |
| `prune` | Delete learner | None (direct deletion) |

### 2.3 Two Evolution Modes

**Organic (Autonomous)**
- Learners self-report via mechanical thresholds
- Judge automatically evaluates buffered signals
- Evolution happens without human intervention

**Manual (Steered)**
- User sends signals: `brain.signal({ description })`
- User triggers evaluation: `brain.evaluateEvolution()`
- User executes actions directly: `brain.spawn(guidance)`, `brain.merge([ids])`, etc.

---

## 3. Detailed Component Specs

### 3.1 Judge Component

#### 3.1.1 Responsibilities

The Judge is a centralized decision-making component that:
1. Receives signals from any source (learners, Brain, external)
2. Buffers signals until evaluation threshold
3. Analyzes system state with LLM intelligence
4. Outputs evolution decisions (0 to N per evaluation)
5. Has full read access to Brain and all learners

#### 3.1.2 Context Model

**Always Included (Lightweight Overview):**
```typescript
{
  signal: {
    source: string,
    description: string,
    timestamp: Date
  }[],
  brain: {
    prompt: string,
    config: BrainConfig
  },
  learners: [{
    id: string,
    name: string,
    purpose: string,  // from instructions
    type: 'text' | 'list' | 'graph',
    governance: {
      activation: number,
      status: 'active' | 'dormant' | 'archived',
      lastAccessed: Date
    }
  }]
}
```

**Available via Tools (On-Demand):**
- `getLearnerConfig(id)` → full instructions, thresholds, strategy
- `getLearnerUnderstanding(id)` → current synthesized knowledge
- `getLearnerActivity(id)` → detailed stats, recent observations
- `getRecentHistory()` → past evolution decisions

#### 3.1.3 Signal Buffer

- **Type:** Fixed threshold buffer
- **Threshold:** 5 signals (hardcoded constant)
- **Behavior:** When buffer reaches threshold, trigger evaluation
- **Manual Override:** `brain.evaluateEvolution()` evaluates immediately regardless of buffer state

#### 3.1.4 Decision Output Schema

```typescript
interface EvolutionDecision {
  action: 'spawn' | 'merge' | 'split' | 'adjust' | 'prune'
  reasoning: string          // Why this decision
  guidance: string           // Natural language guidance for LLM action handler
  targets: string[]          // Affected learner IDs (empty for spawn)
}
```

**Examples:**

```typescript
// Spawn
{
  action: 'spawn',
  reasoning: 'Queries about error handling consistently get low confidence responses',
  guidance: 'Track user error handling preferences and patterns',
  targets: []
}

// Merge
{
  action: 'merge',
  reasoning: 'Learners "coding-style" and "dev-philosophy" show 80% overlap in responses',
  guidance: 'Merge into unified coding philosophy learner',
  targets: ['coding-style', 'dev-philosophy']
}

// Split
{
  action: 'split',
  reasoning: 'Learner "preferences" handles both UI and communication, too broad',
  guidance: 'Split into UI preferences and communication preferences',
  targets: ['preferences']
}

// Adjust
{
  action: 'adjust',
  reasoning: 'Learner "preferences" dismisses 90% of UI-related data',
  guidance: 'Expand scope to include UI layout and color scheme preferences',
  targets: ['preferences']
}

// Prune
{
  action: 'prune',
  reasoning: 'Learner "temp-tracker" has been dormant for 1000+ operations',
  guidance: '',  // No guidance needed for deletion
  targets: ['temp-tracker']
}
```

### 3.2 Signal System

#### 3.2.1 Signal Sources

**1. Learner Self-Reporting (Mechanical Thresholds)**

Learners monitor their own performance metrics and emit signals when thresholds are crossed:

| Metric | Threshold | Signal Description |
|--------|-----------|-------------------|
| Dismissal Rate | > 80% | "I'm dismissing {X}% of observations" |
| Low Confidence | Avg < 0.3 over last 5 queries | "My query confidence is consistently low ({X})" |
| Buffer Overflow | Buffer exceeds maxObservations * 1.5 | "My buffer is consistently overflowing ({X} observations)" |
| Stagnation | No synthesis in last 100 observations | "No synthesis in {X} observations" |
| Activation Decay | Activation drops below threshold | "I've become dormant (activation: {X})" |

**2. Manual Signals (External)**

Any external source can send signals:
```typescript
brain.signal({
  source: 'user',
  description: 'I notice you\'re not tracking my UI preferences'
})
```

**3. Brain Monitor (TBD - Future)**

An LLM-based analyzer that watches Brain operations and detects patterns. Buffers observations and periodically analyzes for systemic issues.

#### 3.2.2 Signal Routing

**From Learners:**
```typescript
learner.emit('signal', { description: '...' })
→ Brain listens and forwards to Judge
```

**From External:**
```typescript
brain.signal({ source: 'user', description: '...' })
→ Brain forwards to Judge
```

**To Judge:**
```typescript
judge.signal({ source, description, timestamp })
→ Judge buffers signal
→ When buffer threshold reached, triggers evaluation
```

### 3.3 Evolution Actions

All actions follow the pattern: **Guidance → LLM → Execute**

#### 3.3.1 Spawn

**Purpose:** Create new learner to fill coverage gap

**Input:**
```typescript
{
  action: 'spawn',
  guidance: string  // "Track user error handling preferences"
}
```

**Execution:**
```typescript
async spawn(guidance: string): Promise<TextLearner> {
  // Use existing learner generation mechanism
  const config = await generateLearnerConfig(guidance)
  const learner = await createLearnerFromConfig(config)
  return learner
}
```

**LLM Prompt Template:**
```
Generate a learner configuration for the following purpose:

{guidance}

Output the learner config in the standard format (id, name, description, instructions, type, maintenance).
```

**Events:**
- Reuses existing `brain:learner:added` event
- Plus `evolution:action:executed` with action details

#### 3.3.2 Merge

**Purpose:** Combine redundant/overlapping learners into one

**Input:**
```typescript
{
  action: 'merge',
  guidance: string,  // "Merge into unified coding philosophy learner"
  targets: string[]  // ['coding-style', 'dev-philosophy']
}
```

**Execution:**
```typescript
async merge(learnerIds: string[], guidance: string): Promise<TextLearner> {
  // Fetch learners
  const learners = learnerIds.map(id => getLearner(id))

  // LLM: merge configs + understandings
  const mergedConfig = await generateMergedLearner({
    learners: learners.map(l => ({
      config: l.getConfig(),
      understanding: l.getUnderstanding()
    })),
    guidance
  })

  // Create new learner with merged config + understanding
  const newLearner = await createLearnerFromConfig(mergedConfig.config)
  await newLearner.setUnderstanding(mergedConfig.understanding)

  // Delete old learners
  learnerIds.forEach(id => deleteLearner(id))

  return newLearner
}
```

**LLM Prompt Template:**
```
You are merging multiple learners into one unified learner.

Guidance: {guidance}

Learners to merge:
{for each learner:}
  ID: {id}
  Config: {config as JSON}
  Understanding: {understanding}

Output:
1. New learner config (id, name, description, instructions, type, maintenance)
2. Merged understanding (synthesize both understandings into unified narrative)
```

**Events:**
- `evolution:action:executed` with merge details
- `brain:learner:added` for new learner
- `brain:learner:removed` for each deleted learner (if we add this event)

#### 3.3.3 Split

**Purpose:** Divide overly broad learner into focused ones

**Input:**
```typescript
{
  action: 'split',
  guidance: string,  // "Split into UI preferences and communication preferences"
  targets: string[]  // ['preferences']
}
```

**Execution:**
```typescript
async split(learnerId: string, guidance: string): Promise<TextLearner[]> {
  const learner = getLearner(learnerId)

  // LLM: divide config + understanding
  const splitConfigs = await generateSplitLearners({
    config: learner.getConfig(),
    understanding: learner.getUnderstanding(),
    guidance
  })

  // Create new learners (2 or more)
  const newLearners = await Promise.all(
    splitConfigs.map(async (sc) => {
      const newLearner = await createLearnerFromConfig(sc.config)
      await newLearner.setUnderstanding(sc.understanding)
      return newLearner
    })
  )

  // Delete original
  deleteLearner(learnerId)

  return newLearners
}
```

**LLM Prompt Template:**
```
You are splitting a learner into multiple focused learners.

Guidance: {guidance}

Original learner:
  Config: {config as JSON}
  Understanding: {understanding}

Output an array of new learner configs, each with:
1. New learner config (id, name, description, instructions, type, maintenance)
2. Portion of understanding relevant to this new learner

Divide the understanding appropriately across the new learners.
```

**Events:**
- `evolution:action:executed` with split details
- `brain:learner:added` for each new learner
- `brain:learner:removed` for original learner

#### 3.3.4 Adjust

**Purpose:** Update existing learner configuration

**Input:**
```typescript
{
  action: 'adjust',
  guidance: string,  // "Expand scope to include UI preferences"
  targets: string[]  // ['preferences']
}
```

**Execution:**
```typescript
async adjust(learnerId: string, guidance: string): Promise<void> {
  const learner = getLearner(learnerId)

  // LLM: generate updated config (partial or full)
  const updates = await generateConfigUpdates({
    currentConfig: learner.getConfig(),
    guidance
  })

  // Apply updates via learner.update()
  await learner.update(updates)
}
```

**LLM Prompt Template:**
```
You are adjusting a learner's configuration based on guidance.

Guidance: {guidance}

Current config:
{config as JSON}

Output updated config fields (partial or full). Only include fields that need to change.
You can update:
- instructions (semantic)
- name, description (semantic)
- maintenance.strategy (semantic)
- thresholds (mechanical)
- governance.signalThresholds (mechanical)

You CANNOT update:
- id (immutable)
- origin (immutable)
- type (immutable)
- models (Brain-controlled)

Output the config changes as JSON.
```

**Events:**
- `evolution:action:executed` with adjust details
- `learner:config:updated` (if we add this event)

#### 3.3.5 Prune

**Purpose:** Delete ineffective or dormant learner

**Input:**
```typescript
{
  action: 'prune',
  guidance: '',  // Not needed for deletion
  targets: string[]  // ['temp-tracker']
}
```

**Execution:**
```typescript
async prune(learnerId: string): Promise<void> {
  deleteLearner(learnerId)
  // Hard delete, no archive
}
```

**Events:**
- `evolution:action:executed` with prune details
- `brain:learner:removed` for deleted learner

### 3.4 Learner Update Mechanism

#### 3.4.1 learner.update()

Mirrors `learner.init()` but for runtime config changes.

**Signature:**
```typescript
async update(updates: Partial<GeneratedLearnerConfig>): Promise<void>
```

**Behavior:**
1. Merge updates with current config
2. Validate immutability constraints (id, origin, type, models cannot change)
3. If `instructions` changed → regenerate observe/synthesize prompts via LLM
4. If `thresholds` changed → update directly
5. If `maintenance.strategy` changed → update directly
6. **Understanding persists** - not cleared or re-evaluated

**Immutability Enforcement:**
```typescript
const IMMUTABLE_FIELDS = ['id', 'origin', 'type', 'model', 'blueprintModel']

function validateUpdates(current, updates) {
  for (const field of IMMUTABLE_FIELDS) {
    if (updates[field] && updates[field] !== current[field]) {
      throw new Error(`Field "${field}" is immutable`)
    }
  }
}
```

#### 3.4.2 Prompt Regeneration

When `instructions` change:

```typescript
async regeneratePrompts(newInstructions: string): Promise<void> {
  // Same mechanism as init()
  const result = await this._learningMethod.init(newInstructions)

  this.emit('learner:prompts:regenerated', {
    learnerId: this.id,
    observePrompt: result.observeSystemPrompt,
    synthesizePrompt: result.synthesizeSystemPrompt
  })
}
```

Understanding remains unchanged - future observations use new prompts.

---

## 4. API/Interface Definitions

### 4.1 Brain Evolution API

**Signal Submission:**
```typescript
brain.signal(signal: {
  source: string
  description: string
}): void
```

**Manual Evolution Trigger:**
```typescript
brain.evaluateEvolution(): Promise<void>
// Forces Judge to evaluate buffered signals immediately
```

**Direct Evolution Actions:**
```typescript
brain.spawn(guidance: string): Promise<TextLearner>

brain.merge(
  learnerIds: string[],
  guidance: string
): Promise<TextLearner>

brain.split(
  learnerId: string,
  guidance: string
): Promise<TextLearner[]>

brain.adjust(
  learnerId: string,
  guidance: string
): Promise<void>

brain.prune(learnerId: string): Promise<void>
```

### 4.2 Judge API

```typescript
interface Judge {
  // Add signal to buffer
  signal(signal: {
    source: string
    description: string
    timestamp: Date
  }): void

  // Evaluate buffered signals and return decisions
  evaluate(): Promise<EvolutionDecision[]>

  // Access to Brain state (tools)
  getLearnerConfig(id: string): GeneratedLearnerConfig
  getLearnerUnderstanding(id: string): string
  getLearnerActivity(id: string): LearnerActivity
  getRecentHistory(): EvolutionHistory[]
}
```

### 4.3 Learner Update API

```typescript
class TextLearner {
  async update(updates: Partial<GeneratedLearnerConfig>): Promise<void>

  // Emit signal to Judge
  signal(description: string): void
}
```

---

## 5. Event & Data Schemas

### 5.1 Evolution Events

**Generic Evolution Event:**
```typescript
'evolution:action:executed': {
  action: 'spawn' | 'merge' | 'split' | 'adjust' | 'prune'
  reasoning: string
  guidance: string
  targets: string[]
  timestamp: Date
  result: {
    // Action-specific result data
    newLearnerIds?: string[]
    deletedLearnerIds?: string[]
    updatedLearnerIds?: string[]
  }
}
```

**Existing Events Reused:**
- `brain:learner:added` - fires when new learner created (spawn, merge, split)
- `brain:learner:removed` - fires when learner deleted (merge old, split old, prune)

### 5.2 Signal Events

**Learner Signal Emission:**
```typescript
'learner:signal': {
  learnerId: string
  description: string
  timestamp: Date
  metrics?: {
    // Optional contextual metrics
    dismissalRate?: number
    avgConfidence?: number
    bufferCount?: number
    activation?: number
  }
}
```

**Brain Signal Reception:**
```typescript
'brain:signal:received': {
  source: string
  description: string
  timestamp: Date
}
```

### 5.3 Judge Events

```typescript
'judge:evaluation:started': {
  signalCount: number
  signals: SignalSummary[]
}

'judge:evaluation:completed': {
  decisionCount: number
  decisions: EvolutionDecision[]
}

'judge:evaluation:failed': {
  error: string
}
```

---

## 6. Configuration Schemas

### 6.1 Learner Governance Config

Extended to include signal thresholds:

```typescript
interface LearnerGovernance {
  // Existing fields
  activation: number
  threshold: number
  status: 'active' | 'dormant' | 'archived'
  lastAccessed: Date
  retrievalCount: number
  successRate: number

  // NEW: Signal thresholds
  signalThresholds: {
    dismissalRate: number        // Default: 0.8
    lowConfidence: number         // Default: 0.3
    bufferOverflow: number        // Default: 1.5 (multiplier of maxObservations)
    stagnationWindow: number      // Default: 100 observations
  }
}
```

### 6.2 Brain Config Extensions

```typescript
interface BrainConfig {
  prompt: string
  model: LanguageModel
  config?: {
    // ... existing Brain config

    // NEW: Evolution config
    evolution?: {
      enabled: boolean              // Default: true
      judgeSignalThreshold: number  // Default: 5
      autoEvaluate: boolean         // Default: true (auto eval when threshold reached)
    }
  }
}
```

### 6.3 GeneratedLearnerConfig Extensions

```typescript
interface GeneratedLearnerConfig {
  id: string
  name: string
  description: string
  instructions: string
  type: 'text' | 'list' | 'graph'
  maintenance: {
    strategy: 'continuous' | 'cumulative' | 'decay'
  }

  // NEW: Governance config (optional, defaults provided)
  governance?: {
    signalThresholds?: {
      dismissalRate?: number
      lowConfidence?: number
      bufferOverflow?: number
      stagnationWindow?: number
    }
  }
}
```

### 6.4 Config Mutability Matrix

| Field | Category | Adjustable by Judge? | Notes |
|-------|----------|---------------------|-------|
| `id` | Identity | ❌ No | Immutable identifier |
| `origin` | Metadata | ❌ No | Historical record |
| `type` | Structural | ❌ No | Cannot morph types |
| `model`, `blueprintModel` | Infrastructure | ❌ No | Brain-controlled |
| `instructions` | Semantic | ✅ Yes | Requires prompt regen |
| `name`, `description` | Semantic | ✅ Yes | Direct update |
| `maintenance.strategy` | Semantic | ✅ Yes | Direct update |
| `thresholds` (synthesis) | Mechanical | ✅ Yes | Direct update |
| `governance.signalThresholds` | Mechanical | ✅ Yes | Direct update |

---

## 7. Implementation Notes

### 7.1 Execution Order

Evolution decisions execute **sequentially** in the order Judge outputs them to prevent conflicts.

Example conflict scenario:
```typescript
// If executed in parallel, these would conflict:
decisions = [
  { action: 'adjust', targets: ['learner-a'], ... },
  { action: 'prune', targets: ['learner-a'], ... }
]

// Sequential execution ensures adjust completes before prune attempts deletion
```

### 7.2 LLM Failure Handling

All evolution actions involve LLM calls. Failure modes:

**Spawn/Merge/Split/Adjust:**
- LLM fails to generate valid config → emit `evolution:action:failed` event
- Leave system state unchanged
- Log error and signal to Judge (creates feedback loop)

**Prune:**
- No LLM involved, direct deletion
- Cannot fail (unless learner doesn't exist)

### 7.3 Testing Strategy

**Unit Tests:**
- Judge signal buffering and threshold logic
- Config mutability enforcement
- Action handlers (mock LLM responses)

**Integration Tests:**
- End-to-end signal → decision → execution flows
- Learner self-reporting triggers
- Manual evolution triggers

**LLM Evals:**
- Judge decision quality given various signals
- Config generation quality (spawn, merge, split, adjust)
- Understanding merge/split quality

### 7.4 Future Enhancements

**Brain Monitor (TBD):**
- Dedicated LLM analyzer watching Brain operations
- Buffers understandings, queries, and learner responses
- Detects systemic patterns (e.g., "learners A and B always respond similarly")
- Emits high-level signals to Judge

**Evolution History:**
- Track all evolution decisions and outcomes
- Enable rollback or replay
- Feed into Judge as context ("past decisions led to X outcome")

**Soft Delete / Archive:**
- Currently pruned learners are hard deleted
- Future: soft delete with `status: 'archived'`
- Archived learners don't participate but can be revived

**Evolution Confidence:**
- Judge outputs confidence score with each decision
- Enable human approval mode for low-confidence decisions
- Automatic execution only for high-confidence decisions

**Cross-Brain Evolution:**
- Multiple Brains sharing learners or evolution strategies
- Federated learning across Brain instances

---

## 8. Open Questions

1. **Judge LLM Selection:** Should Judge use a specific model or inherit from Brain config?
2. **Evolution Rate Limits:** Should there be limits on evolution frequency (e.g., max 10 evolutions per hour)?
3. **Learner Lifecycle Stages:** Should learners have states like `probation` (newly spawned, under evaluation)?
4. **Signal Prioritization:** Should certain signals have higher priority than others?
5. **Rollback Mechanism:** If an evolution action degrades performance, how to detect and rollback?

---

## 9. Glossary

**Brain:** Orchestration layer managing multiple learners
**Learner:** Independent learning agent with specific purpose
**Judge:** Centralized decision-maker for evolution actions
**Signal:** Observable event indicating potential need for evolution
**Evolution Action:** Structural change to learner set (spawn/merge/split/adjust/prune)
**Guidance:** Natural language directive for LLM action handlers
**Governance:** Learner self-management state (activation, thresholds, status)
**Understanding:** Learner's accumulated knowledge (narrative text)

---

**End of Specification**
