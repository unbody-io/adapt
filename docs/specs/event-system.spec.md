# Event-Driven System Specification

Specification for refactoring Brain from hybrid async/callback to fully event-driven architecture.

---

## Overview

Replace the current observer pattern with a unified EventEmitter-based system where both Brain and TextLearner are event emitters. Brain aggregates and forwards learner events, providing a single subscription point for all system events.

---

## Design Decisions

### Event Subscription Model

**Both unified and typed subscriptions:**

```typescript
// Unified - receive all events
brain.on(event => {
  if (event.type === 'brain:inject:started') {
    console.log(event.payload.injectId)
  }
})

// Typed - subscribe to specific event
brain.on('brain:inject:started', payload => {
  console.log(payload.injectId)
})
```

### Event Structure

**Nested payload with base metadata:**

```typescript
interface BaseEvent<T extends string, P> {
  id: string           // Unique event ID via nanoid (event_xxx)
  type: T              // Event type string
  timestamp: number    // Unix timestamp
  payload: P           // Event-specific data
}
```

### Emitter Architecture

- **Brain IS the emitter** - No separate `start()` method, Brain has `.on()` directly
- **Learner IS also an emitter** - TextLearner can be used standalone
- **Brain forwards learner events** - Subscribes to learners and re-emits their events
- **Same event shape everywhere** - `learner:*` events are identical from Brain or directly from learner

```typescript
// Via Brain (all events)
brain.on(event => { /* brain:* and learner:* events */ })

// Direct learner subscription
const learner = brain.getLearner('A')
learner.on(event => { /* only this learner's events */ })
```

### API Style

**Hybrid: Promise + Events**

Methods return promises (same as current) AND emit events during execution:

```typescript
// Events stream progress
brain.on('brain:inject:batch:completed', p => updateUI(p))

// Promise delivers final result
const result = await brain.inject(data)
// result = { id, batches: [...] } - same as before
```

### Error Handling

**Throw + events + generic 'error' event:**

- Failed operations emit specific failure events (`brain:inject:failed`, `learner:ingest:failed`)
- Also emit generic `'error'` event for catch-all handling
- Promise rejects on failure

```typescript
brain.on('learner:ingest:failed', p => console.error(p.error))
brain.on('error', event => alertOps(event))  // Catch-all

try {
  await brain.inject(data)
} catch (err) {
  // Promise also rejects
}
```

### Event Naming Convention

**Flexible 3-4 segments:**

```
{source}:{operation}:{status}
{source}:{operation}:{sub-operation}:{status}
```

Examples:
- `brain:inject:started`
- `brain:inject:batch:started`
- `learner:ingest:tool:completed`

### Handler Execution

- **Fire-and-forget** - Handlers called but not awaited
- **No unsubscription** - Listeners stay for lifetime

### Duration & Usage Tracking

- **Duration**: Consumers calculate from event timestamps
- **Token usage**: Included in events triggered by LLM calls

---

## Type System

### File Organization

```
src/
├── types/
│   └── events.ts                    # BaseEvent, EventsFromMap, TypedEmitter
│
├── learners/
│   ├── types.ts                     # BaseLearnerEventMap
│   └── text-learner/
│       ├── types.ts                 # TextLearnerEventMap, TextLearnerEvent
│       └── class.ts                 # TextLearner (emitter)
│
├── brain/
│   ├── types.ts                     # BrainOwnEventMap, BrainEventMap, BrainEvent
│   └── class.ts                     # Brain (emitter)
```

### Type Definitions

```typescript
// === src/types/events.ts ===

export interface BaseEvent<T extends string, P> {
  id: string
  type: T
  timestamp: number
  payload: P
}

export type EventsFromMap<M> = {
  [K in keyof M]: BaseEvent<K & string, M[K]>
}[keyof M]

export class TypedEmitter<M> {
  private listeners: Map<string, Function[]> = new Map()
  private wildcardListeners: Function[] = []

  on<K extends keyof M>(type: K, handler: (payload: M[K]) => void): this
  on(handler: (event: EventsFromMap<M>) => void): this
  on(typeOrHandler: any, handler?: any): this {
    if (typeof typeOrHandler === 'function') {
      this.wildcardListeners.push(typeOrHandler)
    } else {
      const listeners = this.listeners.get(typeOrHandler) || []
      listeners.push(handler)
      this.listeners.set(typeOrHandler, listeners)
    }
    return this
  }

  protected emit<K extends keyof M>(type: K, payload: M[K]): void {
    const event: BaseEvent<K & string, M[K]> = {
      id: `event_${nanoid()}`,
      type: type as string,
      timestamp: Date.now(),
      payload
    }

    // Typed listeners
    const listeners = this.listeners.get(type as string) || []
    for (const handler of listeners) {
      handler(payload)
    }

    // Wildcard listeners
    for (const handler of this.wildcardListeners) {
      handler(event)
    }

    // Generic error event
    if ((type as string).endsWith(':failed')) {
      const errorListeners = this.listeners.get('error') || []
      for (const handler of errorListeners) {
        handler(event)
      }
    }
  }
}
```

