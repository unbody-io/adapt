# Brain MVP - Stage 1 Specification

**Scope:** Brain creation with prompt parsing, learner generation, injection, and query synthesis.

---

## Overview

Stage 1 delivers the core Brain value:
1. User provides natural language prompt
2. Brain auto-generates learners with full configurations
3. Data injection routes to all learners
4. Queries consult all learners and synthesize responses

---

## Brain Creation

```typescript
const brain = new Brain({
  prompt: `
    Track my coding patterns and learning interests.

    I'll be feeding you my conversations with AI coding assistants,
    code commits, and notes from technical articles I read.

    I want to understand my coding philosophy, style preferences,
    and what topics I'm actively learning.
  `,
  model: openai('gpt-4o')
})
```

### Brain Structure

```typescript
Brain {
  prompt: string           // user's original prompt, stored verbatim
  model: LanguageModel     // AI SDK model, shared by all learners
  learners: TextLearner[]  // auto-generated from prompt
}
```

---

## Prompt Parsing

Brain parses the user prompt to generate learner configurations. This is an LLM call guided by the **Learner Creation Playbook**.

### Output

```typescript
interface ParsedPrompt {
  learners: LearnerConfig[]
}

interface LearnerConfig {
  id: string
  name: string
  instructions: string      // full structured instructions
  type: "text"              // MVP: TextLearner only
  maintenance?: {
    strategy: "continuous" | "cumulative" | "decay"
  }
}
```

### Learner Instructions Format

Each learner receives complete, structured instructions:

```
[Core understanding directive]

Watch for:
- [Specific condition 1]
- [Specific condition 2]

Track answers to:
- [Question 1]
- [Question 2]
```

---

## Learner Creation Playbook

This playbook guides the LLM when decomposing a user prompt into learners.

### Principle 1: Understand Before Decomposing

Before creating learners, analyze:
- **What is being tracked?** Patterns, preferences, behaviors, states, relationships
- **What questions will be asked?** Prediction, explanation, comparison, recommendation
- **What data will flow in?** Events, documents, conversations, observations
- **What's the time horizon?** Session, days, months, ongoing

### Principle 2: Find Orthogonal Dimensions

Decompose the domain into **independent dimensions** — aspects that:
- Can evolve at different rates
- Answer fundamentally different question types
- Can be reasoned about without reference to each other

**Test for orthogonality:** "If dimension A changes significantly, does B necessarily change?" If no, they are orthogonal and may warrant separate learners.

**Test for independence:** "Can I ask a meaningful question about A without needing to know about B?" If yes, they are separable concerns.

### Principle 3: Decide Learner Count Deliberately

**Fewer learners when:**
- Domain is simple or highly interconnected
- Questions tend to be broad, crossing multiple aspects
- Token budget is a concern
- Dimensions don't evolve independently

**More learners when:**
- Domain has clearly separable aspects
- Questions are often specific to one aspect
- Different aspects require different depth
- Aspects evolve at very different rates

**Heuristic:** Start with the minimum number that provides meaningful separation. One well-scoped learner is better than three overlapping ones.

### Principle 4: Generic vs Specialist Trade-off

**Generic learner:** Broad coverage, sees cross-cutting patterns, answers "big picture" questions. Risk: may lack depth.

**Specialist learners:** Deep focus on specific aspect, answers detailed questions within scope. Risk: may miss connections.

**Decision logic:**
- If all expected questions are broad → single generic may suffice
- If questions span broad and specific → consider generic + specialists
- If questions are always aspect-specific → specialists without generic
- If aspects interact heavily → generic may capture interactions better than siloed specialists

### Principle 5: Define Clear Boundaries

Each learner must have:

**Clear scope:** What it tracks, stated positively
**Clear non-scope:** What it explicitly leaves to others
**Unique questions:** Questions that ONLY this learner should answer

**The boundary test:** For any expected question, exactly one learner should be the natural answerer. If multiple learners would answer equally well, boundaries are unclear.

**The data test:** For any data point, it should be clear which learner(s) find it relevant. If the same data updates multiple learners in the same way, consider merging them.

### Principle 6: Write Actionable Instructions

**Core directive:** One clear sentence. Verb + what to understand + specific focus.
- Good: "Understand the user's error handling preferences and patterns"
- Bad: "Track coding stuff"

**Watch conditions:** Observable, specific triggers that warrant attention.
- Good: "Explicit statements rejecting or endorsing a practice"
- Bad: "Anything important about their style"

**Questions to track:** Concrete questions the learner should be able to answer.
- Good: "Do they prefer exceptions or explicit error returns?"
- Bad: "What is their philosophy?"

### Principle 7: Validate Before Finalizing

**Coverage check:** Do the learners together cover the full intent of the user's prompt?

**Overlap check:** Is there significant redundancy where the same insight would appear in multiple learners?

**Routing clarity:** For each type of question the user might ask, is there a clear "best" learner to answer it?

**Proportionality:** Is the number of learners proportional to the complexity of the domain? Over-decomposition wastes tokens; under-decomposition loses nuance.

---

## Learner Management

### Methods

```typescript
brain.addLearner(config: LearnerConfig): TextLearner
brain.getLearners(): TextLearner[]
brain.getLearner(id: string): TextLearner | undefined
```

### Manual Learner Addition

Developers can add learners manually in addition to auto-generated ones:

```typescript
brain.addLearner({
  id: "custom-learner",
  name: "Custom Concern",
  instructions: `
    Understand [specific concern].

    Watch for:
    - [condition]

    Track answers to:
    - [question]
  `
})
```

---

## Injection

```typescript
await brain.inject(data: any | any[]): Promise<InjectResult>
```

### Behavior

