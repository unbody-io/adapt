# Unbody Brain — Learners Specification

**Terminology:** Learners are also called "Learning Agents" — stateful agents that build understanding over time.

## Overview

Learners are the core cognitive primitive of Unbody Brain. They are **learning agents** that maintain compressed understanding of specific concerns. Learners are not caches or data structures — they are what enables the brain to answer questions that "require having paid attention all along."

---

## Core Principles

1. **Learners are learning agents** — they pay attention to specific concerns and build understanding over time
2. **Purpose is fixed** — a learner's purpose is defined at creation and does not change
3. **Understanding is type-specific** — different learner types store understanding in different formats
4. **Evolution through population dynamics** — learners don't evolve individually; they ignite, deprecate, and get replaced by new learners with refined purposes
5. **Governance is emergent** — learner lifecycle emerges from activation mechanics, not central control

---

## Learner Structure

### Base Learner (common to all types)

```
Learner {
  // Identity
  id: string
  instructions: string         // natural language, fixed at creation (also called "purpose")
  origin: prompt | developer | emergent

  // Understanding
  understanding: any           // type-specific format
  evolution: EvolutionEntry[]  // history of changes, newest first

EvolutionEntry {
  summary: string              // what changed and why
  significance: "routine" | "notable" | "critical"
  timestamp: timestamp
}

  // Governance
  governance: {
    activation: number         // 0.0 - 1.0, computed from usage
    threshold: number          // gates participation
    status: active | dormant
    lastAccessed: timestamp
    retrievalCount: number
    successRate: number        // responses that were useful
  }

  // Maintenance (type-specific)
  maintenance: {
    strategy: type-specific
    constraints: type-specific
  }
}
```

---

## Learner Types

Learners have types. Each type defines its own understanding format and maintenance strategy. New types can be added as needed.

### TextLearner

**Purpose:** General understanding as narrative. Most common type.

**Understanding format:** Free text blob (natural language narrative)

**Understanding management strategies:**

| Strategy | Size | Behavior |
|----------|------|----------|
| `continuous` | Unbounded | Single understanding, refined on each update (default) |
| `cumulative` | Fixed | When limit reached → summarize → new understanding seeded with summary |
| `decay` | Unbounded | Sections (recent/medium/old), older sections compressed progressively |

**Strategy details:**

- **continuous:** The learner maintains one understanding blob that grows and gets refined over time. Simplest model, but can grow large. Current v0 implementation.

- **cumulative:** Understanding has a max size (tokens). When reached, the entire understanding is summarized, and a new understanding starts with that summary as seed. Bounded cost, but information degrades over many cycles (summary of summary of summary).

- **decay:** Understanding is structured into temporal sections (e.g., recent, medium-term, historical). Recent data stays detailed, older sections get progressively compressed. Natural decay without sharp cutoffs. More complex to implement.

**Example understanding:**

```
"User has been learning Rust for 3 days. Initial interest in memory safety
has deepened into focused study of ownership concepts. Multiple learning
modes: docs, video, hands-on coding. High engagement signal."
```

### ListLearner

**Purpose:** Tracking collections of items/entities.

**Understanding format:** List of items with metadata

**Maintenance:**

- Strategy: deduplication, relevance-based pruning
- Constraints: maxItems, deduplication mode (strict | semantic)

**Example understanding:**

```json
[
  { "item": "MacBook Pro M3", "confidence": 0.6, "firstSeen": "2024-01-10", "signals": ["browsed", "compared prices"] },
  { "item": "Sony WH-1000XM5", "confidence": 0.9, "firstSeen": "2024-01-15", "signals": ["added_to_cart", "explicit_need"] }
]
```

### GraphLearner

**Purpose:** Tracking relationships between entities.

**Understanding format:** Nodes and edges

**Maintenance:**

- Strategy: node deduplication, edge pruning
- Constraints: maxNodes, maxEdges, pruning mode

**Example understanding:**

```
Nodes: [sarah, mike, project-atlas, API-design-task]
Edges: [
  sarah --owns--> project-atlas,
  mike --works_on--> project-atlas,
  mike --assigned--> API-design-task,
  sarah --pulled_in--> mike
]
```

### Extensibility

New learner types can be added by defining:

- Understanding format
- Maintenance strategy and constraints
- Process logic (how understanding updates)
- Read logic (how understanding is queried)

