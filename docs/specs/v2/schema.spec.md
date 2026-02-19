# Schema Generation & Validation Specification

> **Effort C**: LLM-generated JSON Schemas for observation/understanding, with two-layer validation.
> Self-contained — no external spec dependencies.
> **Prerequisite**: Effort B complete (learners use store).

---

## Overview

Every learner maintains two schemas:
1. **`observation_schema`** — defines shape of data extracted during observe phase
2. **`understanding_schema`** — defines shape of data stored in understanding collection

Both stored in the `state` collection as JSON Schema objects.

---

## Schema by Learner Type

| Learner Type | `observation_schema` | `understanding_schema` | Generation |
|--------------|---------------------|----------------------|------------|
| **Text** | `{ type: "string" }` | `{ type: "string" }` | Hardcoded (no LLM needed) |
| **List** | JSON Schema object | JSON Schema object | LLM-generated or user-provided |

### Text Learner — Hardcoded Schemas

```typescript
const observationSchema = {
  type: "string",
  description: "Single observation. Concise and factual.",
  minLength: 10,
  maxLength: 500
}

const understandingSchema = {
  type: "string",
  description: "Comprehensive prose synthesis. Well-structured narrative.",
  minLength: 100,
  maxLength: 5000
}
```

### List Learner — LLM-Generated or User-Provided

```typescript
async function generateObservationSchema(
  model: LanguageModel,
  instructions: string,
  identity: string
): Promise<JSONSchema>

async function generateUnderstandingSchema(
  model: LanguageModel,
  instructions: string,
  identity: string
): Promise<JSONSchema>
```

**Example JSON Schema (ListLearner):**

```json
{
  "type": "object",
  "properties": {
    "person": {
      "type": "string",
      "enum": ["personA", "personB"],
      "description": "Person identifier"
    },
    "activity": {
      "type": "string",
      "enum": ["coffee", "breakfast", "lunch", "dinner"]
    },
    "timestamp": {
      "type": "string",
      "format": "time",
      "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
      "description": "Time in HH:mm 24-hour format"
    }
  },
  "required": ["person", "activity", "timestamp"]
}
```

---

## Why JSON Schema Format

- Standard format LLMs know well
- Zod 4 native support: `z.fromJSONSchema()` / `z.toJSONSchema()`
- Rich validation: enums, formats, patterns, min/max, required fields
- No custom conversion logic needed
- Serializable as plain objects

---

## Two-Phase Init

### Phase 1: Observe Init

```typescript
async function initObserve(
  model: LanguageModel,
  instructions: string,
  providedObservationSchema?: JSONSchema,
  focus?: string
): Promise<ObserveInitResult> {
  // 1. Generate identity
  const { identity, domain } = await generateObserveIdentity(model, instructions, focus)

  // 2. Get observation schema (provided or generate)
  const observationSchema = providedObservationSchema
    || await generateObservationSchema(model, instructions, identity)

  // 3. Build system prompt
  const systemPrompt = buildObserveSystemPrompt(identity, observationSchema)

  // 4. Store schema in state
  await store.state.add({ id: 'observation_schema', value: observationSchema, updatedAt: now })

  return { identity, domain, observationSchema, systemPrompt }
}
```

For TextLearner, step 2 uses the hardcoded string schema instead of generating.

### Phase 2: Understand Init

```typescript
async function initUnderstand(
  model: LanguageModel,
  instructions: string,
  providedUnderstandingSchema?: JSONSchema
): Promise<UnderstandInitResult> {
  // 1. Generate identity
  const { identity } = await generateUnderstandIdentity(model, instructions)

  // 2. Get understanding schema (provided or generate)
  const understandingSchema = providedUnderstandingSchema
    || await generateUnderstandingSchema(model, instructions, identity)

  // 3. Build system prompt
  const systemPrompt = buildUnderstandSystemPrompt(identity, understandingSchema)

  // 4. Store schema in state
  await store.state.add({ id: 'understanding_schema', value: understandingSchema, updatedAt: now })

  return { identity, understandingSchema, systemPrompt }
}
```

---

## Schema in Structured Output

Schema is used **ONLY** in output definition — not duplicated in prompt text. AI SDK shows schema to LLM via structured output mechanism.

### Observe Phase

```typescript
// Text
output: Output.object({
  schema: z.object({
    observations: z.array(z.fromJSONSchema(observationSchema))
  })
})

// List
output: Output.object({
  schema: z.object({
    items: z.array(z.fromJSONSchema(observationSchema))
  })
})
```

### Understand Phase

```typescript
// Text
output: Output.object({
  schema: z.object({
    understanding: z.fromJSONSchema(understandingSchema)
  })
})

// List
output: Output.object({
  schema: z.object({
    add: z.array(z.fromJSONSchema(understandingSchema)),
    update: z.array(z.object({
      id: z.string(),
      data: z.fromJSONSchema(understandingSchema)
    })),
    remove: z.array(z.string())
  })
})
```

### Zod Conversion

