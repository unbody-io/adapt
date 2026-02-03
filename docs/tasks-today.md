# Tasks for Today

## Implementation

---

### Phase 1: Foundation (Types & Structure)

**Why first:** Everything else depends on these base type changes. The learner structure must be updated before we can implement the new synthesis flow or strategies.

**Reference:** Learner Structure (spec lines 21-58)

#### 1.1 Rename `purpose` → `instructions`

**What:** Change the field name from `purpose` to `instructions` throughout the codebase.

**Why:** The field isn't just a purpose statement anymore. It now contains:
- What to understand (core directive)
- What to watch for (specific conditions → critical significance)
- What questions to track (questions to answer over time)

**Files to change:**
- `src/types.ts` - type definitions
- `src/learners/text-learner.ts` - TextLearner implementation
- Any tests or examples using `purpose`

**Spec reference:**
```
instructions: string  // natural language, fixed at creation (also called "purpose")
```

- [ ] Complete

---

#### 1.2 Add `evolution: EvolutionEntry[]` to learner state

**What:** Add an array to track the history of understanding changes.

**Why:** Instead of just storing current understanding, we now track how it evolved. This enables:
- Audit trail of what changed and when
- Filtering by significance (show only critical/notable changes)
- Application-level routing based on change type

**Current state structure:**
```typescript
// Before
{
  understanding: string
}

// After
{
  understanding: string
  evolution: EvolutionEntry[]  // newest first
}
```

**Spec reference:** Lines 32-40

- [ ] Complete

---

#### 1.3 Add `EvolutionEntry` type

**What:** Define the type for evolution log entries.

**Definition:**
```typescript
type Significance = "routine" | "notable" | "critical"

interface EvolutionEntry {
  summary: string       // what changed and why
  significance: Significance
  timestamp: string     // ISO 8601
}
```

**Significance levels (from spec lines 463-467):**

| Level | When to use | Example |
|-------|-------------|---------|
| `routine` | Normal refinement of existing understanding | "Added more examples of functional style preference" |
| `notable` | New pattern or meaningful shift | "First clear statement about testing philosophy" |
| `critical` | Watched condition triggered | "Patient mentioned self-harm ideation" |

- [ ] Complete

---

### Phase 2: Core Flow (Synthesis & Events)

**Why:** This phase updates how data flows through the learner. When `onData` is called, the learner must now:
1. Synthesize new understanding
2. Assess significance of the change
3. Create an evolution entry
4. Emit event with the entry

**Depends on:** Phase 1 (needs the new types)

---

#### 2.1 Update `synthesize` tool output

**What:** Change the synthesize tool to return both understanding and evolution entry.

**Current output:**
```typescript
{ understanding: string }
```

**New output:**
```typescript
{
  understanding: string
  entry: {
    summary: string
    significance: "routine" | "notable" | "critical"
  }
}
```

**The model must now:**
- Generate updated understanding
- Describe what changed (summary)
- Assess how significant the change is

**Spec reference:** Lines 593-606 (System Defaults)

- [ ] Complete

---

#### 2.2 Add significance assessment to synthesis

**What:** The synthesis step must determine significance based on the learner's instructions.

**Logic:**
```
If a "Watch for" condition was triggered → critical
Else if new pattern or meaningful shift → notable
Else → routine
```

**This requires the synthesize prompt to:**
1. Know what the watch conditions are (from instructions)
2. Check if any were triggered by the new data
3. Output appropriate significance level

**Spec reference:** Lines 588-606

- [ ] Complete

---

#### 2.3 Update `onData` to append evolution entries

**What:** When understanding updates, append the new entry to the evolution array.

**Flow:**
```typescript
async onData(batch) {
  const result = await this.synthesize(batch, this.understanding)

  // Update understanding
  this.understanding = result.understanding

  // Append evolution entry (newest first)
  this.evolution.unshift({
    ...result.entry,
    timestamp: new Date().toISOString()
  })

  // Emit event
  this.emit('updated', { understanding: this.understanding, entry: this.evolution[0] })
}
```

- [ ] Complete

---

#### 2.4 Update event emission

**What:** Change the 'updated' event to include the latest evolution entry.

**Current:**
```typescript
this.emit('updated', { understanding })
```

**New:**
```typescript
this.emit('updated', { understanding, entry })
```

**Application usage (from spec lines 498-510):**
```typescript
learner.on('updated', ({ understanding, entry }) => {
  if (entry.significance === 'critical') {
    alertImmediately(entry.summary)
  } else if (entry.significance === 'notable') {
    queueForReview(entry.summary)
  }
  // routine: just log
})
```

- [ ] Complete

---

### Phase 3: Agent Prompt Generation

**Why:** Different strategies need different prompts. Simple template concatenation fails because:
- User instructions may conflict with strategy requirements
- Duplicate concerns between user instructions and system behavior
- Formatting directives in user instructions may break strategy structure

**Solution:** Use an LLM to intelligently synthesize the optimal agent prompt at learner creation time, then cache it.

**Reference:** Spec section "Agent Prompt Generation" (lines 521-692)

---

#### 3.1 Implement `synthesizeAgentPrompt()`

**What:** Create an LLM-based function that generates optimal agent prompts.