---

## Learner Lifecycle

### States

```
DORMANT (proto-learner) ←→ ACTIVE → REMOVED
```

- **Dormant (proto-learner):** Exists but below activation threshold. Does not participate in processing or queries.
- **Active:** Above activation threshold. Participates in processing and queries.
- **Removed:** Deleted from the system.

### Transitions

| Transition | Trigger | Who handles |
|------------|---------|-------------|
| Dormant → Active (ignition) | Activation crosses threshold | Learner detects own ignition |
| Active → Dormant | Activation below threshold for extended period | Brain (background process) |
| Dormant → Removed | Dormant for very long period | Brain (background process) |

### Origin

Learners can be created from three sources:

1. **From brain prompt** — Brain parses system prompt, seeds proto-learners with implied purposes
2. **Developer-defined** — Explicit learner definition by developer
3. **Emergent** — Created when existing learners can't handle a pattern (impasse detection)

---

## Governance

### Governance Layer

Each learner has governance metadata that controls its participation:

```
governance: {
  activation: number         // 0.0 - 1.0
  threshold: number          // gates participation
  status: active | dormant
  lastAccessed: timestamp
  retrievalCount: number
  successRate: number
}
```

### Governance Mechanics

| Mechanic | Description | Who handles |
|----------|-------------|-------------|
| **Activation update** | Score changes based on relevance, retrieval, usage | Learner (local) |
| **Threshold gating** | Learners below threshold don't participate | Learner (local) |
| **Ignition detection** | Detect when activation crosses threshold | Learner (local) |
| **Decay** | Activation fades over time | Brain (global) |
| **Deprecation** | Move to dormant/remove after extended low activation | Brain (global) |
| **Split/Merge** | Population dynamics for learner evolution | Brain (global) |

### Split and Merge

Learners don't change their purpose. Evolution happens through population dynamics:

- **Split:** Learner tracking too broad a concern spawns two learners with narrower purposes, then deprecates
- **Merge:** Two learners with overlapping purposes combine into one, other deprecates

Split/merge detection and execution is a brain-level concern.

---

## Interface

### Core Methods

**onData(batch) → { relevance }**

Called when learner receives a batch of data to process.

- Input: batch of enriched data points
- Output: relevance score (for governance update)
- Side effect: may update understanding

**onQuery(query) → { relevant, confidence, insight, gaps }**

Called when learner is consulted for a query.

- Input: natural language query
- Output:
  - relevant: boolean — can this learner help?
  - confidence: number — how confident is the learner?
  - insight: string — the learner's response
  - gaps: string[] — what the learner couldn't answer

### Introspection Methods

**getSummary() → string**

Returns human-readable representation of current understanding.

**getMetadata() → { purpose, governance }**

Returns learner's purpose and governance state.

---

## Processing Logic

### Data Processing (onData)

Learners receive batches of data (batching is a system concern, not learner concern).

Processing is type-specific:

```
process(batch, currentState) → newState
```

Each learner type implements its own process logic:

- **TextLearner:** Extract relevant info, synthesize into updated narrative
- **ListLearner:** Extract items, update list (add, dedupe, prune)
- **GraphLearner:** Extract entities/relations, update graph (add nodes/edges, dedupe, prune)

Implementation details (LLM calls, deterministic logic, etc.) decided per type during implementation.

### Query Handling (onQuery)

Query handling has two steps:

1. **Read:** Retrieve relevant parts of understanding (type-specific)
2. **Respond:** Generate response from retrieved info (LLM)

The read step is different per type:

- **TextLearner:** Pass text to LLM (simple)
- **ListLearner:** Filter/search list for relevant items
- **GraphLearner:** Build and execute graph query, get relevant subgraph

Implementation details decided per type during implementation.

---

## Relationship to Subjects

Learners can exist at two levels:

- **Brain level:** Shared across all subjects
- **Subject level:** Scoped to a specific subject

This is controlled by the developer through system prompts:

- Brain prompt can define brain-level learners
- Subject prompt can define subject-level learners

Both levels can coexist. Developer decides the structure based on their use case.

---

## Configuration

### Learner Definition (developer-defined)

```typescript
brain.addLearner({
  type: "text" | "list" | "graph",
  instructions: `
    Understand [what to track].

    Watch for:
    - [condition 1]
    - [condition 2]

    Track answers to:
    - [question 1]
  `,
  maintenance: {
    // type-specific options
  }
})
```

