# Brain Prompting Bible

A comprehensive guide for all system prompts in the Brain/Learner architecture. 
This document is the source of truth for prompt design decisions.

---

## Core Philosophy

### 1. Agent Perspective, Not Architect Perspective

Every prompt is written FROM the agent's view, not ABOUT the agent.

**Wrong:**
> "A Synthesizer is the second phase of a two-phase learning system. It receives buffered observations extracted by the Observer."

**Right:**
> "You integrate observations into understanding."

Each agent is self-contained. It doesn't know:
- That other phases/agents exist
- Implementation details (buffering, pipelines)
- Why it was created

It only knows: what it does, how to do it.

---

### 2. "You..." Framing

All system prompts address the agent as "You..."

**Wrong:**
> "I track coding preferences..."

**Right:**
> "You track coding preferences..."

This is a system prompt — instructions TO the agent, not statements BY the agent.

---

### 3. Specificity Over Generality

Learners should be as specific as possible. One focused purpose per learner.

**Wrong:**
> "Track the user's behavior and preferences"

**Right:**
> "Track coding style preferences — formatting, naming conventions, patterns"

More learners with narrow focus > fewer learners with broad scope.

---

## Learner Types

### When to Use Each Type

| Type | Understanding Shape | Use When | Example |
|------|---------------------|----------|---------|
| **TextLearner** | Narrative prose | Patterns, insights, philosophy, qualitative understanding | "Understand coding philosophy" |
| **ListLearner** | Collection of items | Tracking things, accumulating facts, enumerable items | "Track pages visited" |
| **GraphLearner** | Nodes + relationships | Entities with connections, networks, relationships | "Map relationships between concepts" |

### Decision Criteria

Ask: **What shape is the understanding?**

- Will it be prose/narrative? → **TextLearner**
- Will it be a list of things? → **ListLearner**
- Will it be entities with connections? → **GraphLearner**

### TextLearner Specifics

- Understanding naturally develops structure (sections, themes)
- If truly flat with no sections → probably wrong learner type
- Encourage sections via prompt: "Organize with ## headers"
- Structure emerges from purpose — don't dictate specific sections

---

## Brain Decomposition

Brain takes broad human instruction and decomposes into focused learners.

### Principles

1. **Single responsibility** — Each learner tracks ONE specific thing
2. **No overlap** — Learners don't duplicate coverage
3. **No gaps** — Together, learners cover the full instruction
4. **Right type** — Match learner type to understanding shape

### Decomposition Prompt Must Include

1. What learner types exist and when to use each
2. Guidance to make learners specific, not broad
3. Example of good decomposition
4. Instruction to consider: "What shape is the understanding?"

### Example Decomposition

**Input:** "Track my coding patterns, philosophy, and learning interests"

**Output:**
- Coding Philosophy Tracker (TextLearner) — beliefs, principles, trade-offs
- Coding Style Tracker (TextLearner) — formatting, naming, patterns
- Learning Interests Tracker (TextLearner) — topics being explored

Not one learner doing all three.

---

## Two-Phase Learning

Learning consists of two distinct phases. Each is self-contained.

### Phase 1: Observe

**Purpose:** Extract relevant observations from data

**What it knows:**
- Its purpose and focus areas
- What data looks like
- How to assess relevance and importance

**What it does NOT know:**
- That Synthesize phase exists
- What happens to observations after
- What "understanding" is

**Output:** Plain text observations + importance score

### Phase 2: Synthesize

**Purpose:** Integrate observations into understanding

**What it knows:**
- Its purpose and focus areas
- Cognitive skills (Compare)
- Current understanding
- Incoming observations
- Significance criteria

**What it does NOT know:**
- That Observe phase exists
- Where observations came from
- Implementation details

**Output:** Updated understanding + significance + evolution

### Key Rule

No cross-references between phases. Each phase prompt is self-contained.

---

## Cognitive Skills

### What They Are

Cognitive skills are reasoning frameworks — HOW to think about information.

They are NOT output formats or classifications.

### Compare Skill

The core cognitive skill for synthesis.

**Question:** "How does this relate to what I already know?"

**Outcomes:**
| Outcome | Meaning |
|---------|---------|
| CONFIRMS | Reinforces existing belief |
| CONTRADICTS | Challenges what I thought was true |
| EXTENDS | Deepens something I partially knew |
| NEW | Relevant but I didn't know it |
| IRRELEVANT | Noise, not signal |

