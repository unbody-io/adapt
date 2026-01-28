# Perceivers Specification v1

> Part of the Unbody Brain injection flow. Defines how raw data is perceived and processed into a consistent shape for storage and learners.

**Terminology:** Perceivers are also called "Perception Agents" — stateless agents that perceive and process incoming data.

---

## Overview

Perceivers are the **perception layer**. They convert arbitrary input (text, images, video, database records, etc.) into a consistent shape that:

- Learners can learn from
- Storage can index and query
- Is optimized for this brain's specific purpose

**Principle:** Perceivers are context-specific. A brain for "conversation analysis" perceives differently than a brain for "document management."

---

## Core Principles

1. **Perceivers are agents** — autonomous, decide what and how to perceive
2. **Purpose is explicit** — each perceiver has a defined purpose (like learners)
3. **Stateless** — no memory between data points; each input processed in isolation
4. **Evolves over time** — config/behavior changes via knowledge flow mechanisms
5. **Strict output** — all perceivers produce the same shape `{ summary, content[], metadata }`

---

## Core Model: Perceiver = Agent + Tools + Methods

A perceiver has two interfaces:

**Internal (Agent + Tools):**
- Autonomous decision-making
- Decides what/how to perceive based on input and context
- Can consult learners during perception
- Uses tools to extract, chunk, enrich

**External (Methods):**
- Interface for brain/developer to configure and update
- Update config, parameters, tool selection
- Extend behavior without breaking autonomy

```
┌─────────────────────────────────────────────────────────────┐
│ PERCEIVER (Perception Agent)                                │
│                                                             │
│  Purpose: "Extract customer sentiment and urgency signals"  │
│                                                             │
│  Tools (assigned by brain):                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ transcribe  │ │ extractEnt  │ │ semanticChunking    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ summarize   │ │ lookupEntity│ │ askLearner          │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                             │
│  Methods: updateConfig(), setTools(), ...                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tool execution:** Brain pre-configures available tools. Agent decides at runtime which to use and in what order based on input.

---

## Tool Pool (Capabilities)

### Content Extraction

| Tool | Description |
|------|-------------|
| `ocr` | Extract text from images |
| `transcribe` | Convert audio/video to text |
| `caption` | Generate description for images |
| `describeVideo` | Generate description for video content |
| `extractTables` | Extract tabular data from documents |

### Chunking

| Tool | Description |
|------|-------------|
| `semanticChunking` | Split by semantic boundaries |
| `lengthBasedChunking` | Split by token/character count with overlap |
| `pageBasedChunking` | Split by page (PDFs, docs) |
| `timestampChunking` | Split by time segments (audio/video) |

### Enrichment

| Tool | Description |
|------|-------------|
| `summarize` | Generate summary of content |
| `extractEntities` | Extract named entities (people, orgs, places) |
| `extractKeywords` | Extract key terms and topics |
| `classify` | Classify into categories (can be constrained) |
| `sentiment` | Analyze emotional tone |
| `detectLanguage` | Identify language |
| `detectSpeakers` | Identify speakers in audio/video |

### Storage Access (read-only)

| Tool | Description |
|------|-------------|
| `lookupEntity` | Check if entity exists, get canonical name |
| `lookupSimilar` | Find similar existing records |
| `getSchema` | Get current metadata schema/fields |

### Learner Access (read-only)

| Tool | Description |
|------|-------------|
| `askLearner` | Query a specific learner for current understanding |
| `getCategories` | Get current known categories from CategoryLearner |
| `getEntities` | Get known entities from EntityLearner |

---

## Scope Levels

Perceivers can be applied at different scopes. **One perceiver per scope level** — not multiple at the same level.

| Scope | Applies to | Example |
|-------|------------|---------|
| Brain | All incoming data | "Always extract entities and keywords" |
| Subject | Data for specific subject | "For user messages, also detect urgency" |
| Record type | Specific input types | "For images, run OCR and caption" |

**Note:** Subjects are developer-controlled and entity-oriented (e.g., a user, a therapist, a customer). They can contain mixed record types. See brain spec for subject management.

```typescript
// Brain-level perceiver
brain.addPerceiver({
  scope: "brain",
  tools: ["extractEntities", "summarize", "semanticChunking"]
})

// Subject-level perceiver
brain.subject("support-tickets").addPerceiver({
  scope: "subject",
  tools: ["sentiment", "classify", "detectUrgency"]
})