### Maintenance Options by Type

**TextLearner:**

```typescript
maintenance: {
  // Understanding management strategy
  strategy: "continuous" | "cumulative" | "decay",

  // For cumulative: max tokens before summarization
  maxTokens?: number,

  // For decay: layer configuration (optional, has sensible defaults)
  layers?: ("recent" | "medium" | "old")[]
}
```

**Strategy selection guide:**

| Use case | Recommended strategy |
|----------|---------------------|
| Short-lived subjects (single session) | `continuous` |
| Long-running with bounded cost | `cumulative` |
| Time-sensitive understanding (recency matters) | `decay` |

**ListLearner:**

```typescript
maintenance: {
  deduplication: "strict" | "semantic" | "none",
  maxItems: number,
  pruning: "oldest" | "least-relevant" | "none"
}
```

**GraphLearner:**

```typescript
maintenance: {
  nodeDeduplication: "strict" | "semantic",
  edgePruning: "weak-edges" | "old-edges" | "none",
  maxNodes: number,
  maxEdges: number
}
```

---

## Writing Learner Instructions

The `instructions` field (also called "purpose") is the most important part of a learner definition. It tells the learner what to pay attention to, what to track, and what questions to answer.

### Anatomy of Good Instructions

Instructions can include three types of directives:

1. **What to understand** — general patterns, themes, evolution
2. **What to watch for** — specific conditions or events
3. **What questions to track** — questions the learner should be able to answer

All three are unified: when the learner processes data, it updates its understanding based on all directives. When any directive is satisfied (pattern found, condition met, question answered), the learner emits an update event with appropriate significance.

### Template

```
[Core understanding directive]

Watch for:
- [Specific condition 1]
- [Specific condition 2]

Track answers to:
- [Question 1]
- [Question 2]
```

### Examples

**Therapy session learner:**

```
Understand the patient's emotional patterns, triggers, and coping mechanisms
as they evolve across sessions.

Watch for:
- Any mention of self-harm or suicidal ideation
- Significant mood shifts between sessions
- Recurring themes in what they avoid discussing
- Signs of crisis or acute distress

Track answers to:
- What coping mechanisms are they developing?
- Are they making progress on stated goals?
- What topics cause them to deflect or shut down?
```

**Developer activity learner:**

```
Understand this developer's coding philosophy, style preferences, and
problem-solving patterns.

Watch for:
- Explicit statements of principles or preferences
- Repeated patterns in code reviews or discussions
- Strong reactions (positive or negative) to specific approaches

Track answers to:
- What is their preferred error handling style?
- Do they favor OOP or functional approaches?
- What testing philosophy do they follow?
```

**Crisis monitoring learner:**

```
Understand patterns in who gets targeted and why.

Watch for:
- New targeting criteria emerging
- Shifts in victim selection patterns
- Escalation signals

Track answers to:
- Who is most at risk right now?
- What behaviors increase targeting risk?
- Are there patterns in timing of incidents?
```

### Significance Levels

When the learner updates its understanding, it assesses significance:

| Level | When to use | Example |
|-------|-------------|---------|
| `routine` | Normal refinement of existing understanding | "Added more examples of functional style preference" |
| `notable` | New pattern or meaningful shift | "First clear statement about testing philosophy" |
| `critical` | Watched condition triggered | "Patient mentioned self-harm ideation" |

### Example Evolution Log

```typescript
evolution: [
  {
    summary: "Added error handling preference. In code review, user rejected
              a PR using try/catch, stating 'I prefer Result types or explicit
              error returns - exceptions hide control flow.'",
    significance: "notable",
    timestamp: "2024-01-15T10:30:00Z"
  },
  {
    summary: "Confirmed functional style preference. Third instance of user
              recommending map/filter over for-loops in code reviews.",
    significance: "routine",
    timestamp: "2024-01-14T15:20:00Z"
  },
  {
    summary: "First clear signal on coding style: user prefers functional
              patterns, explicitly stated 'I avoid OOP when possible.'",
    significance: "notable",
    timestamp: "2024-01-12T09:45:00Z"
  }
]
```

Each entry is a synthesized changelog - what changed and why. Events emit the latest entry:

```typescript
learner.on('updated', ({ understanding, entry }) => {
  if (entry.significance === 'critical') {
    alertImmediately(entry.summary)
  } else if (entry.significance === 'notable') {
    queueForReview(entry.summary)
  }
  // routine updates: just log for audit trail
  log(entry.summary)
})

// Query full history
learner.evolution.filter(e => e.significance !== 'routine')
```

### Guidelines

1. **Be specific about watched conditions** — vague watches like "anything bad" won't work well
2. **Questions should be answerable** — "What is X?" is better than "Understand X deeply"
3. **Core understanding is the catch-all** — watched conditions and questions are specific; the core directive handles everything else
4. **Don't over-specify** — the learner will figure out patterns; you're just guiding attention

---

## Agent Prompt Generation

Learners are agents powered by LLMs. The quality of a learner depends heavily on its system prompt. Rather than using simple templates, learners use **intelligent prompt generation** to create optimal agent prompts.

### Why Intelligent Generation?

Simple template concatenation fails because:
- User instructions may conflict with strategy requirements
- Duplicate concerns between user instructions and system behavior
- Formatting directives in user instructions may break strategy structure
- Different strategies need fundamentally different prompting approaches

### The Generation Process

When a learner is created, the system generates its agent prompt by synthesizing:

```
┌─────────────────────────────────────────────────────────────┐
│                  synthesizeAgentPrompt()                     │
│                                                              │
│  Inputs:                                                     │
│  ├─ strategy: "continuous" | "cumulative" | ...             │
│  ├─ instructions: developer's instructions (what to track)  │
│  └─ systemDefaults: significance assessment, evolution log   │
│                                                              │
│  Process (LLM call):                                         │
│  1. Parse user instructions for intent (what to track)       │
│  2. Extract watch conditions and questions                   │
│  3. Merge with strategy-specific structure requirements      │
│  4. Remove duplicates and resolve conflicts                  │
│  5. Ignore user formatting that conflicts with strategy      │
│  6. Generate clean, optimized prompt                         │
│                                                              │
│  Output:                                                     │
│  └─ Cached prompt used for all learner operations            │
└─────────────────────────────────────────────────────────────┘
```

### Strategy-Specific Base Prompts

Each strategy has different structural requirements:

**continuous:**
```
You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.
```

**cumulative:**
```
You maintain understanding within a size limit. When understanding gets large,
you'll be asked to summarize it. The next understanding cycle starts fresh,
seeded only with that summary. Optimize for information density.
Each cycle is self-contained - don't reference "previous" understanding.
```

**decay:**
```
Structure your understanding into temporal sections:
- Current State: What's true right now
- Recent Developments: What changed in the last N observations
- Historical Context: Long-standing patterns, compressed over time

When updating, promote recent → historical and compress older sections.
Recency matters - recent observations get more detail than old ones.
```

### System Defaults (always included)

Regardless of strategy, the generated prompt always includes:

```
When processing new data:
1. Assess relevance to your instructions
2. Update understanding if relevant
3. Generate evolution entry:
   - summary: what changed and why
   - significance: routine | notable | critical
     - routine: normal refinement
     - notable: new pattern or meaningful shift
     - critical: watched condition triggered

Watch conditions from instructions should trigger "critical" significance.
Questions from instructions should be tracked and answered when possible.
```

### Conflict Resolution

The generation process handles conflicts intelligently:

| User Instruction | Strategy | Resolution |
|------------------|----------|------------|
| "Structure as: Current/Historical" | cumulative | Ignore - cumulative doesn't use sections |
| "Track mood changes over time" | any | Keep - this is intent, not formatting |
| "Always include timestamps" | decay | Merge - aligns with strategy |
| "Summarize everything in one paragraph" | decay | Ignore - conflicts with section structure |

**Principle:** Keep the user's *intent* (what to track), ignore their *formatting* if it conflicts with strategy.

### Caching

The generated prompt is **cached on the learner instance**:

```typescript
// On learner creation (once)
const agentPrompt = await synthesizeAgentPrompt({
  strategy: config.maintenance.strategy,
  instructions: config.instructions,
  systemDefaults: SYSTEM_DEFAULTS
})

learner.cachedPrompt = agentPrompt

// Used for all subsequent operations
learner.onData(batch)  // uses cachedPrompt
learner.onQuery(query) // uses cachedPrompt
```