### Where Used

- **Observe:** NOT used. Observe just extracts, doesn't compare.
- **Synthesize:** Used. Guides how to relate observations to understanding.

### Important Distinction

Cognitive skills ≠ Output schema

- Skills guide reasoning (internal process)
- Output captures results (external reporting)

A batch of data might trigger multiple outcomes (confirms X, extends Y, adds Z). Don't force single classification.

---

## Identity Generation

Each phase generates its own identity from instructions.

### Two-Level Generation

**Level 1: Brain (strategic)**
- Input: Broad human instruction
- Output: Learner configs with focused instructions
- Doesn't know how learners work internally

**Level 2: TextLearner (operational)**
- Input: Focused instructions from Brain
- Output: Observe identity + Synthesize identity
- Doesn't know why it was created

### Identity Components

**Observe Identity:**
- Purpose ("You look for...")
- Focus areas (signals to watch)
- Relevance criteria (what matters vs doesn't)
- Importance criteria (low/medium/high)

**Synthesize Identity:**
- Purpose ("You track...")
- Focus areas (aspects of understanding)
- Significance criteria (routine/notable/critical)
- Classification guidance (domain tips for Compare outcomes)

### Generation Prompt Must Include

1. Context — what is this agent, what does it do
2. What "instructions" means — developer-provided purpose
3. The fixed framework it will work with
4. Example of good identity
5. Clear output fields to generate

---

## Output Schemas

### Learn Result (Code Level)
```typescript
type LearnResult = 
  | { status: 'observed', observed: string }
  | { status: 'synthesized', newUnderstanding: string, significance: '...', evolution: string, reasoning?: string }
```

The `status` wrapper is added by code, not returned by LLM.

### Observe Output (LLM)
```typescript
{
  observations: string[]  // or plain joined string
  importance: number      // 0.0 to 1.0
}
```

### Synthesize Output (LLM)
```typescript
{
  newUnderstanding: string
  significance: 'routine' | 'notable' | 'critical'
  evolution: string      // what changed and why
  reasoning?: string     // optional, key decisions made
}
```

### Significance vs Cognitive Skills

| Concept | What It Is | Fixed or Generated |
|---------|------------|-------------------|
| Cognitive Skills (Compare) | HOW to reason | Fixed (same for all) |
| Significance Criteria | HOW IMPORTANT | Generated (domain-specific) |

---

## TextLearner Understanding Management

### The Problem

Full replacement of understanding degrades with size:
- Truncation risk
- Drift (subtle unwanted changes)
- Token cost

### The Solution

1. **Encourage sections** — Prompt: "Organize with ## headers"
2. **Structure emerges** — Learner decides what sections make sense
3. **Sectioned edits** — Only regenerate affected sections

### Why This Works

Narrative understanding naturally develops structure. If it's truly flat and huge, it's probably the wrong learner type.

### Prompt Guidance

Include in Synthesize system prompt:
> "Organize your understanding with clear sections using ## headers. 
> Structure should fit your purpose — you decide what sections make sense.
> Understanding should get clearer over time, not just longer."

---

## Prompting Patterns

### Always Include

1. **Context** — What is this agent, why does it exist (its view, not architect's)
2. **Inputs** — What it receives, what they mean
3. **Job** — What to do with inputs
4. **Output** — What to return (if using structured output, can be minimal)

### Always Exclude

1. Other phases/agents existence
2. Implementation details (buffering, pipelines)
3. Architect-level reasoning
4. Negative framing ("do NOT do X") — just say what TO do

### Use Examples

Show one concrete example of good output. Worth the tokens.

Format:
```
## Example

For instructions: "..."

- **purpose**: "You look for..."
- **focusAreas**: ...
- ...

---

Now generate for YOUR instructions:
```

---

## Checklist for New Prompts

Before finalizing any system prompt, verify:

- [ ] Written from agent's perspective, not architect's
- [ ] Uses "You..." framing
- [ ] Self-contained — no references to other phases/components
- [ ] Explains what inputs mean
- [ ] Clear on what to do
- [ ] Includes example (for generation prompts)
- [ ] No negative framing lists
- [ ] If TextLearner synthesis: encourages ## sections
- [ ] Cognitive skills only in Synthesize, not Observe
- [ ] Significance criteria is domain-specific, not generic