# Playground Spec

A live demo app that showcases what `@unbody/brain` can do — no code, no API details, pure impact. The audience watches a Brain come to life, learn from data, speak up with insights, and evolve its own structure — visualized as a living mycelium organism.

**Audience:** Both investors/stakeholders and developers. No technical depth exposed — only results and the "wow."

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Data Deck   │  │  The Stream      │  │  Mycelium     │  │
│  │  (left)      │  │  (commentator    │  │  (WebGL       │  │
│  │              │  │   feed)          │  │   shader)     │  │
│  └──────────────┘  └──────────────────┘  └───────────────┘  │
│                           ▲                                  │
│                           │ SSE                              │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                        Server (Node.js)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Brain       │  │  Commentator     │  │  SSE          │  │
│  │  Instance    │──│  LLM             │──│  Broadcast    │  │
│  │              │  │  (reads Brain)   │  │               │  │
│  └──────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- All LLM work happens server-side
- Frontend is pure rendering — receives events via SSE, sends inject/control commands via REST
- Commentator LLM is independently configurable from the Brain's model

---

## Lifecycle

### Birth

The Brain is created from zero. The audience watches it come to life.

1. Brain initializes from the use case config (prompt, learner definitions if any, autoSetup)
2. LLM decomposes the prompt into learners
3. Each learner appears on the mycelium visualization as it's created
4. Learners generate their identity, schemas, observer prompts
5. Commentator narrates: "I'm analyzing what I need to learn..."

**Left panel during Birth:** Blank, or shows the Brain's high-level config (prompt, auto-generated learners).

### Living

The presenter feeds data, the Brain reacts autonomously.

1. Left panel transitions to the data control deck
2. Presenter injects data chunks — one at a time or in batches
3. Observers filter incoming data (accept/dismiss)
4. Buffers fill → synthesis triggers → understanding updates
5. Signals accumulate → evaluator triggers → evolution restructures learners
6. Commentator narrates throughout — connecting dots, forming narrative
7. Mycelium visualization reacts to every event — alive and breathing

---

## UI Layout

### Landing Screen

Grid/list of available use cases. Each shows title and short description. Click to start.

### Demo Screen

Two-panel layout:

#### Left — Data Control Deck

- Shows all data sources as groups (e.g., "Emails", "Chat History", "Bookmarks")
- Each source shows its items with injected ones marked
- Click a single item to inject, or select multiple and inject as batch
- "Inject next N" shortcut per source
- Injection flexibility is scenario-driven — some use cases narrate source by source, others dump batches

#### Right — Two Panels

**1. The Mycelium (WebGL Shader)**

A living, breathing mycelium organism visualization. Not a graph diagram — a full generative art piece that feels alive.

- Represents the Brain's structure — learners as organic elements within the organism
- Constantly moving and dynamic, even when idle
- Reacts to events:
  - Synthesis → visual change in the affected region
  - Evolution (split/merge/create/delete) → dramatic organic restructuring
  - Data flowing in → visible energy/movement
- Clicking/hovering a node reveals that learner's current understanding
- Implementation: WebGL shader — professional quality, specialist territory

Data driving the visualization:
- Learner topology (count, types, relationships)
- Learner health and metrics (activation, dismissal rate, confidence)
- Event stream (synthesis, evolution, injection)
- Understanding depth per learner

*Detailed shader design is left to the implementation specialist.*

**2. The Stream (Commentator Feed)**

A living feed of the commentator's narration. Displayed as separate cards that accumulate.

- Conversational, human, short — like a brain thinking aloud
- "I just noticed that dark mode keeps coming up from enterprise clients..."
- "This is the third time this week..."
- "I need to reorganize how I think about this — splitting my tracker into two..."
- Cards reference and connect to previous cards, forming a narrative
- Not notifications — it's an intelligent inner voice

---

## Commentator LLM

A server-side LLM that acts as the "voice" of the Brain. It interprets raw events and speaks like a thinking organism.

### Triggers

Two event sources:

1. **Learner updates** — when any learner synthesizes (observe → understand cycle completes)
2. **Evolution actions** — when the evaluator takes action (create/merge/split/delete learners)

