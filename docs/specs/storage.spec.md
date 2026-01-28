# Storage Specification v1

> Part of the Unbody Brain injection flow. Defines how perceived data is stored for recall and context.

---

## Overview

Storage is **optional but powerful**. While the brain's core is understanding (learners), storage enables:

- Recall ("what happened on June 13th?")
- Richer context for learners
- Re-processing when perceivers change

**Principle:** Brain is about understanding, not being a database. Storage extends capability but isn't the core.

---

## Architecture

Three storage layers, each with distinct purpose:

```
┌─────────────────────────────────────────────────────────────┐
│ RAW                                                         │
│ - Original input data                                       │
│ - No embedding                                              │
│ - For preservation, restoration, re-processing              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ RECORDS                                                     │
│ - Record-level embeddings (from summary)                    │
│ - High-level semantic search                                │
│ - "Find documents about AI"                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ CHUNKS                                                      │
│ - Chunk-level embeddings (from content items)               │
│ - Precise semantic search                                   │
│ - "Find the paragraph about funding"                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Schemas

### Raw Storage

```typescript
interface RawRecord {
  id: string
  data: unknown              // Original input, any shape
  contentType?: string       // MIME type or data type indicator
  createdAt: Date
}
```

- No embedding required
- Simple key-value or blob storage
- Optional — can be disabled if raw preservation not needed

### Records Index

```typescript
interface Record {
  id: string
  rawId?: string             // Reference to raw storage
  embedding: number[]        // Vector from summary
  summary: string            // Text that was embedded
  metadata: JsonObject       // Arbitrary fields, schema-less
  createdAt: Date
}
```

- One record per injected data item
- Embedding created from perceiver's `summary` output
- Metadata supports arbitrary fields (no fixed schema)

### Chunks Index

```typescript
interface Chunk {
  id: string
  recordId: string           // Reference to parent record
  embedding: number[]        // Vector from content
  type: "text" | "image" | "video" | "audio"
  value: string | BinaryRef  // The content that was embedded
  meta?: JsonObject          // Chunk-level metadata (page, timestamp, etc.)
}
```

- Multiple chunks per record
- Each chunk is separately searchable
- Type determines embedding model used

---

## Query Patterns

| Query Type | Index | Example |
|------------|-------|---------|
| High-level semantic | `records` | "Find documents about machine learning" |
| Precise semantic | `chunks` | "Find the section discussing Series A funding" |
| Filtered | `records` or `chunks` | "Find tweets from @alice with positive sentiment" |
| Combined | Both | Semantic search + metadata filters |

### Filtering on Arbitrary Fields

Metadata fields are schema-less. Queries can filter on any field:

```typescript
// Filter on fields that may or may not exist
search({
  semantic: "AI startups",
  filter: {
    author: "alice",
    sentiment: "positive",
    year: { $gte: 2024 }
  }
})
```

- Fields may not exist on older records (schema evolution)
- Queries handle missing fields gracefully
- No migrations required when perceivers add new fields

---

## Schema Evolution

**Principle:** Embrace heterogeneity. No migrations.

When perceivers change:

- New records get new fields
- Old records keep old fields
- Queries handle missing fields gracefully

```
Time T1: Perceiver outputs { speaker, sentiment }
Time T2: Perceiver updated, outputs { speaker, sentiment, topics }

Records from T1: { speaker: "Alice", sentiment: "positive" }
Records from T2: { speaker: "Bob", sentiment: "neutral", topics: ["AI"] }

Query: filter by topics
  - T1 records: don't match (field missing) — OK
  - T2 records: match if topics contains value
```

Optional: Re-run perceivers on raw data to backfill new fields.

---

## BYODB (Bring Your Own Database)

Brain ships with adapters for common databases. Developer provides infrastructure.

### Supported Patterns

**A. Use built-in adapters**

```typescript
import { weaviate, postgres, s3 } from '@unbody/adapters'

const brain = Unbody.createBrain(prompt, {
  raw: s3(myBucket),
  vector: weaviate(myClient),
  // records + chunks both go to vector db
})
```

**B. Provide custom adapter**

```typescript
const brain = Unbody.createBrain(prompt, {
  storage: {
    raw: {
      put: (id, data) => myBlobStore.save(id, data),
      get: (id) => myBlobStore.load(id)
    },
    records: {
      insert: (record) => myDb.addRecord(record),
      search: (embedding, filters) => myDb.query(...)
    },
    chunks: {
      insert: (chunk) => myDb.addChunk(chunk),
      search: (embedding, filters) => myDb.query(...)
    }
  }
})
```

### Adapter Interface

```typescript
interface RawAdapter {
  put(id: string, data: unknown): Promise<void>
  get(id: string): Promise<unknown>
  delete?(id: string): Promise<void>
}

interface VectorAdapter {
  insert(record: Record | Chunk): Promise<void>
  search(params: {
    embedding: number[]
    filter?: JsonObject
    limit?: number
  }): Promise<Array<Record | Chunk>>
  delete?(id: string): Promise<void>
}
```

---

## Embedding Strategy

Brain handles embedding based on content type:

| Content Type | Embedding Model |
|--------------|-----------------|
| `text` | Text embedding (OpenAI, Cohere, etc.) |
| `image` | Image embedding (CLIP, etc.) |
| `video` | Video embedding model |
| `audio` | Audio embedding model |

**Note:** Different embedding types may require separate indexes (different dimensions/spaces).

BYOE (Bring Your Own Embedder) — developer can provide custom embedding functions.

---

## Injection Flow Integration

```
brain.inject(rawData)
         ↓
┌────────────────────────┐
│ Store in raw (optional)│
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Perceive               │
│ → { summary, content,  │
│     metadata }         │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Embed summary          │
│ → Store in records     │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Embed each content item│
│ → Store in chunks      │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Route to Learners      │
│ (for understanding)    │
└────────────────────────┘
```

---

## Open Questions

1. **Indexing hot fields** — Should brain auto-detect frequently-filtered fields and suggest indexes?
2. **Cross-record relationships** — Do we need graph-style edges between records?
3. **Retention policies** — Auto-cleanup of old raw data?
4. **Consistency** — What happens if embedding succeeds but storage fails?

---

## Summary

| Layer | Purpose | Embedding | Schema |
|-------|---------|-----------|--------|
| Raw | Preservation | No | Any |
| Records | High-level search | Yes (from summary) | Flexible metadata |
| Chunks | Precise search | Yes (from content) | Flexible meta |

Storage makes the brain more capable but isn't the core. Learners (understanding) work without storage. Storage adds recall and richer context.