**Signature:**
```typescript
async function synthesizeAgentPrompt(config: {
  strategy: "continuous" | "cumulative" | "decay"
  instructions: string
  systemDefaults: string
}): Promise<string>
```

**Process (from spec lines 546-556):**
1. Parse user instructions for intent (what to track)
2. Extract watch conditions and questions
3. Merge with strategy-specific structure requirements
4. Remove duplicates and resolve conflicts
5. Ignore user formatting that conflicts with strategy
6. Generate clean, optimized prompt

**Key principle:** Keep user's *intent* (what to track), ignore their *formatting* if it conflicts with strategy.

- [ ] Complete

---

#### 3.2 Create strategy-specific base prompts

**What:** Define the base prompt template for each strategy.

**continuous (spec lines 564-568):**
```
You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.
```

**cumulative (spec lines 571-576):**
```
You maintain understanding within a size limit. When understanding gets large,
you'll be asked to summarize it. The next understanding cycle starts fresh,
seeded only with that summary. Optimize for information density.
Each cycle is self-contained - don't reference "previous" understanding.
```

**decay (spec lines 579-587):**
```
Structure your understanding into temporal sections:
- Current State: What's true right now
- Recent Developments: What changed in the last N observations
- Historical Context: Long-standing patterns, compressed over time

When updating, promote recent → historical and compress older sections.
Recency matters - recent observations get more detail than old ones.
```

- [ ] Complete

---

#### 3.3 Cache generated prompt on learner instance

**What:** Store the generated prompt on the learner so it's not regenerated on every operation.

**Implementation:**
```typescript
class TextLearner {
  private cachedPrompt: string

  async initialize() {
    this.cachedPrompt = await synthesizeAgentPrompt({
      strategy: this.config.maintenance.strategy,
      instructions: this.config.instructions,
      systemDefaults: SYSTEM_DEFAULTS
    })
  }

  // All operations use this.cachedPrompt
}
```

**Why caching is safe (spec lines 640-643):**
- Instructions are fixed at creation
- Strategy is fixed at creation
- System defaults don't change

- [ ] Complete

---

#### 3.4 Handle conflicts between user instructions and strategy

**What:** The prompt generation must intelligently resolve conflicts.

**Conflict resolution table (from spec lines 612-618):**

| User Instruction | Strategy | Resolution |
|------------------|----------|------------|
| "Structure as: Current/Historical" | cumulative | Ignore - cumulative doesn't use sections |
| "Track mood changes over time" | any | Keep - this is intent, not formatting |
| "Always include timestamps" | decay | Merge - aligns with strategy |
| "Summarize everything in one paragraph" | decay | Ignore - conflicts with section structure |

**Example (spec lines 648-691):** User writes "Structure as bullet points" with decay strategy → ignored because decay requires section structure.

- [ ] Complete

---

### Phase 4: Understanding Strategies

**Why:** Different use cases need different memory management approaches.

**Reference:** Spec lines 72-87 (Understanding management strategies)

| Strategy | Size | Behavior |
|----------|------|----------|
| `continuous` | Unbounded | Single understanding, refined on each update (default) |
| `cumulative` | Fixed | When limit reached → summarize → new understanding seeded with summary |
| `decay` | Unbounded | Sections (recent/medium/old), older sections compressed progressively |

**Strategy selection guide (spec lines 349-353):**

| Use case | Recommended strategy |
|----------|---------------------|
| Short-lived subjects (single session) | `continuous` |
| Long-running with bounded cost | `cumulative` |
| Time-sensitive understanding (recency matters) | `decay` |

---

#### 4.0 `continuous` strategy

**Status:** Already implemented (current v0)

**Behavior:** Single understanding blob that grows and refines over time. No structural constraints.

- [x] Complete

---

#### 4.1 Implement `cumulative` strategy

**What:** Bounded understanding with summarization cycles.

**Behavior (spec lines 84):**
- Understanding has a max size (tokens)
- When reached, the entire understanding is summarized
- New understanding starts with that summary as seed
- Bounded cost, but information degrades over many cycles

**Config:**
```typescript
maintenance: {
  strategy: "cumulative",
  maxTokens: 2000  // trigger summarization when exceeded
}
```

**Implementation needs:**
- Token counting for current understanding
- Summarization step when limit exceeded
- Seeding new understanding with summary

- [ ] Complete

---

#### 4.2 Implement `decay` strategy

**What:** Structured understanding with temporal sections.

**Behavior (spec lines 86, 579-587):**
- Understanding structured into sections: Current State, Recent Developments, Historical Context
- Recent data stays detailed
- Older sections get progressively compressed
- Natural decay without sharp cutoffs

**Config:**
```typescript
maintenance: {
  strategy: "decay",
  layers: ["recent", "medium", "old"]  // optional, has defaults
}
```

**Implementation needs:**
- Structured understanding format with sections
- Logic to promote recent → historical
- Compression of older sections on each update

- [ ] Complete

---

## Completed Design Discussions

- [x] **Proactivity** - Resolved: part of instructions, events emit on update, app decides what to surface
- [x] **Subscriptions** - Resolved: collapsed into instructions ("Watch for" section), no separate mechanism
- [x] **Temporal awareness** - Resolved: handled by strategy-specific prompts + intelligent prompt generation (see spec: Agent Prompt Generation)