// Record-type perceiver
brain.addPerceiver({
  scope: "record",
  match: (input) => input.type === "image",
  tools: ["ocr", "caption", "extractEntities"]
})
```

---

## Role in the Brain

```
┌─────────────────────────────────────────────────────────────┐
│ Brain Capabilities                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 0: Learners only                                     │
│           inject(raw) → learners learn → understanding      │
│                                                             │
│  Level 1: Learners + Perceivers                             │
│           inject(raw) → perceive → learners learn better    │
│                                                             │
│  Level 2: Learners + Perceivers + Storage                   │
│           inject(raw) → perceive → store → learners + recall│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Learners** are NOT optional (core of brain)
- **Perceivers** are optional but make learners smarter
- **Storage** requires perceivers (stores perceiver output)

---

## Perceiver Output Shape

Every perceiver produces the same shape, regardless of input type:

```typescript
interface PerceiverOutput {
  // Record-level: for high-level semantic search
  summary: string

  // Chunk-level: for precise semantic search
  content: Array<{
    type: "text" | "image" | "video" | "audio"
    value: string | BinaryReference
    meta?: JsonObject  // chunk-specific metadata (page, timestamp, etc.)
  }>

  // Filterable fields: arbitrary, schema-less
  metadata: JsonObject
}
```

### Example Outputs

**Blog post input:**

```typescript
{
  summary: "A comprehensive guide to Series A fundraising, covering pitch decks, valuation, and investor relations.",
  content: [
    { type: "text", value: "Introduction: Raising your Series A...", meta: { section: "intro" } },
    { type: "text", value: "Chapter 1: The Pitch Deck...", meta: { section: "chapter1" } },
    { type: "text", value: "Chapter 2: Valuation...", meta: { section: "chapter2" } },
    // ... more chunks
  ],
  metadata: {
    author: "Alice Chen",
    publishedAt: "2024-01-15",
    tags: ["fundraising", "startups", "VC"],
    wordCount: 5420
  }
}
```

**Video input:**

```typescript
{
  summary: "Interview with Bob discussing AI trends in 2024, covering LLMs, agents, and enterprise adoption.",
  content: [
    { type: "video", value: <video_ref>, meta: { duration: "45:00" } },
    { type: "text", value: "Bob: I think the biggest trend...", meta: { timestamp: "00:01:30", speaker: "Bob" } },
    { type: "text", value: "Alice: What about enterprise?...", meta: { timestamp: "00:05:00", speaker: "Alice" } },
    { type: "image", value: <frame_ref>, meta: { timestamp: "00:10:00", description: "Slide: AI adoption curve" } },
    // ... more chunks
  ],
  metadata: {
    title: "AI Trends 2024",
    speakers: ["Alice", "Bob"],
    recordedAt: "2024-03-20",
    duration: "45:00"
  }
}
```

**Tweet input:**

```typescript
{
  summary: "User expresses excitement about new AI features in productivity tools.",
  content: [
    { type: "text", value: "Just tried the new AI features in Notion - mind blown! 🤯", meta: {} }
  ],
  metadata: {
    author: "@techuser",
    likes: 142,
    retweets: 23,
    sentiment: "positive",
    topics: ["AI", "productivity", "Notion"],
    postedAt: "2024-03-15T10:30:00Z"
  }
}
```

**Database record input:**

```typescript
{
  summary: "Customer profile for Acme Corp, enterprise tier, primary contact John Smith.",
  content: [
    { type: "text", value: "Acme Corp is an enterprise customer in the manufacturing sector...", meta: {} }
  ],
  metadata: {
    customerId: "cust_123",
    companyName: "Acme Corp",
    tier: "enterprise",
    industry: "manufacturing",
    primaryContact: "John Smith",
    arr: 50000,
    healthScore: 85
  }
}
```

---

## How Perceivers Are Defined

### 1. Brain-Inferred (from prompt)

Brain analyzes the system prompt and generates appropriate perceivers.

```typescript
const brain = Unbody.createBrain(`
  You observe customer support conversations.
  Track customer sentiment, common issues, and resolution patterns.
  Focus on identifying frustrated customers early.
`)

// Brain infers it needs perceivers for:
// - Extract sentiment (positive/negative/frustrated)
// - Extract issue category
// - Extract resolution status
// - Extract customer urgency signals
```

### 2. Developer-Defined (explicit)

Developer provides custom perceivers for specific needs.

