# Unbody Brain v0 — Architecture Document

## Executive Summary

Unbody Brain is the evolution of Unbody from "Supabase for AI-native apps" to **cognitive infrastructure**. It's a general-purpose, self-hosted system that transforms raw data into a living, queryable intelligence layer.

A Brain is not a database that stores. It's a brain that learns.

---

## Core Concept

A Brain is an **intelligent container of knowledge**. It can be scoped to anything:
- A single user's memory
- A conversation's context
- An organization's institutional knowledge
- A dataset's self-understanding
- An IoT system's behavioral awareness

The scope is up to the developer. The underlying infrastructure is the same.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            BRAIN                                │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │                    Fragment Layer                          ││
│  │               (Unbody-managed storage)                     ││
│  │                                                            ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 ││
│  │  │ Fragment │  │ Fragment │  │ Fragment │  ...            ││
│  │  │ (agent)  │  │ (agent)  │  │ (agent)  │                 ││
│  │  └──────────┘  └──────────┘  └──────────┘                 ││
│  │       ↑             ↑             ↑                        ││
│  │       └─────────────┼─────────────┘                        ││
│  │                     │                                      ││
│  │              ┌──────┴───────┐                              ││
│  │              │ Orchestrator │                              ││
│  │              └──────────────┘                              ││
│  └────────────────────────────────────────────────────────────┘│
│                            │                                    │
│                            ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐│
│  │                     Deep Layer                             ││
│  │                  (user-provided DBs)                       ││
│  │                                                            ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           ││
│  │  │  Vector DB │  │  Graph DB  │  │  Postgres  │           ││
│  │  │   (BYODB)  │  │   (BYODB)  │  │   (BYODB)  │           ││
│  │  └────────────┘  └────────────┘  └────────────┘           ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │                      LLM Layer                             ││
│  │                  (user's API keys)                         ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Two-Layer Memory Model

### Deep Layer (Cold Storage)
- Vector DB, Graph DB, Postgres
- User-provided (BYODB — Bring Your Own Database)
- Complete historical record
- Stores different aspects of data:
  - **Vector**: semantic similarity, conceptual proximity
  - **Graph**: explicit relationships, causal chains, entity networks
  - **Postgres**: structured facts, temporal sequences, metadata, raw data
- Slow to query, expensive

### Fragment Layer (Working Memory)
- Unbody-managed separate storage
- Compressed, purpose-specific representations
- Dynamically weighted (recency, relevance, or custom strategies)
- Fast to query, cheap
- **Most queries resolve here without touching deep storage**

---

## Fragments: The Core Primitive

### What a Fragment Is

A fragment is NOT a data structure or a cache. It's a **tiny specialized agent** with its own:
- Purpose (natural language)
- State (compressed worldview)
- Tools (LLM, vision, crawler, etc.)
- Weighting strategy (recency, relevance, custom)

```typescript
fragment = {
  name: string,              // completely arbitrary
  purpose: string,           // natural language description
  state: { ... },            // compressed representation
  tools: [llm, vectorSearch, imageProcessor, ...],
  mechanism: {
    compression: "...",
    weighting: "...",
    capacity: "..."
  }
}
```

### Fragment Characteristics

**Completely freeform**: No fixed taxonomy. Names, mechanisms, and structures are arbitrary. "Mental model" makes sense for human-observing brains. "Sensor clusters" makes sense for IoT. The brain grows what it needs.

**Dynamic weighting**: Fragments allocate "proportion" to data based on strategy:
- Recency: recent data gets more space
- Relevance: important data gets more space
- Custom: any weighting function

**Living summaries**: Unlike caches (static answers), fragments are continuously evolving compressed representations. Old information doesn't disappear—it gets compressed, loses weight, takes up less proportion.

### Fragment Lifecycle

```
SEED → SPECIALIZE → EVOLVE → SPLIT/MERGE → DEPRECATE
```

- **Seed**: Created from prompt or developer definition
- **Specialize**: Early data shapes what it tracks
- **Evolve**: Weighting strategies adapt based on usage
- **Split/Merge**: Structure reorganizes as needed
- **Deprecate**: Unused fragments fade away

### What Shapes Fragments

Fragments are shaped by three forces:

1. **Prompt (intent)**: The brain's natural language instruction suggests what fragments to create
2. **Developer (config)**: Explicit fragment definitions and steering
3. **Data (emergent)**: The system notices patterns and spawns appropriate fragments

Developers don't rigidly define fragments—they **steer** them:

```typescript
steering: {
  priorities: ["recency matters more than completeness"],
  focus: ["track emotional valence", "ignore formatting preferences"],
  constraints: ["max 3 fragments", "no PII in fragments"],
}
```

Or simply through the prompt:

```typescript
const brain = Unbody.createKnowledgebase(
  `You observe a customer support team.
   Care deeply about sentiment trends and escalation patterns.
   Don't bother tracking individual ticket details.`
)
// System infers fragment structure from this guidance
```

---

## Query Resolution: The Simplified Model

### Key Insight

Keep fragment size limited. Keep number of fragments limited. On every query, inject the **entire state of all fragments** into the orchestrator context.

```
Query arrives
    ↓
