# Myceliom — Brain Setup Guide

## Setup

```typescript
import { Brain } from '@unbody/brain'
import { SQLiteBrainStore } from '@unbody/brain/stores'
import { SQLiteStore } from '@unbody/brain/learner-stores'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const model = openrouter('google/gemini-2.5-flash-lite-preview-09-2025')

const TOPIC_TRACKER_ID = 'topic-tracker'
const DB_PATH = 'data/myceliom'

const brain = new Brain({
  prompt: `You are the memory behind Mycelium, which is my personal attention tracker.
I save things from everywhere — bookmarks, articles, notes, conversations with Claude,
products, images, code repos. I want it to understand what I'm actually paying attention to,
notice when new threads emerge, and help me see patterns I can't see myself.`,

  model,
  autoSetup: true,
  store: new SQLiteBrainStore(DB_PATH),

  learners: [
    {
      id: TOPIC_TRACKER_ID,
      name: 'Topic Tracker',
      type: 'list',
      description: 'Tracks distinct topics and threads of attention across all saved content',
      instructions: `Track every distinct topic or thread of attention that appears in the data.

Watch for:
- New topics emerging from saved content
- Existing topics gaining more depth or shifting focus
- Topics going dormant (no new saves)

Track answers to:
- What are the active threads of attention?
- When did each thread first appear and when was it last seen?
- Which threads are intensifying vs fading?`,
      skipObservation: true,
    },
  ],

  learning: {
    store: (learnerId) => new SQLiteStore(DB_PATH),
  },

  evolution: {
    enabled: true,
    evaluatorSignalThreshold: 3,
    autoEvaluate: true,
  },
})
```

## Listening for topic changes

The `topic-tracker` list learner receives all raw data directly (`skipObservation: true` bypasses the observe LLM call) and maintains a structured list of topics. It emits `learner:synthesized` whenever the list updates.

```typescript
brain.on('learner:synthesized', async (event) => {
  if (event.learnerId !== TOPIC_TRACKER_ID) return

  const topics = event.newUnderstanding as Array<Record<string, unknown>>
  const previous = (event.previousUnderstanding ?? []) as Array<Record<string, unknown>>

  // event.significance: 'routine' | 'notable' | 'critical'
  // Diff topics vs previous to find new/updated/removed
  // Then: create threads, update UI, notify user, etc.
})
```

## Feature → Brain capability map

| POC Feature | Brain capability | How |
|---|---|---|
| **Thread discovery** | Topic tracker (list learner) + events | `learner:synthesized` emits updated topic list |
| **On-save contextualization** | Query accumulated knowledge | `brain.ask()` + topic tracker → enrich item → `brain.inject()` |
| **Free-form questions** | Multi-learner synthesis | `brain.ask(question)` |
| **User corrections** | Evolution via signals | `brain.signal()` with user feedback as context |
| **Proactive insights** | Significance-driven events | `learner:synthesized` with `notable`/`critical` significance |

## Contextualizing and saving

Query Brain to contextualize new content, enrich the item with that context, then inject the enriched item so Brain learns with full context.

```typescript
const topicTracker = brain.getLearner(TOPIC_TRACKER_ID)
const topics = await topicTracker.getUnderstanding()

const context = await brain.ask(
  `What threads does this connect to: "${newItem.title}" — ${newItem.context}`
)

// Enrich the item with Brain's contextualization before injecting
await brain.inject([{
  ...newItem,
  relatedTopics: context.sources.map(s => s.learnerId),
  contextualization: context.insight,
}])
```

## Asking questions

```typescript
const result = await brain.ask('What have I been avoiding?')
// result.insight — synthesized answer from all learners
// result.sources — per-learner relevance + confidence
// result.gaps — knowledge gaps
```

## User corrections

User feedback is sent as signals. Brain's evolution system decides what structural changes to make.

```typescript
// "Merge X and Y — those are the same thread"
brain.signal({
  source: 'user-correction',
  description: 'User says "tools for thought" and "cognitive exoskeletons" are the same thread. They want these merged into one.',
})

// "Split X — those are different interests"
brain.signal({
  source: 'user-correction',
  description: 'User says "local-first tech" actually covers two separate interests: sync infrastructure and offline UX patterns.',
})

// "Stop tracking X"
brain.signal({
  source: 'user-correction',
  description: 'User says "energy/recovery" is not a real thread, stop tracking it.',
})
```

## Proactive insights

Surface insights when Brain notices something significant during learning.

```typescript
brain.on('learner:synthesized', async (event) => {
  if (event.significance === 'notable' || event.significance === 'critical') {
    const insight = await brain.ask('What new patterns or shifts have you noticed?')
    // Surface to the user
  }
})
```

## Running

```typescript
await brain.init()

await brain.inject([
  { type: 'Article', title: '...', context: '...', source: '...' },
  { type: 'Note', title: '...', context: '...' },
])

const result = await brain.ask('What am I paying attention to?')
console.log(result.insight)
```