```typescript
// === src/learners/types.ts ===

import { TokenUsage } from '../types'

export interface BaseLearnerEventMap {
  // Init
  'learner:init:started': { learnerId: string }
  'learner:init:completed': { learnerId: string; systemPrompt: string; usage: TokenUsage }
  'learner:init:failed': { learnerId: string; error: string }

  // Ingest
  'learner:ingest:started': { learnerId: string; itemCount: number; chunkCount: number }
  'learner:ingest:chunk:started': { learnerId: string; chunkId: string; chunkIndex: number }
  'learner:ingest:thinking': { learnerId: string; chunkId: string; thoughts: string[]; usage: TokenUsage }
  'learner:ingest:tool:started': { learnerId: string; chunkId: string; toolName: string; input: unknown }
  'learner:ingest:tool:completed': { learnerId: string; chunkId: string; toolName: string; output: unknown }
  'learner:ingest:tool:failed': { learnerId: string; chunkId: string; toolName: string; error: string }
  'learner:ingest:chunk:completed': { learnerId: string; chunkId: string; relevance: number; usage: TokenUsage }
  'learner:ingest:completed': { learnerId: string; totalRelevance: number; usage: TokenUsage }
  'learner:ingest:failed': { learnerId: string; error: string }

  // Ask
  'learner:ask:started': { learnerId: string; query: string }
  'learner:ask:thinking': { learnerId: string; thoughts: string[]; usage: TokenUsage }
  'learner:ask:tool:started': { learnerId: string; toolName: string; input: unknown }
  'learner:ask:tool:completed': { learnerId: string; toolName: string; output: unknown }
  'learner:ask:tool:failed': { learnerId: string; toolName: string; error: string }
  'learner:ask:completed': { learnerId: string; insight: string; confidence: number; gaps: string[]; usage: TokenUsage }
  'learner:ask:failed': { learnerId: string; error: string }

  // State changes
  'learner:understanding:updated': {
    learnerId: string
    understanding: string
    previousUnderstanding: string
    entry: EvolutionEntry
  }
  'learner:governance:updated': {
    learnerId: string
    activation: number
    status: 'active' | 'dormant'
    previousStatus?: 'active' | 'dormant'
  }
}
```

```typescript
// === src/learners/text-learner/types.ts ===

import { BaseLearnerEventMap } from '../types'
import { EventsFromMap } from '../../types/events'

// TextLearner uses base events (can extend if needed)
export interface TextLearnerEventMap extends BaseLearnerEventMap {}

export type TextLearnerEvent = EventsFromMap<TextLearnerEventMap>
```

```typescript
// === src/brain/types.ts ===

import { TextLearnerEventMap } from '../learners/text-learner/types'
import { EventsFromMap } from '../types/events'
import { LearnerConfig, TokenUsage } from './types'

export interface BrainOwnEventMap {
  // Init
  'brain:init:started': {}
  'brain:init:config:generating': {}
  'brain:init:config:generated': { configs: LearnerConfig[]; usage: TokenUsage }
  'brain:init:completed': { learnerIds: string[] }
  'brain:init:failed': { error: string }

  // Inject
  'brain:inject:started': { injectId: string; itemCount: number; batchCount: number }
  'brain:inject:batch:started': { injectId: string; batchId: string; batchIndex: number; itemCount: number }
  'brain:inject:batch:completed': { injectId: string; batchId: string; batchIndex: number; results: BatchResult[] }
  'brain:inject:completed': { injectId: string; batches: BatchResult[] }
  'brain:inject:failed': { injectId: string; error: string }

  // Ask
  'brain:ask:started': { queryId: string; query: string }
  'brain:ask:synthesis:started': { queryId: string; learnerResponses: LearnerResponse[] }
  'brain:ask:completed': { queryId: string; insight: string; sources: string[]; gaps: string[]; usage: TokenUsage }
  'brain:ask:failed': { queryId: string; error: string }

  // Learner management
  'brain:learner:added': { learnerId: string; name: string; instructions: string }
}

// Combined event map
export type BrainEventMap = BrainOwnEventMap & TextLearnerEventMap

export type BrainEvent = EventsFromMap<BrainEventMap>
```

---

## Complete Event List

### Brain Events

| Event | Payload |
|-------|---------|
| `brain:init:started` | `{}` |
| `brain:init:config:generating` | `{}` |
| `brain:init:config:generated` | `{ configs: LearnerConfig[], usage: TokenUsage }` |
| `brain:init:completed` | `{ learnerIds: string[] }` |
| `brain:init:failed` | `{ error: string }` |
| `brain:inject:started` | `{ injectId, itemCount, batchCount }` |
| `brain:inject:batch:started` | `{ injectId, batchId, batchIndex, itemCount }` |
| `brain:inject:batch:completed` | `{ injectId, batchId, batchIndex, results }` |
| `brain:inject:completed` | `{ injectId, batches }` |
| `brain:inject:failed` | `{ injectId, error }` |
| `brain:ask:started` | `{ queryId, query }` |
| `brain:ask:synthesis:started` | `{ queryId, learnerResponses }` |
| `brain:ask:completed` | `{ queryId, insight, sources, gaps, usage }` |
| `brain:ask:failed` | `{ queryId, error }` |
| `brain:learner:added` | `{ learnerId, name, instructions }` |