Load ALL fragment states into orchestrator context
    ↓
Orchestrator sees everything at once
    ↓
Can answer from fragments alone?
    → Yes: respond (fast, cheap)
    → Partial: targeted deep query for specifics
    → No: full deep layer search
```

### Why This Works

1. **Eliminates routing problem**: No need to classify which fragments are relevant. Orchestrator has full picture.

2. **Forces good compression**: Limited tokens = fragments must be selective. This is a feature.

3. **Predictable costs**: Every query = one LLM call with bounded context + maybe deep queries.

4. **Clean orchestrator prompt**:
```typescript
const orchestratorPrompt = `
You are the orchestrator for a brain.

Here is the current state of all fragments:
${fragments.map(f => `
## ${f.name}
Purpose: ${f.purpose}
State: ${JSON.stringify(f.state)}
`).join('\n')}

Query: "${userQuery}"

Can you answer from the fragment states above?
- If yes, respond directly
- If partial, specify what you need from deep storage
- If no, describe the deep storage query needed
`
```

### Suggested Limits for v0

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| Max fragments | 10 | Keeps total context manageable |
| Max tokens per fragment | 2,000 | Enough for meaningful state |
| Total fragment budget | 20,000 | Leaves room for query + system prompt |
| Max injection batch | 100 items | Prevents flooding |

---

## Injection Flow

### Routing Decision: All Fragments See All Data

On injection, **all fragments receive all data**. Each fragment decides independently whether it cares.

```typescript
brain.inject(data)
    ↓
All fragments receive data
    ↓
Each fragment:
  - Decides if relevant to its purpose
  - Processes with its tools if relevant
  - Updates its state
  - Compresses to stay within budget
```

This is simple and works well for moderate injection volumes.

---

## Processing: Two Types

### Pre-computational (Background)

Fragments that continuously process incoming data, building and maintaining their compressed worldview. These run on injection.

Examples:
- Entity extraction & linking
- Pattern recognition
- Temporal rhythm detection
- Relationship mapping

### On-demand (Query-time)

When a query arrives and existing fragments can't answer:
1. Orchestrator recognizes the gap
2. May spawn a new fragment for this query type
3. Or executes a one-time deep layer search

If a new query pattern recurs, it can become a persistent fragment.

---

## Subjects: Scoped Entities

Subjects are a way to scope data injection within a brain:

```typescript
const memory = Unbody.createKnowledgebase(`...`)

const user = memory.subject("user")
const assistant = memory.subject("assistant")

user.inject(...)
assistant.inject(...)

memory.ask("what topics do user and assistant disagree on?")
```

Subjects allow:
- Scoped injection
- Entity-specific querying
- Modeling relationships between entities

---

## API Surface

### Brain Lifecycle

```typescript
// Create
const brain = Unbody.createKnowledgebase(
  `natural language instruction defining the brain's purpose`,
  {
    vectorDb: ...,
    graphDb: ...,
    sqlDb: ...
  }
)

// Retrieve
const brain = Unbody.getKnowledgeBase("id")

// Destroy
brain.destroy()
```

### Data Injection

```typescript
// Direct injection
brain.inject(data)

// Scoped injection via subjects
const user = brain.subject("description of subject")
user.inject(data)
```

### Querying

```typescript
// Natural language questions
const answer = await brain.ask("how many female profiles do we have?")

// Pattern discovery
const patterns = await brain.patterns("user onboarding")

// Prediction
const next = await brain.predict(sequence).next()

// Semantic search
const results = await brain.search("fashion design")
```

### Introspection

```typescript
brain.introspect()
// Returns:
{
  fragments: [
    {
      name: "...",
      purpose: "...",
      origin: "prompt" | "emergent" | "developer-defined",
      size: "2.1kb",
      coverage: "87% of queries touch this"
    }
  ]
}

