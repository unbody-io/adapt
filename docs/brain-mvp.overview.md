# Brain MVP - Implementation Overview

This document provides the context needed to implement the Brain MVP.

---

## Core Concept

**Brain** is an orchestrator that manages **Learners**.

- **Learner** = an autonomous agent that builds understanding over time
- **Brain** = container that creates, routes data to, and queries learners

The key insight: Some questions can't be answered by search. "How has the user's coding style evolved?" requires having observed patterns over time. That's what Learners do - they maintain compressed understanding, not raw data.

---

## What Already Exists

### TextLearner (fully implemented)

Location: `src/learners/text-learner/`

```typescript
import { TextLearner } from './src/learners'

const learner = new TextLearner({
  model: openai('gpt-4o'),           // AI SDK model
  instructions: 'Understand user coding patterns',  // What to track
  maintenance: { strategy: 'continuous' },          // Optional
  observer: { onEnd: (e) => console.log(e) }        // Optional
})

// Ingest data - learner builds understanding
await learner.ingest([
  { event: 'user committed functional code' },
  { event: 'user rejected OOP PR' }
])

// Query the learner
const result = await learner.ask('What is the coding style?')
// result = { relevant: true, confidence: 0.8, insight: '...', gaps: [] }

// Get current understanding
learner.getUnderstanding()  // Returns synthesized text
```

**Key files:**
- `src/learners/text-learner/class.ts` - TextLearner class
- `src/learners/text-learner/types.ts` - Config and event types
- `src/learners/text-learner/agent.ts` - ToolLoopAgent setup
- `src/learners/types.ts` - Core interfaces (Learner, IngestResult, AskResult)

**How ingest() works internally:**
1. Lazy-init system prompt via LLM synthesis
2. Run ToolLoopAgent with tools: compareToUnderstanding, detectShift, detectPattern, synthesize
3. Agent loops until it calls `synthesize` tool with newUnderstanding
4. Apply strategy (compression if needed)
5. Update evolution history
6. Update governance (activation score)

**How ask() works internally:**
1. Run ToolLoopAgent with tools: generateResponse, identifyGaps, complete
2. Agent loops until it calls `complete` tool
3. Return structured AskResult

---

## What Brain Adds

Brain is a thin orchestration layer on top of TextLearner:

```
┌─────────────────────────────────────────────────────┐
│ Brain                                               │
│                                                     │
│  prompt: "Track my coding patterns and interests"  │
│  model: LanguageModel                              │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Brain-level Learners                         │   │
│  │  - TextLearner: "coding patterns"            │   │
│  │  - TextLearner: "learning interests"         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Subjects (scopes)                            │   │
│  │                                               │   │
│  │  subject("user-123")                         │   │
│  │    └─ TextLearner: "user preferences"        │   │
│  │                                               │   │
│  │  subject("user-456")                         │   │
│  │    └─ TextLearner: "user preferences"        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Brain Creation

When you create a Brain with a prompt:

```typescript
const brain = new Brain({
  prompt: `Track my digital life.
           Understand my coding patterns.
           Remember my learning interests.`,
  model: openai('gpt-4o')
})
```

Brain uses an LLM call to parse the prompt and infer learners:
- "coding patterns" → create TextLearner with instructions about coding
- "learning interests" → create TextLearner with instructions about learning

This is **prompt parsing** - turning natural language into learner configs.

### Subjects

Subjects are **scopes** within a brain. Use case: one brain serving multiple users.

```typescript
// Brain-level learners (shared)
brain.addLearner({ instructions: 'Track global trends' })

// Subject-level learners (per-user)
const alice = brain.subject('alice')
alice.addLearner({ instructions: 'Track Alice preferences' })

const bob = brain.subject('bob')
bob.addLearner({ instructions: 'Track Bob preferences' })
```

When querying:
- `brain.ask(query)` → only brain-level learners
- `alice.ask(query)` → brain-level + alice's learners

### Injection Routing

```typescript
brain.inject(data)  // → all brain-level learners

brain.inject(data, { subject: 'alice' })  // → brain-level + alice's learners
// equivalent to:
alice.inject(data)
```

For MVP, routing is simple: send to all relevant learners. No smart filtering.

### Query Synthesis

When multiple learners respond to a query, Brain synthesizes:

```typescript
const result = await brain.ask('What are my patterns?')
```

Internally:
1. Ask all relevant learners: `learner.ask(query)` for each
2. Collect responses: `[{ insight: '...', confidence: 0.8 }, { insight: '...', confidence: 0.6 }]`
3. LLM synthesis call: combine insights into unified answer
4. Return with sources (which learners contributed)

---

## Implementation Stages (Recommended)

### Stage 1: Minimal Working Brain
Create Brain that holds learners and routes data/queries.

```typescript
// What to build:
const brain = new Brain({ model })
brain.addLearner({ instructions: '...' })
await brain.inject(data)
await brain.ask(query)
```

Files:
- `src/brain/class.ts` - Brain class
- `src/brain/types.ts` - BrainConfig, InjectOptions, etc.
- `src/brain/index.ts` - exports

No prompt parsing yet. No subjects. Just manual learner management + routing.

### Stage 2: Prompt Parsing
Add LLM-based prompt parsing to auto-create learners.

```typescript
const brain = new Brain({
  prompt: 'Track coding and learning',
  model
})
// Brain auto-creates learners from prompt
```

Files:
- `src/brain/prompt-parser.ts` - LLM prompt to parse user prompt

### Stage 3: Subject Management
Add subjects as scopes.

```typescript
const subject = brain.subject('user-123')
subject.addLearner(...)
subject.inject(data)
subject.ask(query)
```

Files:
- `src/brain/subject.ts` - Subject class

### Stage 4: Events
Add observability layer.

```typescript
brain.on('learner:updated', handler)
brain.on('inject:complete', handler)
```

---

## Key Types (for reference)

```typescript
// From existing learners/types.ts
interface IngestResult {
  relevance: number  // 0-1
}

interface AskResult {
  relevant: boolean
  confidence: number  // 0-1
  insight: string
  gaps: string[]
}

// New for Brain
interface BrainConfig {
  prompt?: string           // Natural language, parsed to create learners
  model: LanguageModel      // AI SDK model, shared by all learners
}

interface InjectOptions {
  subject?: string          // Route to specific subject
}

interface BrainAskResult {
  insight: string           // Synthesized answer
  sources: Array<{          // Which learners contributed
    learnerId: string
    confidence: number
  }>
  gaps: string[]            // Aggregated gaps
}
```

---

## File Structure (proposed)

```
src/
├── brain/
│   ├── index.ts              # exports
│   ├── class.ts              # Brain class
│   ├── types.ts              # Brain types
│   ├── subject.ts            # Subject class
│   ├── prompt-parser.ts      # LLM prompt parsing
│   └── synthesizer.ts        # Query synthesis
├── learners/
│   ├── index.ts
│   ├── types.ts
│   └── text-learner/         # Already exists
└── index.ts                  # Main exports
```

---

## Summary

1. **TextLearner exists and works** - don't modify it
2. **Brain is orchestration** - creates learners, routes data, synthesizes queries
3. **Subjects are scopes** - brain-level vs subject-level learners
4. **Prompt parsing** - LLM infers learners from natural language
5. **Query synthesis** - LLM combines multiple learner responses

Start with Stage 1 (manual learner management), then layer in features.
