# Learners Implementation Plan — v0

Implementation specification for TextLearner using AI SDK's ToolLoopAgent.

---

## Architecture Overview

A single `ToolLoopAgent` handles both data processing and query operations. The agent is configured dynamically per call using `callOptionsSchema` and `prepareCall`.

```
┌─────────────────────────────────────────────────────────────────┐
│ TextLearner                                                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ToolLoopAgent                                              │ │
│  │                                                            │ │
│  │  callOptionsSchema: { operation, understanding, purpose }  │ │
│  │                                                            │ │
│  │  prepareCall: configures activeTools based on operation    │ │
│  │                                                            │ │
│  │  Tools:                                                    │ │
│  │   • compareToUnderstanding                                 │ │
│  │   • detectShift                                            │ │
│  │   • detectPattern                                          │ │
│  │   • synthesize (done tool)                                 │ │
│  │   • generateResponse                                       │ │
│  │   • identifyGaps                                           │ │
│  │   • complete (done tool)                                   │ │
│  │                                                            │ │
│  │  stopWhen: hasToolCall('synthesize') | hasToolCall('complete') │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key AI SDK Features Used

### 1. callOptionsSchema + prepareCall

Dynamic configuration per call. Pass understanding, purpose, and operation type without rebuilding the agent.

```typescript
callOptionsSchema: z.object({
  operation: z.enum(['data', 'query']),
  understanding: z.string(),
  purpose: z.string(),
  input: z.unknown(), // batch for data, query string for query
})
```

### 2. Done Tool Pattern

Tools without `execute` function stop the agent and capture structured output via `result.staticToolCalls`.

- `synthesize` — captures new understanding (data operation)
- `complete` — captures query response (query operation)

### 3. hasToolCall() Stop Condition

Stop when the agent calls a specific tool:

```typescript
stopWhen: [hasToolCall('synthesize'), hasToolCall('complete')]
```

### 4. activeTools

Limit available tools per operation:

- Data operation: compareToUnderstanding, detectShift, detectPattern, synthesize
- Query operation: generateResponse, identifyGaps, complete

---

## Tool Definitions

### Data Processing Tools

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `compareToUnderstanding` | Assess how new data relates to current understanding | `{ data: unknown }` | `{ relation: 'confirms' \| 'contradicts' \| 'new', explanation: string }` |
| `detectShift` | Detect if something has fundamentally changed | `{ data: unknown }` | `{ shifted: boolean, from?: string, to?: string }` |
| `detectPattern` | Identify emerging patterns across data points | `{ data: unknown }` | `{ pattern?: string, confidence: number }` |
| `synthesize` | Update understanding with new insights (done tool) | `{ newUnderstanding: string, relevance: number }` | — (no execute) |

### Query Tools

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `generateResponse` | Generate response from understanding | `{ query: string }` | `{ response: string, confidence: number }` |
| `identifyGaps` | Identify what couldn't be answered | `{ query: string }` | `{ gaps: string[] }` |
| `complete` | Finalize query response (done tool) | `{ relevant: boolean, confidence: number, insight: string, gaps: string[] }` | — (no execute) |

---

## Implementation

### Tool Schemas

```typescript
// src/learners/tools/schemas.ts
import { z } from 'zod'

export const compareToUnderstandingParams = z.object({
  data: z.unknown(),
})

export const compareToUnderstandingResult = z.object({
  relation: z.enum(['confirms', 'contradicts', 'new']),
  explanation: z.string(),
})

export const detectShiftParams = z.object({
  data: z.unknown(),
})