```typescript
brain.addPerceiver({
  name: "extractSentiment",
  description: "Analyze emotional tone of customer messages",
  execute: async (input) => {
    const sentiment = await analyzeSentiment(input.text)
    return {
      summary: input.text.slice(0, 200),
      content: [{ type: "text", value: input.text, meta: {} }],
      metadata: {
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        isUrgent: sentiment.score < -0.5
      }
    }
  }
})
```

### 3. Combined (brain + developer)

Brain infers base perceivers, developer adds/overrides specific ones.

```typescript
const brain = Unbody.createBrain(prompt, {
  // Brain will infer perceivers from prompt
  // Developer additions/overrides below
})

// Override sentiment analysis with custom model
brain.addPerceiver({
  name: "extractSentiment",
  override: true,  // replaces brain-inferred version
  execute: async (input) => { /* custom implementation */ }
})

// Add new perceiver brain didn't infer
brain.addPerceiver({
  name: "extractCompetitorMentions",
  execute: async (input) => { /* implementation */ }
})
```

---

## Perceiver Types

### By Input Type

Different perceivers for different input modalities:

| Input Type | Perceiver Role |
|------------|----------------|
| Text (short) | Extract entities, sentiment, topics |
| Text (long) | Chunk, summarize, extract structure |
| Image | Caption, detect objects, extract text (OCR) |
| Video | Transcribe, extract key frames, summarize |
| Audio | Transcribe, identify speakers, extract tone |
| Structured (JSON/DB) | Summarize, extract key fields, normalize |

### By Function

| Function | Description |
|----------|-------------|
| **Chunker** | Split long content into semantic chunks |
| **Summarizer** | Generate record-level summary |
| **Extractor** | Pull out specific fields (entities, sentiment, etc.) |
| **Normalizer** | Convert to consistent format |
| **Enricher** | Add derived data (classifications, scores) |

---

## Perceiver Pipeline

When `brain.inject(data)` is called, perceivers run in sequence:

```
Raw Input
    ↓
┌─────────────────────────┐
│ 1. Type Detection       │  Determine input type (text, image, etc.)
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 2. Type-Specific        │  Run perceivers for this input type
│    Perceivers           │  (e.g., image → caption, transcribe, etc.)
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 3. Universal            │  Run perceivers that apply to all types
│    Perceivers           │  (e.g., sentiment, entity extraction)
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 4. Chunking             │  Split content into searchable chunks
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 5. Summarization        │  Generate record-level summary
└─────────────────────────┘
    ↓
PerceiverOutput { summary, content, metadata }
```

---

## Chunking Strategies

Perceivers control how content is chunked based on content type:

| Content Type | Chunking Strategy |
|--------------|-------------------|
| Blog/Article | By section or paragraph |
| PDF | By page or semantic section |
| Video | By scene, timestamp, or speaker turn |
| Audio | By speaker turn or time segment |
| Tweet | No chunking (already atomic) |
| Long text | Fixed size with overlap, or semantic boundaries |

### Chunk Metadata

Each chunk can have its own metadata:

```typescript
content: [
  {
    type: "text",
    value: "Discussion about funding...",
    meta: {
      page: 5,
      section: "Financial Planning",
      position: 12  // chunk index
    }
  }
]
```

---

## Brain-Inferred Perceivers

Brain analyzes prompt to determine what perceivers are needed:

### Inference Rules (examples)

| Prompt Signal | Inferred Perceiver |
|---------------|-------------------|
| "track sentiment" | Sentiment extractor |
| "identify speakers" | Speaker diarization |
| "understand topics" | Topic extraction |
| "monitor urgency" | Urgency classifier |
| "find patterns in behavior" | Activity normalizer |
| "observe conversations" | Conversation parser |

### Example Inference

```typescript
const brain = Unbody.createBrain(`
  Track my digital life.
  Understand my learning interests and how they evolve.
  Help me find connections between topics I'm exploring.
`)

// Brain infers:
// 1. Content type detection (browser history, notes, bookmarks, etc.)
// 2. Topic extraction
// 3. Entity extraction (people, tools, concepts)
// 4. Temporal metadata (when was this consumed)
// 5. Learning signal detection (time spent, revisits, etc.)
```

---

## Perceiver Interface