### Input Context

For each event, the commentator receives:

- The event itself (synthesis result, evolution action, health signal)
- Full history of previous stream cards it has generated (for narrative continuity)
- Current state of all learners (names, health, metrics)

### Capabilities

- **Read-only access to the Brain** — can call `brain.ask()`, `brain.consult()`, `learner.getUnderstanding()`, `learner.getMetrics()`, etc.
- **Never writes or modifies** — pure observer with intelligence
- **Decides autonomously** whether an event is worth speaking about — no pre-filtering rules
- **Connects dots** across events — forms narrative, references previous cards

### Output

A short, conversational card:

```ts
{
  id: string
  content: string      // the message — short, human, conversational
  timestamp: string
  relatedTo?: string[] // IDs of previous cards this connects to
}
```

### Model

Independently configurable from the Brain's model. Configured in the server's environment/config.

---

## Dataset Format

Each use case is a directory under `usecases/`:

```
usecases/
  product-feedback/
    config.json
    data/
      support-tickets.json
      tweets.json
      app-reviews.json
  cooking-brain/
    config.json
    data/
      recipes.json
      restaurant-reviews.json
      conversations.json
```

### config.json

```ts
{
  id: string
  title: string
  description: string

  // Brain setup
  prompt: string
  autoSetup?: boolean          // default: true — can coexist with learners
  learners?: LearnerConfig[]   // explicit learner definitions (optional)

  // Model overrides (optional)
  model?: string               // Brain model identifier
  commentatorModel?: string    // Commentator model identifier
}
```

### Data Source File (e.g., `support-tickets.json`)

```ts
{
  id: string
  source: string              // "email", "bookmarks", "chat", "support-tickets"
  description: string         // human-readable purpose shown in the data deck
  items: Array<{
    id: string
    label: string             // display text in the left panel
    data: Record<string, unknown>  // the actual payload passed to brain.inject()
  }>
}
```

All data sources share this unified interface so the backend and frontend handle them generically regardless of the use case.

---

## Server API

### REST Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/usecases` | List available use cases (id, title, description) |
| `POST` | `/api/session` | Start a new session for a use case — initializes Brain, returns session ID |
| `POST` | `/api/session/:id/inject` | Inject items — body: `{ items: Array<{ data }> }` |
| `GET` | `/api/session/:id/state` | Get current Brain state (learners, health, metrics) |
| `GET` | `/api/session/:id/events` | SSE stream — all events for this session |
| `DELETE` | `/api/session/:id` | Tear down session and dispose Brain |

### SSE Event Types

| Event | When | Payload |
|---|---|---|
| `brain:init:started` | Brain begins initializing | `{}` |
| `brain:init:learner-created` | A learner is created during decomposition | `{ learnerId, name, type, description }` |
| `brain:init:completed` | Brain is ready | `{ learnerIds }` |
| `inject:started` | Injection begins | `{ itemCount }` |
| `inject:completed` | Injection finished | `{ results }` |
| `learner:observed` | Learner accepted observations | `{ learnerId, count, importance }` |
| `learner:observe:dismissed` | Learner dismissed data | `{ learnerId, gaps }` |
| `learner:synthesized` | Learner updated understanding | `{ learnerId, significance, evolution }` |
| `learner:health:updated` | Learner health changed | `{ learnerId, activation, status, metrics }` |
| `evolution:action` | Evaluator took action | `{ action, targets, result }` |
| `commentary` | Commentator produced a card | `{ id, content, timestamp, relatedTo? }` |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Visualization | WebGL shader (custom) |
| Server | Node.js (Express or Hono) |
| Communication | SSE (server → client), REST (client → server) |
| Brain | `@unbody/brain` (local import) |
| Commentator | Independent LLM via Vercel AI SDK |
| Deployment | Local only (for now) |

---

## What This Is NOT

- Not a product — it's a demo tool for presentations
- Not showing code or API details — pure results
- Not a fixed script — the presenter freestyles with the control deck
- Not deployable yet — local dev server only