Caching is safe because:
- Instructions are fixed at creation
- Strategy is fixed at creation
- System defaults don't change

### Example Generation

**Input:**
```typescript
{
  strategy: "decay",
  instructions: `
    Understand the patient's emotional patterns.

    Structure as bullet points.  // ← conflicts with strategy

    Watch for:
    - Self-harm mentions
    - Mood shifts

    Track: Are they making progress?
  `
}
```

**Generated prompt:**
```
You are a learning agent that builds understanding over time.

## Your Purpose
Understand the patient's emotional patterns.

## Structure (decay)
Organize your understanding into temporal sections:
- Current State: What's true right now about the patient's emotional patterns
- Recent Developments: Changes observed in recent sessions
- Historical Context: Long-standing patterns, compressed

## Watch Conditions (trigger critical significance)
- Any mention of self-harm or suicidal ideation
- Significant mood shifts between sessions

## Questions to Track
- Are they making progress on their goals?

## On Each Update
- Assess what changed
- Update the appropriate temporal section
- Generate evolution entry with significance level
```

Note: "Structure as bullet points" was ignored because it conflicts with decay structure.

---

## Validation Examples

These examples validate the learners architecture against real use cases.

### Example 1: Crisis Hostage Tracking

**Scenario:** Platform tracks live Twitter feeds during a hostage crisis. Researchers need to understand patterns, not just recall events.

**Learners:**

| Type | Purpose | Understanding Example |
|------|---------|----------------------|
| TextLearner | "Understand patterns in who gets targeted and why" | "Victims are predominantly those who posted locations or identified captors. Male hostages targeted first. Retaliation pattern: killing follows within 6 hours of social media exposure." |
| TextLearner | "Understand killer behavioral evolution and predict next moves" | "Day 1-2: random targeting, testing response. Day 3: shifted to retaliation. Current pattern: killings follow failed negotiations by 2-4 hours. Escalation triggered by media coverage of escape attempts." |
| TextLearner | "Understand hostage emotional state and dominant concerns" | "Primary concerns shifted from survival (day 1) to resources (water shortage critical). Three narratives: distrust of rescue timeline, informal coordination to protect children, debate over posting risks." |
| GraphLearner | "Map relationships between people, locations, and incidents" | Nodes: [room_a, room_b, john_doe, jane_smith, captor_a], Edges: [john_doe--held_in-->room_a, captor_a--controls-->basement] |

**Query routing:**

| Query | Type | Handler |
|-------|------|---------|
| "What happened on January 3rd" | Recall | Storage (not learner concern) |
| "Top 3 repeated narratives from hostages" | Understanding | TextLearner (hostage concerns) |
| "What would be killers' next move" | Understanding | TextLearner (killer patterns) |
| "Who is most at risk right now" | Understanding | TextLearner (targeting patterns) |

**Key insight:** "List of victims" is storage (recall). "Patterns in who gets killed" is learner (understanding).

---

### Example 2: Personal Development Memory

**Scenario:** Brain tracks conversations with Claude Code to understand coding style, principles, and problem-solving approaches.

**Learners:**

| Type | Purpose | Understanding Example |
|------|---------|----------------------|
| TextLearner | "Understand core development philosophy and principles" | "Prioritizes simplicity over cleverness. Key principles: start minimal, type safety non-negotiable, boring technology wins. Frequently references Gall's Law. Dislikes premature abstraction." |
| TextLearner | "Understand coding style patterns and preferences" | "Prefers functional over OOP. Naming: descriptive over terse. Error handling: explicit returns over exceptions. Avoids comments, prefers self-documenting code." |
| ListLearner | "Track recurring problem-solving approaches" | `[{ approach: "Start hardcoded, extract later", contexts: ["new features"] }, { approach: "Write usage first, implement second", contexts: ["API design"] }]` |

**Why this fits:** "What's my coding style?" requires having paid attention across many sessions. Can't be answered by searching one conversation.

---

### Example 3: Therapist Platform

**Scenario:** Platform with 10,000 therapist profiles (bio, blog, videos). Users search for therapists and ask questions about individual profiles.

**Brain-level learners:**

| Type | Purpose |
|------|---------|
| ListLearner | "Track all therapists with specializations, demographics, distinguishing traits" |
| TextLearner | "Understand patterns in therapeutic approaches across the platform" |