1. Data is sent to ALL learners
2. Each learner processes independently via `learner.ingest()`
3. Results are aggregated

### Return Type

```typescript
interface InjectResult {
  results: Array<{
    learnerId: string
    relevance: number
  }>
}
```

---

## Query

```typescript
await brain.ask(query: string): Promise<AskResult>
```

### Behavior

1. Query is sent to ALL learners
2. Each learner responds via `learner.ask()`
3. Responses are synthesized into unified answer via LLM call

### Return Type

```typescript
interface AskResult {
  insight: string              // synthesized answer
  sources: Array<{
    learnerId: string
    confidence: number
    insight: string            // individual learner's response
  }>
  gaps: string[]               // aggregated gaps from all learners
}
```

### Synthesis

The synthesis LLM call receives:
- The original query
- All learner responses with their confidence levels
- Brain's original prompt (for context)

It produces a unified answer that:
- Integrates insights from multiple learners
- Weighs by confidence
- Acknowledges gaps

---

## File Structure

```
src/
├── learners/
│   ├── schema.config.ts                          # Zod schema for learner config (LLM-generatable)
│   └── ...
│
├── brain/
│   ├── index.ts                                  # exports
│   ├── class.ts                                  # Brain class
│   ├── types.ts                                  # BrainConfig, InjectResult, BrainAskResult
│   ├── agent.ts                                  # Query synthesis agent
│   ├── prompts/
│   │   └── prompt.template.learner-configs.ts    # Prompt for generating learner configs (includes playbook)
│   └── schemas/
│       └── schema.learner-configs.ts             # Composed array schema for LLM output
```

---

## Development Principles

This section captures code patterns and conventions used across the codebase.

### File Naming Conventions

**Core module files:**
- `class.ts` — Main class implementation
- `types.ts` — TypeScript interfaces and type definitions
- `agent.ts` — ToolLoopAgent factory function
- `index.ts` — Public exports

**Prompt files (2 types only):**
- `prompt.template.<name>.ts` — Functions returning formatted prompt strings
  ```typescript
  export const decomposePromptTemplate = (userPrompt: string) => `...`
  ```
- `prompt.<name>.ts` — Static string exports (strategy descriptions, defaults, rules)
  ```typescript
  export const playbook = `...`
  ```

**Tool files (in `tools/<tool-name>/` subdirectory):**
- `schema.ts` — Zod schema for tool input
- `tool.ts` — Tool definition using AI SDK `tool()` helper
- `index.ts` — Re-exports

### AI SDK Patterns

**ToolLoopAgent configuration:**
```typescript
import { ToolLoopAgent, hasToolCall, stepCountIs } from 'ai'
import { z } from 'zod'

export const callOptionsSchema = z.object({
  operation: z.enum(['ingest', 'ask']),
  understanding: z.string(),
  // ... runtime inputs
})

export function createAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    callOptionsSchema,
    tools: { /* tool definitions */ },

    // Dynamic configuration per call
    prepareCall: ({ options, ...settings }) => ({
      ...settings,
      activeTools: options.operation === 'x' ? [...X_TOOLS] : [...Y_TOOLS],
      toolChoice: 'required' as const,
      instructions: buildInstructions(options),
    }),

    // Stop conditions (any match stops the loop)
    stopWhen: [
      stepCountIs(15),           // Safety limit
      hasToolCall('done'),       // Explicit completion
    ],
  })
}
```

**Done tools (no execute function):**
```typescript
export const synthesize = tool({
  description: 'Finalize the operation with results',
  inputSchema: synthesizeSchema,
  // No execute function — stops the agent loop when called
})
```

**Structured output with generateText:**
```typescript
import { generateText, Output } from 'ai'

const result = await generateText({
  model,
  prompt,
  output: Output.object({ schema: myZodSchema }),
})
const parsed = result.output // Type-safe structured output
```

**Observability with onStepFinish:**
```typescript
const result = await agent.generate({
  prompt: 'Process this data',
  options: { /* call options */ },
  onStepFinish: async ({ usage, finishReason, toolCalls }) => {
    // Track token usage, log steps, etc.
  },
})
```

### Code Organization Principles

1. **Lazy initialization** — Expensive operations (like LLM calls for setup) happen on first use, not in constructor
2. **Private without underscore** — Use `private` keyword, not `_prefix` convention
3. **Type inference over explicit types** — Let TypeScript infer where possible
4. **Fail fast** — Errors throw immediately, no silent failures
5. **Functional factories** — Create agents/tools via factory functions, not classes

### Tool Definition Pattern

```typescript
// tools/my-tool/schema.ts
import { z } from 'zod'

export const myToolSchema = z.object({
  input: z.string().describe('What this input is for'),
  options: z.object({
    flag: z.boolean().optional(),
  }).optional(),
})

export type MyToolParams = z.infer<typeof myToolSchema>

// tools/my-tool/tool.ts
import { tool } from 'ai'
import { myToolSchema } from './schema'

export const myTool = tool({
  description: 'What this tool does and when to use it',
  inputSchema: myToolSchema,
  execute: async (input) => {
    // Implementation
    return { result: 'done' }
  },
})

// tools/my-tool/index.ts
export { myTool } from './tool'
export { myToolSchema, type MyToolParams } from './schema'
```

---

## Out of Scope (Stage 1)

- Subjects (Stage 2)
- Events/observability (Stage 2)
- `brain.update()` (Phase 2)
- ListLearner, GraphLearner
- Smart routing (all learners receive all data/queries)

---

## Open Questions

1. **Learner count limits:** Should we cap the number of auto-generated learners?
2. **Validation feedback:** Should prompt parsing return warnings if boundaries seem unclear?
3. **Synthesis strategy:** How to handle conflicting learner responses?
