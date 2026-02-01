# Batching and Chunking Specification

**Scope:** Two-level batching mechanism for Brain and Learner to handle large data inputs.

---

## Overview

This spec introduces batching at two levels:

1. **Brain-level batching** - Caps the number of items per inject call to learners
2. **Learner-level chunking** - Caps token size of input, chunking when exceeded

Both mechanisms are transparent to the user but reflected in return types for observability.

---

## Brain-Level Batching

### Purpose

Control how many items are sent to learners in a single `ingest()` call. Prevents overwhelming learners with massive batches and enables future optimizations (queueing, background processing).

### Configuration

```typescript
interface BrainConfig {
  prompt: string
  model: LanguageModel
  batchSize?: number        // Default: 20
  maxInputTokens?: number   // Default: 30000 (passed to learners)
}
```

### Behavior

1. User calls `brain.inject(items)`
2. If `items.length <= batchSize`, process as single batch
3. If `items.length > batchSize`, chunk into multiple batches
4. Process batches sequentially
5. Each batch is sent to all learners (existing broadcast behavior)

**Example:**
```typescript
const brain = new Brain({
  prompt: '...',
  model: openai('gpt-4o'),
  batchSize: 20,  // cap
})

// 50 items → 3 batches: [20, 20, 10]
await brain.inject(fiftyItems)
```

### Batch Processing Flow

```
brain.inject(50 items)
  │
  ├─► Batch 1 (items 0-19)
  │     ├─► learner-1.ingest([...20 items])
  │     └─► learner-2.ingest([...20 items])
  │
  ├─► Batch 2 (items 20-39)
  │     ├─► learner-1.ingest([...20 items])
  │     └─► learner-2.ingest([...20 items])
  │
  └─► Batch 3 (items 40-49)
        ├─► learner-1.ingest([...10 items])
        └─► learner-2.ingest([...10 items])
```

---

## Learner-Level Chunking

### Purpose

Prevent token overflow when input data exceeds model context limits. Uses character-based approximation to estimate tokens.

### Configuration

```typescript
interface TextLearnerConfig {
  model: LanguageModel
  instructions: string
  maxInputTokens?: number   // Default: 30000
  // ... other existing fields
}
```

**Config inheritance:**
- If learner uses Brain's model → inherits Brain's `maxInputTokens`
- If learner has own model → uses its own `maxInputTokens`

### Token Estimation

Character-based approximation (internal constant, not configurable via public API):

```typescript
// Internal constant
const CHARS_PER_TOKEN = 4
```

Token estimate = `JSON.stringify(input).length / CHARS_PER_TOKEN`

### Behavior

1. Learner receives batch from Brain (or direct `ingest()` call)
2. Estimate tokens for input
3. If under `maxInputTokens`, process as single chunk
4. If over `maxInputTokens`, split into multiple chunks
5. Process chunks sequentially via existing agent flow

**Example:**
```typescript
// Learner with 30k token cap
// Receives batch that estimates to 80k tokens
// → Splits into 3 chunks: [~30k, ~30k, ~20k]
```

### Chunking Strategy

Split by item count to approximate target token size:

1. Calculate total estimated tokens
2. Determine number of chunks needed: `ceil(totalTokens / maxInputTokens)`
3. Split items evenly across chunks
4. Process each chunk through existing `ingest()` flow

---

## ID Generation

All IDs use nanoid with prefix for easy identification:

| Entity | Prefix | Example |
|--------|--------|---------|
| Inject | `inject_` | `inject_a1b2c3` |
| Batch | `batch_` | `batch_x4y5z6` |
| Chunk | `chunk_` | `chunk_m7n8o9` |

**Implementation:**
```typescript
import { nanoid } from 'nanoid'

const injectId = `inject_${nanoid()}`
const batchId = `batch_${nanoid()}`
const chunkId = `chunk_${nanoid()}`
```

---

## Return Types

### Learner.ingest()