```typescript
interface Perceiver {
  name: string
  description?: string

  // Which input types this perceiver handles
  // If not specified, handles all types
  inputTypes?: Array<"text" | "image" | "video" | "audio" | "structured">

  // Execution
  execute: (input: PerceiverInput) => Promise<Partial<PerceiverOutput>>

  // Optional: override brain-inferred perceiver with same name
  override?: boolean

  // Optional: run order (lower = earlier)
  priority?: number
}

interface PerceiverInput {
  raw: unknown                    // Original input
  type: string                    // Detected input type
  partial: Partial<PerceiverOutput>  // Output from previous perceivers
  context: {
    brainPrompt: string           // Brain's system prompt
    previousRecords?: Record[]    // Recent records (for context)
  }
}
```

---

## Knowledge Flow

Perceivers are stateless but evolve over time through three complementary mechanisms:

### 1. Feedback Loop (Async)

Learners discover patterns → Brain updates perceiver config → Future perception uses updated config.

```
Time T1: Perceiver has no category constraints
         CategoryLearner observes patterns over time

Time T2: CategoryLearner reports: "I see categories: tutorial, opinion, news"
         Brain updates perceiver config

Time T3: New records get classified into known categories
```

**Direction:** Learners → Brain → Perceiver config
**Timing:** Async/background

### 2. Runtime Learner Access (Sync)

Perceiver can query learners during perception for current understanding.

```
Record arrives
    ↓
Perceiver calls: tools.askLearner("CategoryLearner", "what categories exist?")
    ↓
Returns: ["tutorial", "opinion", "news"]
    ↓
Perceiver classifies using current knowledge
```

**Direction:** Perceiver → Learners (read-only)
**Timing:** Synchronous at perception time

### 3. Re-perceive (Post-hoc)

Old records get enriched with knowledge that didn't exist at perception time.

```
Record arrives at T1
    ↓
Perceive: basic extraction (no categories yet)
    ↓
Time passes, learners learn categories
    ↓
Re-perceive at T2: enrich old record with new knowledge
```

**Direction:** New knowledge → Old records
**Timing:** Async/scheduled/on-demand

### Summary

| Mechanism | Problem Solved | Direction | Timing |
|-----------|----------------|-----------|--------|
| Feedback loop | Config evolution | Learners → Brain → Perceiver | Async |
| Learner access | Access current knowledge | Perceiver → Learners | Sync |
| Re-perceive | Backfill old records | Knowledge → Storage | Async |

### Evolution Examples

**Adding New Fields:**

Brain observes query patterns and realizes a new field would be useful:

```
Query: "What topics did we discuss with frustrated customers?"
Brain: "I should extract 'frustration' as a separate field"

→ Brain updates perceiver config via feedback loop
→ New records get frustration field
→ Old records don't have it (query handles gracefully)
→ Optional: re-perceive to backfill old records
```

**Improving Quality:**

Brain can refine perceivers based on:

- User feedback ("this summary is too long")
- Query patterns ("users keep filtering by X, but I don't extract it well")
- Learner feedback ("I need more context about Y")

---

## Design Decisions

Resolved questions from architecture discussions:

| Question | Decision |
|----------|----------|
| **Multi-level output merging** | Storage concern — perceiver just produces output for its scope |
| **Perceiver composition** | Tool-based — agent decides order, developer guides via prompt, no explicit chaining API |
| **Conditional perceivers** | Both valid: match function (cheap pre-agent gate) and purpose-driven (agent decides relevance) |
| **Async/concurrency** | Sync from caller perspective, internal concurrency via promise.all — no background jobs |
| **Perceiver versioning** | System/storage concern — perceiver doesn't know or care about versions |
| **Cost management** | Deferred to implementation |

---

## Summary

| Aspect | Decision |
|--------|----------|
| Nature | Agent — autonomous, has purpose |
| State | Stateless — no memory between data points |
| Evolution | Via 3 knowledge flow mechanisms |
| Interfaces | Internal (agent+tools) + External (methods) |
| Output shape | `{ summary, content[], metadata }` — strict, all perceivers |
| Content array | Chunks, each with type + value + optional meta |
| Metadata | Arbitrary JSON, schema-less, evolves over time |
| Scope | Brain, subject, record-type — one per level |
| Definition | Brain-inferred + developer-defined |
| Multi-modal | Supported — text, image, video, audio |

Perceivers are the perception layer that makes the brain input-agnostic. Any data in → consistent shape out. They are stateless agents that evolve through configuration changes and learner feedback, not through accumulated state.