export const detectShiftResult = z.object({
  shifted: z.boolean(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const detectPatternParams = z.object({
  data: z.unknown(),
})

export const detectPatternResult = z.object({
  pattern: z.string().optional(),
  confidence: z.number(),
})

export const synthesizeParams = z.object({
  newUnderstanding: z.string(),
  relevance: z.number().min(0).max(1),
})

export const generateResponseParams = z.object({
  query: z.string(),
})

export const generateResponseResult = z.object({
  response: z.string(),
  confidence: z.number(),
})

export const identifyGapsParams = z.object({
  query: z.string(),
})

export const identifyGapsResult = z.object({
  gaps: z.array(z.string()),
})

export const completeParams = z.object({
  relevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  insight: z.string(),
  gaps: z.array(z.string()),
})
```

### Agent Creation

```typescript
// src/learners/agent.ts
import { ToolLoopAgent, hasToolCall, stepCountIs } from 'ai-sdk'
import { z } from 'zod'
import * as schemas from './tools/schemas.js'

export const callOptionsSchema = z.object({
  operation: z.enum(['data', 'query']),
  understanding: z.string(),
  purpose: z.string(),
  input: z.unknown(),
})

export type CallOptions = z.infer<typeof callOptionsSchema>

const DATA_TOOLS = ['compareToUnderstanding', 'detectShift', 'detectPattern', 'synthesize'] as const
const QUERY_TOOLS = ['generateResponse', 'identifyGaps', 'complete'] as const

function buildInstructions(options: CallOptions): string {
  const base = `You are a learning agent with a fixed purpose: "${options.purpose}"

Your current understanding:
${options.understanding || '(no understanding yet)'}
`

  if (options.operation === 'data') {
    return base + `
You are processing new data. Use your tools to:
1. Compare the data against your current understanding
2. Detect if something has fundamentally shifted
3. Look for emerging patterns
4. Synthesize your updated understanding

When done, call the synthesize tool with your new understanding.`
  }

  return base + `
You are responding to a query. Use your tools to:
1. Generate a response based on your understanding
2. Identify any gaps in what you couldn't answer

When done, call the complete tool with your final response.`
}

export function createLearnerAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    callOptionsSchema,

    tools: {
      // Data tools
      compareToUnderstanding: {
        description: 'Assess how new data relates to current understanding',
        parameters: schemas.compareToUnderstandingParams,
        execute: async ({ data }) => {
          // Agent reasons about comparison, returns structured result
          return { relation: 'new', explanation: 'Placeholder' }
        },
      },
      detectShift: {
        description: 'Detect if something has fundamentally changed',
        parameters: schemas.detectShiftParams,
        execute: async ({ data }) => {
          return { shifted: false }
        },
      },
      detectPattern: {
        description: 'Identify emerging patterns across data points',
        parameters: schemas.detectPatternParams,
        execute: async ({ data }) => {
          return { pattern: undefined, confidence: 0 }
        },
      },
      synthesize: {
        description: 'Update understanding with new insights. Call this when done processing data.',
        parameters: schemas.synthesizeParams,
        // No execute — done tool
      },

      // Query tools
      generateResponse: {
        description: 'Generate response from understanding',
        parameters: schemas.generateResponseParams,
        execute: async ({ query }) => {
          return { response: 'Placeholder', confidence: 0 }
        },
      },
      identifyGaps: {
        description: 'Identify what could not be answered from current understanding',
        parameters: schemas.identifyGapsParams,
        execute: async ({ query }) => {
          return { gaps: [] }
        },
      },
      complete: {
        description: 'Finalize the query response. Call this when done responding to a query.',
        parameters: schemas.completeParams,
        // No execute — done tool
      },
    },

    prepareCall: ({ options, ...settings }) => ({
      ...settings,
      activeTools: options.operation === 'data' ? [...DATA_TOOLS] : [...QUERY_TOOLS],
      toolChoice: 'required',
      instructions: buildInstructions(options),
    }),

    stopWhen: [
      stepCountIs(5),
      hasToolCall('synthesize'),
      hasToolCall('complete'),
    ],
  })
}
```

### TextLearner Class

```typescript
// src/learners/text-learner.ts
import { createLearnerAgent, CallOptions } from './agent.js'
import type {
  Learner,
  LearnerConfig,
  LearnerGovernance,
  LearnerMetadata,
  OnDataResult,
  OnQueryResult,
  LearnerOrigin,
} from './types.js'

interface TextLearnerMaintenance {
  strategy: 'summarize' | 'truncate'
  maxTokens: number
}

export class TextLearner implements Learner<string> {
  readonly id: string
  readonly purpose: string
  readonly origin: LearnerOrigin

  private understanding: string = ''
  private governance: LearnerGovernance
  private agent: ReturnType<typeof createLearnerAgent>
  private maintenance: TextLearnerMaintenance

  constructor(
    config: LearnerConfig<TextLearnerMaintenance>,
    model: LanguageModel
  ) {
    this.id = config.id ?? crypto.randomUUID()
    this.purpose = config.purpose
    this.origin = config.origin ?? 'developer'
    this.maintenance = config.maintenance ?? { strategy: 'summarize', maxTokens: 4000 }

    this.governance = {
      activation: 0,
      threshold: 0.3,
      status: 'dormant',
      lastAccessed: new Date(),
      retrievalCount: 0,
      successRate: 0,
    }

    this.agent = createLearnerAgent(model)
  }