```typescript
// Load from state
const schemaRecord = await store.state.get('observation_schema')

// Convert to Zod for validation
const zodSchema = z.fromJSONSchema(schemaRecord.value)

// Validate
zodSchema.parse(item)          // throws if invalid
zodSchema.safeParse(item)      // returns { success, data/error }
```

---

## Two-Layer Validation

### Layer 1: Generation Time (AI SDK)

- AI SDK validates LLM output against schema during every `generate()` call with structured output
- Attempts JSON repair on malformed output
- **On failure**: throw error, fail the operation

```typescript
async observe(data: unknown[]): Promise<ObservationRecord[]> {
  try {
    const { output } = await generate({
      model,
      system: identity,
      prompt: `Data: ${JSON.stringify(data)}`,
      output: Output.object({
        schema: z.object({
          items: z.array(z.fromJSONSchema(this.observationSchema))
        })
      })
    })
    return output.items.map(item => ({
      id: generateId(),
      data: item,
      metadata_importance: 0.5,
      metadata_tokens: 0,
      metadata_status: 'pending' as const,
      metadata_created_at: new Date().toISOString()
    }))
  } catch (error) {
    console.error('Observation generation failed:', error)
    throw error
  }
}
```

### Layer 2: Storage Write Time

- Validate data before writing to storage (double-check)
- Catches transformation bugs between generation and storage
- **On failure**: log error, skip invalid records (partial write)

```typescript
async addObservations(records: ObservationRecord[]): Promise<void> {
  const validRecords: ObservationRecord[] = []
  for (const record of records) {
    const result = z.fromJSONSchema(observationSchema).safeParse(record.data)
    if (result.success) {
      validRecords.push(record)
    } else {
      console.error(`Skipping invalid record ${record.id}:`, result.error)
    }
  }
  for (const record of validRecords) {
    await store.observations.add(record)
  }
}
```

### Error Handling Summary

| Validation Point | On Failure | Rationale |
|------------------|------------|-----------|
| **Generation** (LLM output) | Throw error, fail operation | LLM should always produce valid output; failure indicates prompt/model issue |
| **Storage** (before write) | Log error, skip record | Transformation bug; save what's valid, report what's not |

---

## Cardinality & Understand Behavior

| Learner Type | Observe Output | observations | understanding | Understand Behavior |
|--------------|---------------|--------------|---------------|---------------------|
| **Text** | `Array<string>` | Multiple records | **ONE record** (single prose) | Merge all observations into unified prose |
| **List** | `Array<Item>` | Multiple records | **Multiple records** (deduplicated) | Dedup, filter irrelevant, merge similar, update existing |

**Key insight**: Understand actively curates — it's NOT a 1:1 copy from observations to understanding. It deduplicates, filters irrelevant items, merges similar ones, and updates existing records.

### Example: TextLearner Data Flow

```typescript
// Observe output
["User prefers vim keybindings", "User likes dark mode"]

// observations collection (2 records)
[
  { id: "obs_1", data: "User prefers vim keybindings",
    metadata_importance: 0.8, metadata_tokens: 45,
    metadata_status: "pending", metadata_created_at: "..." },
  { id: "obs_2", data: "User likes dark mode",
    metadata_importance: 0.7, metadata_tokens: 38,
    metadata_status: "pending", metadata_created_at: "..." }
]

// understanding collection (1 record)
[
  { id: "understanding",
    data: "User is a developer who prefers vim keybindings and dark mode themes.",
    metadata_confidence: 0.9,
    metadata_created_at: "...", metadata_updated_at: "..." }
]
```

### Example: ListLearner Data Flow

```typescript
// Observe output (5 items — includes duplicates and irrelevant)
[
  { person: "A", activity: "coffee", time: "10:30" },
  { person: "A", activity: "coffee", time: "10:31" },     // duplicate
  { person: "B", activity: "breakfast", time: "09:00" },
  { person: "irrelevant", activity: "xyz", time: "..." },  // filtered
  { person: "A", activity: "lunch", time: "12:00" }
]

// After understand: understanding collection (3 records — deduplicated, filtered)
[
  { id: "item_1",
    data: { person: "A", activity: "coffee", time: "10:30" },
    metadata_confidence: 0.95,
    metadata_created_at: "...", metadata_updated_at: "..." },
  { id: "item_2",
    data: { person: "B", activity: "breakfast", time: "09:00" },
    metadata_confidence: 0.9,
    metadata_created_at: "...", metadata_updated_at: "..." },
  { id: "item_3",
    data: { person: "A", activity: "lunch", time: "12:00" },
    metadata_confidence: 0.95,
    metadata_created_at: "...", metadata_updated_at: "..." }
]
```

---

## Schema Evolution

When instructions change:
1. Regenerate observe identity + both schemas
2. Overwrite in state collection
3. No data migration needed (storage is generic JSON)
4. Existing items continue to work (soft contract)
5. New items follow new schemas

Full schema evolution strategy (versioning, breaking changes, migration) deferred to future work.

---

## Implementation Steps

```
C1. Schema generation (init phases + storage in state)
C2. Two-layer validation (generation + storage write)
C3. Schema evolution (deferred)
```

Can be layered onto Effort B incrementally.