**Subject-level learners (per therapist, dormant until accessed):**

| Type | Purpose |
|------|---------|
| TextLearner | "Understand this therapist's philosophy and what makes them unique" |
| TextLearner | "Understand this therapist's experience and expertise areas" |

**Query routing:**

| Query | Level | Handler |
|-------|-------|---------|
| "Female therapists in Amsterdam for anxiety" | Filter | Storage OR brain-level ListLearner |
| "What is Dr. Chen's experience in trauma" | Understanding | Subject-level TextLearner (has processed her content) |

**Key insight:** Structured filtering can be storage. "What makes her unique" requires learner understanding built from her content.

---

### The Validation Test

For any query, ask: **"Can this be answered from one data point, or does it require having paid attention over time?"**

- One data point → Perceiver extracts it, storage recalls it
- Paid attention → Learner maintains understanding

---

## Design Decisions (Resolved)

### Architecture: Learner = Agent + Tools

A learner is an autonomous agent with:
- **Purpose** — natural language, fixed at creation
- **Understanding** — type-specific state (text, list, graph)
- **Tools** — operations the agent can invoke

The agent decides which tools to use based on the situation. Implementation details (LLM vs deterministic) are hidden inside tools.

```
┌─────────────────────────────────────────────────────────┐
│ Learner Agent                                           │
│                                                         │
│  Purpose: "Understand patterns in who gets targeted"    │
│  Understanding: "Victims are predominantly..."          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Tools                                            │   │
│  │  • compareToUnderstanding                        │   │
│  │  • detectShift                                   │   │
│  │  • detectPattern                                 │   │
│  │  • synthesize                                    │   │
│  │  • generateResponse                              │   │
│  │  • identifyGaps                                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Type vs Behavior are Orthogonal

**Type** = how understanding is stored (text blob, list, graph)
**Behavior** = what operations the learner performs (tools)

Behaviors are NOT hardcoded learner types. They are tools that any learner can use. The same tool set works across different understanding formats.

| Behavior Category | Tool | What it does |
|-------------------|------|--------------|
| Incremental Refinement | `compareToUnderstanding` | How does new data relate? (confirms/contradicts/new) |
| Temporal Evolution | `detectShift` | Has something fundamentally changed? |
| Pattern Detection | `detectPattern` | Is a pattern emerging? |
| Multi-source Synthesis | `synthesize` | Combine insights into updated understanding |
| Query Response | `generateResponse` | Answer a query from understanding |
| Gap Identification | `identifyGaps` | What couldn't I answer? |

### Tool Set for TextLearner

**For onData:**

| Tool | Purpose |
|------|---------|
| `compareToUnderstanding` | Assess how new data relates to current understanding |
| `detectShift` | Detect if something has fundamentally changed |
| `detectPattern` | Identify emerging patterns across data points |
| `synthesize` | Update understanding with new insights |

**For onQuery:**

| Tool | Purpose |
|------|---------|
| `generateResponse` | Generate response from understanding (with confidence) |
| `identifyGaps` | Acknowledge what couldn't be answered |

### v0 Scope

| Decision | Rationale |
|----------|-----------|
| **TextLearner only** | Most common type, validates architecture |
| **Skip split/merge** | Defer population dynamics to later version |
| **Fixed developer-defined learners** | No emergent learners in v0 |
| **Full tool set from day one** | Handle all use cases properly |

---

## Open Questions (deferred)

1. **Activation formula:** Exact formula for computing activation from relevance, retrieval, recency.

2. **Split/merge detection:** How brain detects when split or merge is needed. (Deferred to post-v0)

3. **ListLearner/GraphLearner tools:** May need type-specific tools (e.g., `searchList`, `queryGraph`). Define when implementing those types.

---

## Summary

Learners are learning agents with:

- **Fixed purpose** (natural language)
- **Type-specific understanding** (text, list, graph, extensible)
- **Governance layer** (activation, threshold, status)
- **Two core operations:** process data (onData) and respond to queries (onQuery)
- **Lifecycle:** dormant → active → dormant → removed
- **Population dynamics:** evolution through split/merge/spawn, not individual adaptation

Learners are simple. They receive batches, update understanding, and respond to queries. Complex orchestration (batching, routing, synthesis) happens at the brain level.