  getUnderstanding(): string {
    return this.understanding
  }

  getGovernance(): LearnerGovernance {
    return { ...this.governance }
  }

  async onData(batch: unknown[]): Promise<OnDataResult> {
    const result = await this.agent.run({
      operation: 'data',
      understanding: this.understanding,
      purpose: this.purpose,
      input: batch,
    })

    // Extract structured output from done tool
    const synthesizeCall = result.staticToolCalls.find(
      (call) => call.toolName === 'synthesize'
    )

    if (synthesizeCall) {
      this.understanding = synthesizeCall.args.newUnderstanding
      const relevance = synthesizeCall.args.relevance

      // Update governance
      this.updateGovernance(relevance)

      return { relevance }
    }

    return { relevance: 0 }
  }

  async onQuery(query: string): Promise<OnQueryResult> {
    this.governance.lastAccessed = new Date()
    this.governance.retrievalCount++

    const result = await this.agent.run({
      operation: 'query',
      understanding: this.understanding,
      purpose: this.purpose,
      input: query,
    })

    // Extract structured output from done tool
    const completeCall = result.staticToolCalls.find(
      (call) => call.toolName === 'complete'
    )

    if (completeCall) {
      return {
        relevant: completeCall.args.relevant,
        confidence: completeCall.args.confidence,
        insight: completeCall.args.insight,
        gaps: completeCall.args.gaps,
      }
    }

    return {
      relevant: false,
      confidence: 0,
      insight: '',
      gaps: ['Failed to process query'],
    }
  }

  getSummary(): string {
    return this.understanding || '(no understanding yet)'
  }

  getMetadata(): LearnerMetadata {
    return {
      id: this.id,
      purpose: this.purpose,
      origin: this.origin,
      governance: this.getGovernance(),
    }
  }

  private updateGovernance(relevance: number): void {
    // Simple activation update: weighted average with new relevance
    this.governance.activation = this.governance.activation * 0.8 + relevance * 0.2

    // Update status based on threshold
    if (this.governance.activation >= this.governance.threshold) {
      this.governance.status = 'active'
    }

    this.governance.lastAccessed = new Date()
  }
}
```

---

## File Structure

```
src/
├── learners/
│   ├── types.ts              # Core types (Learner, LearnerConfig, etc.)
│   ├── agent.ts              # ToolLoopAgent creation and configuration
│   ├── text-learner.ts       # TextLearner implementation
│   └── tools/
│       └── schemas.ts        # Zod schemas for tool parameters
└── index.ts                  # Public exports
```

---

## Usage Example

```typescript
import { TextLearner } from '@unbody/brain'
import { openai } from '@ai-sdk/openai'

const learner = new TextLearner(
  {
    purpose: 'Understand patterns in who gets targeted and why',
    maintenance: {
      strategy: 'summarize',
      maxTokens: 4000,
    },
  },
  openai('gpt-4o')
)

// Process data
await learner.onData([
  { text: 'Victim A was posting location updates before incident' },
  { text: 'Victim B identified captor on social media 6 hours ago' },
])

// Query understanding
const result = await learner.onQuery('Who is most at risk right now?')
console.log(result.insight)
// "Based on observed patterns, hostages who have recently posted locations
// or identified captors are at highest risk. Retaliation typically follows
// within 6 hours of social media exposure..."
```

---

## v0 Scope

| Included | Excluded |
|----------|----------|
| TextLearner | ListLearner, GraphLearner |
| Full tool set (6 tools) | Split/merge governance |
| Developer-defined learners | Emergent learners |
| Basic activation governance | Decay, deprecation |
| callOptionsSchema dynamic config | prepareStep phased tools |

---

## Open Implementation Questions

1. **Tool execute implementations**: The current tool executes are placeholders. The agent reasons about the data—the tools return structured results. Should tools be pure schema validators, or should they do pre-processing?

2. **Maintenance/compression**: When understanding exceeds maxTokens, how is compression triggered? Options:
   - After every onData call
   - When threshold exceeded
   - Background process

3. **Observability**: Should we use onStepFinish to track token usage, step count, etc.?

4. **Error handling**: What happens when agent fails to call done tool? Retry? Return error result?

---

## Next Steps

1. Implement tool schemas (`src/learners/tools/schemas.ts`)
2. Implement agent creation (`src/learners/agent.ts`)
3. Implement TextLearner class (`src/learners/text-learner.ts`)
4. Add tests validating against use cases from spec