brain.fragments()  // List active fragments
```

### Fragment Management

```typescript
// Explicit definition (optional)
brain.defineFragment({
  name: "custom_fragment",
  purpose: "track specific patterns",
  mechanism: {
    weighting: "recency",
    capacity: "large"
  }
})

// Removal
brain.removeFragment("fragment_name")
```

---

## Example Use Cases

### Conversational Memory

```typescript
const memory = Unbody.createKnowledgebase(
  `You are an intelligent memory for conversations.
   Your job is to observe peers and create theory-of-mind models.
   You focus mainly on politics.`,
  { vectorDb, graphDb, sqlDb }
)

const user = memory.subject("user")
const assistant = memory.subject("assistant")

user.inject(...)
assistant.inject(...)

memory.ask("what does the user care about recently?")
memory.ask("do you remember the articles you showed me two days ago?")
```

### IoT Behavior Engine

```typescript
const patternEngine = Unbody.createKnowledgebase(
  `You observe people in a house.
   Your input is activity logs from IoT devices.
   Track behavioral patterns and anomalies.`,
  { vectorDb, graphDb, sqlDb }
)

const personA = patternEngine.subject("person:a")
const personB = patternEngine.subject("person:b")

personA.inject(activityLogs)
personB.inject(activityLogs)

patternEngine.ask("how many people have coffee between 10-11am?")
patternEngine.ask("how similar are personA and personB's behaviors?")
```

### Personal Programming Assistant

```typescript
const gaborMind = Unbody.createKnowledgebase(
  `You represent me. You keep track of all my activities,
   classify them, and help tools that ask about me.
   For images, apply captioning.`,
  { vectorDb, graphDb, sqlDb },
  { tools: [linearMCP, gmailMCP] }
)

onPageVisit((data) => gaborMind.inject(data))
onCodeSession((data) => gaborMind.inject(data))

gaborMind.ask("what should I work on?")
// Looks into Linear and Gmail and answers
```

---

## v0 Scope: OSS Self-Hosted

### What's Included

- **BYODB**: Bring your own Vector, Graph, and Postgres databases
- **BYOK**: Bring your own LLM API keys
- **Core primitives**: Brain, Fragment, Subject, Orchestrator
- **Core tools**: vectorSearch, graphTraverse, sqlQuery, llm
- **Full API**: inject, ask, patterns, predict, search, introspect

### What's NOT in v0

- Managed hosting
- Resource/cost management (user provides everything)
- Custom tool registration
- Advanced billing/metering

### Future Considerations (Post-v0)

- Managed cloud version
- Tool marketplace
- Cost controls and resource limits
- Fragment-to-fragment direct communication protocol
- Auto-scaling of fragments

---

## Alignment Check: Original Notes vs. This Document

| Original Concept | Status | Notes |
|------------------|--------|-------|
| Vector + Graph + Postgres deep storage | ✅ Aligned | BYODB model confirmed |
| Natural language instructions shape brain | ✅ Aligned | Core to the design |
| Subjects for modularity | ✅ Aligned | Clean scoping primitive |
| `.ask()`, `.patterns()`, `.predict()` API | ✅ Aligned | Core query methods |
| Agent-chains per use case | ✅ Evolved | Became "fragments as micro-agents" |
| Context fragments for speed | ✅ Evolved | Became the full working memory model |
| Pre-computational vs on-demand processing | ✅ Aligned | Two processing modes confirmed |
| Question classification & routing | ✅ Simplified | All fragments loaded into context, orchestrator decides |

### Key Evolutions from Original Notes

1. **"Chains" became "Fragments"**: Not query plan caching, but tiny specialized agents with their own tools and state.

2. **Fragments are completely freeform**: No fixed taxonomy. Names, mechanisms, structures are arbitrary and emergent.

3. **Simplified routing**: Instead of classifying which fragments to consult, load all fragment states into orchestrator context. Size limits make this feasible.

4. **Fragments have tools**: Not just data structures—they're agents that can use LLMs, vision, crawlers, etc.

5. **Three forces shape fragments**: Prompt intent, developer steering, and emergent data patterns.

---

## Summary

**Unbody Brain is:**

- A general-purpose cognitive infrastructure
- Shape-agnostic (any data in, intelligence out)
- Two-layer memory (fragments for speed, deep storage for completeness)
- Built from micro-agents (fragments) that maintain compressed, purpose-specific worldviews
- Queryable via natural language
- Self-organizing (fragments emerge, evolve, deprecate)
- OSS and self-hosted for v0 (BYODB, BYOK)

**The tagline:**

> Not a database that stores. A brain that learns.