### Learner Events

| Event | Payload |
|-------|---------|
| `learner:init:started` | `{ learnerId }` |
| `learner:init:completed` | `{ learnerId, systemPrompt, usage }` |
| `learner:init:failed` | `{ learnerId, error }` |
| `learner:ingest:started` | `{ learnerId, itemCount, chunkCount }` |
| `learner:ingest:chunk:started` | `{ learnerId, chunkId, chunkIndex }` |
| `learner:ingest:thinking` | `{ learnerId, chunkId, thoughts: string[], usage }` |
| `learner:ingest:tool:started` | `{ learnerId, chunkId, toolName, input }` |
| `learner:ingest:tool:completed` | `{ learnerId, chunkId, toolName, output }` |
| `learner:ingest:tool:failed` | `{ learnerId, chunkId, toolName, error }` |
| `learner:ingest:chunk:completed` | `{ learnerId, chunkId, relevance, usage }` |
| `learner:ingest:completed` | `{ learnerId, totalRelevance, usage }` |
| `learner:ingest:failed` | `{ learnerId, error }` |
| `learner:ask:started` | `{ learnerId, query }` |
| `learner:ask:thinking` | `{ learnerId, thoughts: string[], usage }` |
| `learner:ask:tool:started` | `{ learnerId, toolName, input }` |
| `learner:ask:tool:completed` | `{ learnerId, toolName, output }` |
| `learner:ask:tool:failed` | `{ learnerId, toolName, error }` |
| `learner:ask:completed` | `{ learnerId, insight, confidence, gaps, usage }` |
| `learner:ask:failed` | `{ learnerId, error }` |
| `learner:understanding:updated` | `{ learnerId, understanding, previousUnderstanding, entry }` |
| `learner:governance:updated` | `{ learnerId, activation, status, previousStatus? }` |

---

## Usage Examples

### Basic Usage

```typescript
const brain = new Brain({ prompt, model })

// Unified listener
brain.on(event => {
  console.log(`[${event.type}]`, event.payload)
})

// Typed listeners
brain.on('brain:inject:started', p => {
  console.log(`Starting inject ${p.injectId} with ${p.itemCount} items`)
})

brain.on('learner:ingest:thinking', p => {
  console.log(`Learner ${p.learnerId} thinking:`, p.thoughts)
})

brain.on('error', event => {
  alertOps(`Error: ${event.type}`, event.payload)
})

// Operations still return results
await brain.initialize()
const result = await brain.inject(data)
const answer = await brain.ask('What patterns emerged?')
```

### Direct Learner Subscription

```typescript
const learner = brain.getLearner('customer-insights')

// Subscribe only to this learner
learner.on(event => {
  if (event.type === 'learner:understanding:updated') {
    saveToDatabase(event.payload.understanding)
  }
})

// Or standalone usage
const standalone = new TextLearner({ id: 'test', instructions: '...' })
standalone.on('learner:ingest:completed', p => {
  console.log(`Relevance: ${p.totalRelevance}`)
})
await standalone.ingest(data)
```

### Progress Tracking

```typescript
const ingestProgress = new Map<string, { started: number; batches: number }>()

brain.on('brain:inject:started', p => {
  ingestProgress.set(p.injectId, {
    started: Date.now(),
    batches: p.batchCount
  })
  showProgressBar(0, p.batchCount)
})

brain.on('brain:inject:batch:completed', p => {
  showProgressBar(p.batchIndex + 1, ingestProgress.get(p.injectId)!.batches)
})

brain.on('brain:inject:completed', p => {
  const { started } = ingestProgress.get(p.injectId)!
  console.log(`Completed in ${Date.now() - started}ms`)
})
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

1. Create `TypedEmitter<M>` class in `src/types/events.ts`
2. Define `BaseEvent` interface and `EventsFromMap` helper
3. Define `BaseLearnerEventMap` in `src/learners/types.ts`

### Phase 2: TextLearner Events

1. Define `TextLearnerEventMap` extending base
2. Add emitter to TextLearner class (extend or compose TypedEmitter)
3. Replace observer callbacks with event emissions
4. Remove observer pattern (`LearnerObserver` interface, `addObserver` method)

### Phase 3: Brain Events

1. Define `BrainOwnEventMap` and combined `BrainEventMap`
2. Add emitter to Brain class
3. Implement Brain-level events
4. Subscribe to learner events and forward them

### Phase 4: Cleanup

1. Remove old observer types from `src/learners/text-learner/types.ts`
2. Update eval file (`evals/brain.eval.ts`) to use new events
3. Update any other consumers

---

## Migration Notes

- **Replace in one go** - No gradual migration, clean break from observer pattern
- **Same return values** - `inject()`, `ask()`, `initialize()` return same types as before
- **No breaking changes to method signatures** - Only subscription model changes
- **Learners remain independent** - Can be used without Brain
