# Unbody Brain: Storage Architecture & Learner Implementation

A comprehensive specification covering storage decisions, database architecture, and their impact on learner implementation strategies.

---

## Table of Contents

1. [Core Storage Philosophy](#1-core-storage-philosophy)
2. [Database Engine Selection](#2-database-engine-selection)
3. [Storage Levels & Configuration](#3-storage-levels--configuration)
4. [Database Architecture](#4-database-architecture)
5. [Schema Design Per Learner Type](#5-schema-design-per-learner-type)
6. [Learner Implementation Strategies](#6-learner-implementation-strategies)
7. [Agentic Synthesis](#7-agentic-synthesis)
8. [Platform Support](#8-platform-support)
9. [Advanced Features](#9-advanced-features)
10. [Summary Tables](#10-summary-tables)

---

## 1. Core Storage Philosophy

### Guiding Principles

| Principle | Description |
|-----------|-------------|
| **Zero config** | Brain works immediately without any storage setup |
| **Optional persistence** | Storage adds persistence, not functionality |
| **No lock-in** | Users don't learn Unbody-specific abstractions |
| **Single engine** | One database technology everywhere |
| **Baked in** | User just flips switches, doesn't know what's behind |
| **Runs everywhere** | Server, desktop, browser — same code |

### The API

```typescript
// In-memory (default) — zero config
const brain = new Brain({ model, instructions })

// Enable persistence — just a boolean
const brain = new Brain({ 
  model, 
  instructions,
  storage: true
})

// Granular control (optional)
const brain = new Brain({ 
  model, 
  instructions,
  storage: {
    state: true,
    text: true,
    list: true,
    graph: true,
    vector: true
  }
})
```

User doesn't know or care what database is behind `storage: true`. It just works.

---

## 2. Database Engine Selection

### Decision: Turso

After evaluating options, **Turso** is the selected database engine.

### What is Turso?

Turso is a complete rewrite of SQLite in Rust. Key characteristics:

- **SQLite-compatible**: Same SQL dialect, file format, and patterns
- **In-process**: Embedded database, no separate server
- **Cross-platform**: Server, desktop, browser (WASM)
- **Native vectors**: Built-in vector support, no extensions
- **Modern async**: io_uring on Linux, async-first design
- **Status**: Beta (not production-ready yet, but evolving rapidly)

### Why Turso Over SQLite?

| Capability | SQLite | Turso |
|------------|--------|-------|
| Server | ✓ | ✓ |
| Desktop | ✓ | ✓ |
| Browser (WASM) | ✗ | ✓ |
| Native vectors | Extension needed | Built-in |
| Async I/O | No | Yes |
| CDC | No | Yes |
| Encryption at rest | Extension | Built-in |
| SQLite compatible | — | ✓ (fallback path exists) |

**The browser capability is the deciding factor.** Brain can run entirely on user's device with data never leaving their machine.

### Fallback Strategy

If Turso proves unstable in production:
- Same schema works on SQLite
- Swap the driver, keep the code
- Users can opt into SQLite if paranoid

```typescript
storage: {
  engine: 'turso'  // default
  // or 'sqlite' for conservative users
}
```

---

## 3. Storage Levels & Configuration

### Progressive Enhancement

| Level | State | Understanding | Use Case |
|-------|-------|---------------|----------|
| **Level 0** | Memory | Memory | Testing, demos, ephemeral sessions |
| **Level 1** | Persistent | Memory | Resume brain, rebuild understanding |
| **Level 2** | Persistent | Persistent | Production |

### Default Behavior

```typescript
class Brain {
  constructor(config: BrainConfig) {
    if (!config.storage) {
      // Level 0: Everything in memory
      this.storage = new MemoryStorage()
    } else if (config.storage === true) {
      // Level 2: Full Turso persistence
      this.storage = new TursoStorage()
    } else {
      // Granular configuration
      this.storage = new TursoStorage(config.storage)
    }
  }
}
```

---

## 4. Database Architecture

### Two Storage Layers

| Layer | What it stores | Shape |
|-------|----------------|-------|
| **Brain State** | Config, learner registry, governance | Shared across Brain |
| **Learner Understanding** | Per-learner data | Varies by learner type |

### File Structure: One DB Per Learner

Each learner gets its own database file. This aligns with the principle that learners are self-contained.

```
brain/
├── brain.db                          ← Brain state, learner registry
└── learners/
    ├── coding-philosophy.db          ← TextLearner
    ├── coding-style.db               ← TextLearner  
    ├── pages-visited.db              ← ListLearner
    ├── user-contacts.db              ← GraphLearner
    └── topic-embeddings.db           ← VectorLearner
```

### Why Per-Learner DBs?

| Benefit | Explanation |
|---------|-------------|
| **Isolation** | One learner can't corrupt another |
| **Portability** | Delete learner = delete file |
| **Backup** | Move/backup learner = copy file |
| **No contention** | No write conflicts between learners |
| **Clean mental model** | Learner = self-contained unit |

### Storage Overhead

SQLite/Turso is extremely lightweight:

| Metric | Value |
|--------|-------|
| Library size | ~1 MB |
| Empty database | ~4 KB |
| Per-table overhead | ~4 KB |
| RAM (minimal) | 256 KB |
| RAM (default cache) | 2 MB |

50 learners × 8 KB overhead = 400 KB. Negligible.

### Connection Management

Don't keep all DBs open. Open on demand, close when done:

```typescript
async function learnData(learnerId: string, data: any) {
  const db = openLearnerDb(learnerId)  // open
  await db.save(...)
  db.close()                            // close
}
```

At any moment, only active learners have open connections.

---

## 5. Schema Design Per Learner Type

### Brain Database Schema

```sql
-- brain.db

-- Brain configuration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

-- Learner registry
CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT,              -- 'text', 'list', 'graph', 'vector'
  instructions TEXT,
  strategy TEXT,          -- 'continuous', 'cumulative'
  created_at INTEGER
);

-- Governance state
CREATE TABLE governance (
  learner_id TEXT PRIMARY KEY REFERENCES learners(id),
  activation REAL,        -- 0.0 to 1.0
  last_active INTEGER,
  decay_rate REAL,
  FOREIGN KEY (learner_id) REFERENCES learners(id)
);
```

### Common Tables (All Learner Types)

Every learner database has these tables:

```sql
-- State: key-value for identity, understanding (text), config
CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

-- Observations: buffer from Observe phase
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  content TEXT,
  importance REAL,        -- 0.0 to 1.0
  created_at INTEGER
);

-- Evolution: history from Synthesize phase
CREATE TABLE evolution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  significance TEXT,      -- 'routine', 'notable', 'critical'
  summary TEXT,           -- what changed
  reasoning TEXT,         -- why
  created_at INTEGER
);
```

### TextLearner Schema

TextLearner only needs the common tables. Understanding is stored in `state`:

```sql
-- state table stores:
-- 'identity' → JSON (purpose, focus areas, significance criteria, etc.)
-- 'understanding' → TEXT (the narrative understanding)
-- 'observe_prompt' → TEXT (system prompt for observe phase)
-- 'synthesize_prompt' → TEXT (system prompt for synthesize phase)
```

**Total tables: 3** (state, observations, evolution)

### ListLearner Schema

```sql
-- Common tables: state, observations, evolution

-- Items: the list being tracked
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  data JSON,
  metadata JSON,
  created_at INTEGER,
  updated_at INTEGER
);

-- Indexes for querying
CREATE INDEX idx_items_created ON items(created_at);
```

**Total tables: 4** (state, observations, evolution, items)

### GraphLearner Schema

```sql
-- Common tables: state, observations, evolution

-- Nodes: entities in the graph
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT,
  name TEXT,
  data JSON,
  created_at INTEGER
);

-- Edges: relationships between nodes
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  from_id TEXT REFERENCES nodes(id),
  to_id TEXT REFERENCES nodes(id),
  relation TEXT,
  data JSON,
  created_at INTEGER
);

-- Indexes for traversal
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_name ON nodes(name);
CREATE INDEX idx_edges_from ON edges(from_id);
CREATE INDEX idx_edges_to ON edges(to_id);
CREATE INDEX idx_edges_relation ON edges(relation);
```

**Total tables: 5** (state, observations, evolution, nodes, edges)

### VectorLearner Schema

```sql
-- Common tables: state, observations, evolution

-- Vectors: embeddings with metadata
CREATE TABLE vectors (
  id TEXT PRIMARY KEY,
  content TEXT,           -- original content
  embedding FLOAT32(1536), -- vector (Turso native type)
  metadata JSON,
  created_at INTEGER
);

-- Vector index for similarity search
CREATE INDEX vec_idx ON vectors(libsql_vector_idx(embedding));
```

**Total tables: 4** (state, observations, evolution, vectors)

### Complete Tree View

```
brain/
├── brain.db
│   ├── config (key, value, updated_at)
│   ├── learners (id, name, type, instructions, strategy, created_at)
│   └── governance (learner_id, activation, last_active, decay_rate)
│
└── learners/
    │
    ├── coding-philosophy.db (TextLearner)
    │   ├── state (key, value, updated_at)
    │   ├── observations (id, content, importance, created_at)
    │   └── evolution (id, significance, summary, reasoning, created_at)
    │
    ├── pages-visited.db (ListLearner)
    │   ├── state (key, value, updated_at)
    │   ├── observations (id, content, importance, created_at)
    │   ├── evolution (id, significance, summary, reasoning, created_at)
    │   └── items (id, data, metadata, created_at, updated_at)
    │
    ├── user-contacts.db (GraphLearner)
    │   ├── state (key, value, updated_at)
    │   ├── observations (id, content, importance, created_at)
    │   ├── evolution (id, significance, summary, reasoning, created_at)
    │   ├── nodes (id, type, name, data, created_at)
    │   └── edges (id, from_id, to_id, relation, data, created_at)
    │
    └── topic-embeddings.db (VectorLearner)
        ├── state (key, value, updated_at)
        ├── observations (id, content, importance, created_at)
        ├── evolution (id, significance, summary, reasoning, created_at)
        └── vectors (id, content, embedding, metadata, created_at)
```

---

## 6. Learner Implementation Strategies

### The Two-Phase Learning Pattern

All learners follow the same pattern:

```
learn(data)
    │
    ▼
┌──────────┐
│ Observe  │  → "What do I see?"
└────┬─────┘
     │
     ▼
[observations buffer]
     │
     ▼ (threshold met)
┌──────────────┐
│ Synthesize   │  → "How does this change what I know?"
└──────────────┘
     │
     ▼
[updated understanding]
```

### Understanding Shape by Type

| Learner Type | Understanding Shape | Storage Location |
|--------------|---------------------|------------------|
| TextLearner | Narrative prose | `state.understanding` (text) |
| ListLearner | Collection of items | `items` table |
| GraphLearner | Nodes + relationships | `nodes` + `edges` tables |
| VectorLearner | Embeddings | `vectors` table |

### The Critical Difference: Fits in Context?

| Learner | Understanding Size | Fits in LLM Context? |
|---------|-------------------|----------------------|
| TextLearner | ~5-20 KB | ✓ Yes |
| ListLearner | Thousands of items | ⚠️ Maybe not |
| GraphLearner | Thousands of nodes/edges | ✗ No |
| VectorLearner | Thousands of vectors | ✗ No |

This determines the Synthesize strategy.

---

## 7. Agentic Synthesis

### The Problem

For TextLearner, Synthesize works by injecting full understanding into the prompt:

```
<understanding>
${entireUnderstandingText}
</understanding>

<observations>
${newObservations}
</observations>

Synthesize these observations into your understanding.
```

**For GraphLearner, you can't inject 10,000 nodes into the prompt.**

### The Solution: Tool-Based Synthesize

GraphLearner Synthesize becomes **agentic** — LLM gets tools to query and modify the graph.

### Synthesize Strategy by Learner Type

| Learner | Observe | Synthesize | Why |
|---------|---------|------------|-----|
| TextLearner | Direct | Direct | Text is small, fits in context |
| ListLearner | Direct | Hybrid | May need tools for large lists |
| GraphLearner | Direct | Agentic | Graph too large, needs query tools |
| VectorLearner | Direct | Agentic | Needs similarity search tools |

**Observe is always direct** — extract from input data, no existing understanding needed.

**Synthesize varies** — depends on understanding size and access patterns.

### GraphLearner Tools

```typescript
const graphSynthesizeTools = [
  {
    name: "search_nodes",
    description: "Find nodes by name, type, or attributes",
    parameters: { 
      query: string, 
      type?: string, 
      limit?: number 
    }
  },
  {
    name: "get_node",
    description: "Get a specific node by ID with its data",
    parameters: { 
      id: string 
    }
  },
  {
    name: "get_relationships",
    description: "Get relationships for a node",
    parameters: { 
      nodeId: string, 
      direction?: "in" | "out" | "both",
      relation?: string
    }
  },
  {
    name: "traverse",
    description: "Traverse graph from a starting node",
    parameters: { 
      startId: string, 
      depth: number,
      relation?: string
    }
  },
  {
    name: "add_node",
    description: "Add a new node to the graph",
    parameters: { 
      type: string, 
      name: string, 
      attributes: object 
    }
  },
  {
    name: "update_node",
    description: "Update an existing node's attributes",
    parameters: { 
      id: string, 
      attributes: object 
    }
  },
  {
    name: "add_relationship",
    description: "Add a relationship between two nodes",
    parameters: { 
      from: string, 
      to: string, 
      relation: string, 
      attributes?: object 
    }
  },
  {
    name: "remove_relationship",
    description: "Remove a relationship between nodes",
    parameters: { 
      from: string, 
      to: string, 
      relation: string 
    }
  },
  {
    name: "merge_nodes",
    description: "Merge two nodes that represent the same entity",
    parameters: { 
      keepId: string, 
      removeId: string 
    }
  }
]
```

### VectorLearner Tools

```typescript
const vectorSynthesizeTools = [
  {
    name: "similarity_search",
    description: "Find similar vectors by content or embedding",
    parameters: { 
      query: string,      // text to embed and search
      topK: number,
      threshold?: number  // minimum similarity
    }
  },
  {
    name: "get_vector",
    description: "Get a specific vector by ID",
    parameters: { 
      id: string 
    }
  },
  {
    name: "add_vector",
    description: "Add a new vector with content",
    parameters: { 
      content: string,
      metadata?: object
    }
  },
  {
    name: "update_vector",
    description: "Update vector metadata",
    parameters: { 
      id: string, 
      metadata: object 
    }
  },
  {
    name: "remove_vector",
    description: "Remove a vector",
    parameters: { 
      id: string 
    }
  }
]
```

### Agentic Flow Example (GraphLearner)

**Input observations:**
```json
{
  "entities": [
    { "name": "Sarah", "type": "person", "attributes": { "company": "Acme" } }
  ],
  "relationships": [
    { "from": "Sarah", "to": "Mike", "relation": "colleague" }
  ]
}
```

**LLM reasoning with tools:**

```
1. "I need to integrate Sarah from Acme"
2. → calls search_nodes({ query: "Sarah", type: "person" })
3. → returns: [{ id: "sarah-chen", name: "Sarah Chen", data: { company: "Acme" } }]
4. "Looks like same person — same name pattern, same company"
5. → calls update_node({ id: "sarah-chen", attributes: { lastSeen: "today" } })
6. "Now I need to add relationship to Mike"
7. → calls search_nodes({ query: "Mike", type: "person" })
8. → returns: []
9. "Mike is new"
10. → calls add_node({ type: "person", name: "Mike", attributes: { company: "Acme" } })
11. → returns: { id: "mike-1" }
12. → calls add_relationship({ from: "sarah-chen", to: "mike-1", relation: "colleague" })
13. Done.
```

### Implementation Pattern

```typescript
// TextLearner — Direct Synthesize
class TextLearner {
  async synthesize(observations: string[]): Promise<SynthesizeResult> {
    const understanding = await this.db.get('state', 'understanding')
    
    return llm.generate({
      system: this.synthesizePrompt,
      user: `
        <understanding>${understanding}</understanding>
        <observations>${JSON.stringify(observations)}</observations>
        
        Integrate these observations into your understanding.
      `,
      schema: SynthesizeOutputSchema
    })
  }
}

// GraphLearner — Agentic Synthesize
class GraphLearner {
  async synthesize(observations: GraphObservation[]): Promise<SynthesizeResult> {
    return llm.runAgent({
      system: this.synthesizePrompt,
      user: `
        Integrate these observations into the graph:
        ${JSON.stringify(observations)}
        
        Use your tools to:
        1. Search for existing entities that match
        2. Update or create nodes as needed
        3. Add relationships
        4. Resolve any conflicts
      `,
      tools: this.graphTools,
      maxSteps: 30
    })
  }
}
```

---

## 8. Platform Support

### Turso Packages

| Platform | Package | Notes |
|----------|---------|-------|
| Node.js | `@tursodatabase/database` | Native bindings |
| Browser | `@tursodatabase/database-wasm` | WASM + OPFS |
| Browser (sync) | `@tursodatabase/sync-wasm` | With cloud sync |
| Python | `pyturso` | Native |
| Go | `turso-go` | Native |
| Rust | `turso` crate | Native |
| Java | JDBC integration | Native |

### Same Code, Different Runtime

```typescript
// Detect environment and import appropriate package
const connect = isServer 
  ? require('@tursodatabase/database').connect
  : require('@tursodatabase/database-wasm').connect

// Same API everywhere
const db = await connect('brain.db')
```

### Browser Persistence (OPFS)

In browser, Turso uses Origin Private File System (OPFS) for persistence:

```typescript
import { connect } from "@tursodatabase/database-wasm";

// Persistent — survives page reload
const db = await connect("local.db");

// Ephemeral — resets on reload
const db = await connect(":memory:");
```

**Brain in browser** — user's data stays on their device.

### Platform Capabilities

| Capability | Server | Browser |
|------------|--------|---------|
| Persistence | ✓ File system | ✓ OPFS |
| Vectors | ✓ | ✓ |
| Full SQL | ✓ | ✓ |
| Encryption | ✓ | ✓ |
| Cloud sync | ✓ | ✓ |
| Offline | ✓ | ✓ |

---

## 9. Advanced Features

### 9.1 Native Vector Support

No extensions needed. Built into Turso:

```sql
-- Create table with vector column
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  content TEXT,
  embedding FLOAT32(1536)  -- Native vector type
);

-- Insert with vector
INSERT INTO embeddings VALUES (
  'doc1', 
  'some text', 
  vector32('[0.1, 0.2, ...]')
);

-- Similarity search
SELECT *, vector_distance_cos(embedding, vector32(?)) as distance
FROM embeddings 
ORDER BY distance
LIMIT 10;

-- Create vector index for fast ANN search
CREATE INDEX emb_idx ON embeddings(libsql_vector_idx(embedding));

-- Use index
SELECT * FROM vector_top_k('emb_idx', vector32(?), 10);
```

### 9.2 Change Data Capture (CDC)

Track all changes automatically:

```sql
-- Enable CDC
PRAGMA cdc_mode = 'after';

-- Automatic table created
CREATE TABLE turso_cdc (
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_time INTEGER,      -- Unix timestamp
  change_type INTEGER,      -- -1=delete, 0=update, 1=insert
  table_name TEXT,
  id,                       -- rowid of affected row
  before BLOB,              -- row data before change
  after BLOB                -- row data after change
);
```

**Use cases for Brain:**
- Track understanding evolution over time
- Detect anomalies in data patterns
- Trigger governance/adaptation signals

### 9.3 Embedded Replicas & Sync

Local-first with cloud sync:

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:local.db",           // Local copy
  syncUrl: "libsql://...",        // Remote primary
  authToken: "...",
  syncInterval: 60,               // Auto-sync every 60s
});

// Reads: instant (local)
// Writes: go to remote, sync back

// Manual sync
await client.sync();
```

**Use cases for Brain:**
- Multi-device Brain (phone, desktop, cloud)
- Offline-first with eventual consistency
- Backup to cloud

### 9.4 Encryption at Rest

```typescript
const client = createClient({
  url: "file:encrypted.db",
  encryptionKey: process.env.ENCRYPTION_KEY,
});
```

User data protected locally.

### 9.5 Graph Traversal with Recursive CTE

Standard SQL for graph queries:

```sql
-- Find all people connected to Alice within 2 hops
WITH RECURSIVE connections AS (
  -- Start with Alice
  SELECT id, 0 as depth 
  FROM nodes 
  WHERE id = 'person-alice'
  
  UNION ALL
  
  -- Traverse edges
  SELECT n.id, c.depth + 1
  FROM connections c
  JOIN edges e ON e.from_id = c.id
  JOIN nodes n ON n.id = e.to_id
  WHERE c.depth < 2
)
SELECT DISTINCT * FROM connections;
```

This is **not** Neo4j-level performance, but sufficient for Brain's use case.

---

## 10. Summary Tables

### Storage Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database engine | Turso | Browser support, native vectors, single engine everywhere |
| DB per learner | Yes | Isolation, portability, no contention |
| Common schema | Yes | state, observations, evolution tables |
| Type-specific tables | Yes | items, nodes/edges, vectors |
| Configuration | Baked in | User just says `storage: true` |

### Learner Type Comparison

| Aspect | TextLearner | ListLearner | GraphLearner | VectorLearner |
|--------|-------------|-------------|--------------|---------------|
| Understanding | Prose text | Item collection | Nodes + edges | Embeddings |
| Fits in context | ✓ | Maybe | ✗ | ✗ |
| Observe method | Direct | Direct | Direct | Direct |
| Synthesize method | Direct | Hybrid | Agentic | Agentic |
| Type-specific tables | None | items | nodes, edges | vectors |
| Needs tools | No | Maybe | Yes | Yes |

### Synthesize Strategy Decision Tree

```
Is understanding small enough to fit in LLM context?
│
├── YES → Direct Synthesize
│         (inject full understanding into prompt)
│
└── NO → Agentic Synthesize
          (give LLM tools to query/modify understanding)
```

### Platform Support Matrix

| Platform | Package | Persistence | Vectors | Sync |
|----------|---------|-------------|---------|------|
| Node.js | `@tursodatabase/database` | File | ✓ | ✓ |
| Browser | `@tursodatabase/database-wasm` | OPFS | ✓ | ✓ |
| Python | `pyturso` | File | ✓ | ✓ |
| Go | `turso-go` | File | ✓ | ✓ |
| Rust | `turso` crate | File | ✓ | ✓ |

### Feature Availability

| Feature | Status | Notes |
|---------|--------|-------|
| Core SQLite | ✓ Stable | SQL dialect, file format |
| Vector search | ✓ Works | Native, no extension |
| CDC | ✓ Works | Experimental |
| Encryption | ✓ Works | Experimental |
| Concurrent writes | Experimental | MVCC-based |
| Vector indexing (ANN) | Coming | On roadmap |
| Offline writes | Beta | On roadmap |

---

## Appendix: Migration Path

If Turso proves unstable:

1. **Schema is SQLite-compatible** — same tables work on vanilla SQLite
2. **Swap driver** — change import, keep code
3. **Lose browser support** — would need alternative WASM solution
4. **Lose native vectors** — would need sqlite-vec extension

The architecture is designed with this fallback in mind.

---

## Appendix: File Size Estimates

| Scenario | Estimated Size |
|----------|----------------|
| Empty learner DB | ~12 KB |
| TextLearner (active, 1 year) | ~50-100 KB |
| ListLearner (10K items) | ~5 MB |
| GraphLearner (5K nodes, 20K edges) | ~10 MB |
| VectorLearner (10K vectors, 1536 dim) | ~60 MB |
| Brain with 20 mixed learners | ~100-200 MB |

All manageable for local storage, including browser OPFS.