```typescript
interface IngestResult {
  chunks: Array<{
    id: string        // chunk_xyz789
    index: number     // 0-indexed position
    relevance: number // 0-1
  }>
}
```

**Single chunk (no splitting needed):**
```typescript
{
  chunks: [
    { id: 'chunk_a1b2c3', index: 0, relevance: 0.85 }
  ]
}
```

**Multiple chunks (input exceeded token cap):**
```typescript
{
  chunks: [
    { id: 'chunk_a1b2c3', index: 0, relevance: 0.85 },
    { id: 'chunk_d4e5f6', index: 1, relevance: 0.72 },
    { id: 'chunk_g7h8i9', index: 2, relevance: 0.90 }
  ]
}
```

### Brain.inject()

```typescript
interface BrainInjectResult {
  id: string  // inject_abc123 - unique per inject() call
  batches: Array<{
    id: string      // batch_abc123
    index: number   // 0-indexed position
    results: Array<{
      learnerId: string
      chunks: Array<{
        id: string        // chunk_xyz789
        index: number     // 0-indexed position
        relevance: number // 0-1
      }>
    }>
  }>
}
```

**Example - 50 items, batchSize=20, one learner needed token chunking:**
```typescript
{
  id: 'inject_abc123',
  batches: [
    {
      id: 'batch_a1b2c3',
      index: 0,
      results: [
        {
          learnerId: 'coding-style',
          chunks: [{ id: 'chunk_x1', index: 0, relevance: 0.8 }]
        },
        {
          learnerId: 'learning-interests',
          chunks: [
            { id: 'chunk_y1', index: 0, relevance: 0.5 },
            { id: 'chunk_y2', index: 1, relevance: 0.6 }  // token chunking occurred
          ]
        }
      ]
    },
    {
      id: 'batch_d4e5f6',
      index: 1,
      results: [
        {
          learnerId: 'coding-style',
          chunks: [{ id: 'chunk_x2', index: 0, relevance: 0.3 }]
        },
        {
          learnerId: 'learning-interests',
          chunks: [{ id: 'chunk_y3', index: 0, relevance: 0.9 }]
        }
      ]
    },
    {
      id: 'batch_g7h8i9',
      index: 2,
      results: [
        {
          learnerId: 'coding-style',
          chunks: [{ id: 'chunk_x3', index: 0, relevance: 0.7 }]
        },
        {
          learnerId: 'learning-interests',
          chunks: [{ id: 'chunk_y4', index: 0, relevance: 0.4 }]
        }
      ]
    }
  ]
}
```

---

## API Changes

### Brain.inject()

```typescript
// Current signature
async inject(data: unknown | unknown[]): Promise<InjectResult>

// New signature
async inject(
  data: unknown | unknown[],
  options?: { id?: string }
): Promise<BrainInjectResult>
```

**Options:**
- `id` - Optional custom inject ID. If not provided, auto-generated with `inject_` prefix.

**Examples:**
```typescript
// Auto-generated ID
const result = await brain.inject(items)
// result.id = 'inject_a1b2c3'

// Custom ID
const result = await brain.inject(items, { id: 'inject_my-upload-123' })
// result.id = 'inject_my-upload-123'
```

### Learner.ingest()

```typescript
// Current signature
async ingest(batch: unknown[]): Promise<IngestResult>

// New signature (same input, new return type)
async ingest(batch: unknown[]): Promise<IngestResult>

// Where IngestResult changes from:
interface IngestResult {
  relevance: number
}

// To:
interface IngestResult {
  chunks: Array<{
    id: string
    index: number
    relevance: number
  }>
}
```

---

## Configuration Defaults

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `batchSize` | BrainConfig | 20 | Max items per batch |
| `maxInputTokens` | BrainConfig, TextLearnerConfig | 30000 | Max estimated tokens per chunk |
| `CHARS_PER_TOKEN` | Internal constant | 4 | Character-to-token ratio |

---

## Implementation Notes

### Brain-Level Implementation

```typescript
class Brain {
  private batchSize: number
  private maxInputTokens: number

  constructor(config: BrainConfig) {
    this.batchSize = config.batchSize ?? 20
    this.maxInputTokens = config.maxInputTokens ?? 30000
    // ...
  }

  async inject(
    data: unknown | unknown[],
    options?: { id?: string }
  ): Promise<BrainInjectResult> {
    const injectId = options?.id ?? `inject_${nanoid()}`
    const items = Array.isArray(data) ? data : [data]

    // Chunk by batchSize
    const batches: unknown[][] = []
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize))
    }

    // Process batches sequentially
    const batchResults = []
    for (let i = 0; i < batches.length; i++) {
      const batchId = `batch_${nanoid()}`
      const batch = batches[i]

      // Send to all learners
      const results = await Promise.all(
        this.getLearners().map(async (learner) => {
          const result = await learner.ingest(batch)
          return {
            learnerId: learner.id,
            chunks: result.chunks,
          }
        })
      )

      batchResults.push({
        id: batchId,
        index: i,
        results,
      })
    }

    return {
      id: injectId,
      batches: batchResults,
    }
  }
}
```

### Learner-Level Implementation

```typescript
class TextLearner {
  private maxInputTokens: number

  constructor(config: TextLearnerConfig) {
    this.maxInputTokens = config.maxInputTokens ?? 30000
    // ...
  }

  private estimateTokens(input: unknown): number {
    const CHARS_PER_TOKEN = 4
    return Math.ceil(JSON.stringify(input).length / CHARS_PER_TOKEN)
  }

  async ingest(batch: unknown[]): Promise<IngestResult> {
    const totalTokens = this.estimateTokens(batch)

    if (totalTokens <= this.maxInputTokens) {
      // Process as single chunk
      const result = await this.processChunk(batch)
      return {
        chunks: [{
          id: `chunk_${nanoid()}`,
          index: 0,
          relevance: result.relevance,
        }]
      }
    }

    // Split into chunks
    const numChunks = Math.ceil(totalTokens / this.maxInputTokens)
    const chunkSize = Math.ceil(batch.length / numChunks)

    const chunks: unknown[][] = []
    for (let i = 0; i < batch.length; i += chunkSize) {
      chunks.push(batch.slice(i, i + chunkSize))
    }

    // Process chunks sequentially
    const chunkResults = []
    for (let i = 0; i < chunks.length; i++) {
      const result = await this.processChunk(chunks[i])
      chunkResults.push({
        id: `chunk_${nanoid()}`,
        index: i,
        relevance: result.relevance,
      })
    }

    return { chunks: chunkResults }
  }

  private async processChunk(items: unknown[]): Promise<{ relevance: number }> {
    // Existing agent processing logic
    // ...
  }
}
```

---

## Breaking Changes

### IngestResult

Old:
```typescript
interface IngestResult {
  relevance: number
}
```

New:
```typescript
interface IngestResult {
  chunks: Array<{
    id: string
    index: number
    relevance: number
  }>
}
```

### BrainInjectResult (renamed from InjectResult)

Old:
```typescript
interface InjectResult {
  results: Array<{
    learnerId: string
    relevance: number
  }>
}
```

New:
```typescript
interface BrainInjectResult {
  id: string
  batches: Array<{
    id: string
    index: number
    results: Array<{
      learnerId: string
      chunks: Array<{
        id: string
        index: number
        relevance: number
      }>
    }>
  }>
}
```

---

## Dependencies

Add nanoid for ID generation:

```bash
npm install nanoid
```

---

## Out of Scope

- Async/background processing of batches
- Smart routing (sending only to relevant learners)
- Parallel batch processing
- Retry logic for failed chunks
- Progress callbacks during batch processing

---

## Open Questions

1. **Chunk splitting strategy:** Current approach splits by item count. Should we consider splitting by estimated tokens per item for more accurate chunks?

2. **Parallel processing:** Should batches within an inject be processed in parallel? (Currently sequential for simplicity)

3. **Error handling:** If one chunk fails, should we continue with remaining chunks or abort the entire inject?
