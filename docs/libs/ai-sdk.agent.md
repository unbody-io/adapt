
# Agents

Agents are **large language models (LLMs)** that use **tools** in a **loop** to accomplish tasks.

These components work together:

- **LLMs** process input and decide the next action
- **Tools** extend capabilities beyond text generation (reading files, calling APIs, writing to databases)
- **Loop** orchestrates execution through:
  - **Context management** - Maintaining conversation history and deciding what the model sees (input) at each step
  - **Stopping conditions** - Determining when the loop (task) is complete

## ToolLoopAgent Class

The ToolLoopAgent class handles these three components. Here's an agent that uses multiple tools in a loop to accomplish a task:

```ts
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const weatherAgent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    weather: tool({
      description: 'Get the weather in a location (in Fahrenheit)',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
    convertFahrenheitToCelsius: tool({
      description: 'Convert temperature from Fahrenheit to Celsius',
      inputSchema: z.object({
        temperature: z.number().describe('Temperature in Fahrenheit'),
      }),
      execute: async ({ temperature }) => {
        const celsius = Math.round((temperature - 32) * (5 / 9));
        return { celsius };
      },
    }),
  },
  // Agent's default behavior is to stop after a maximum of 20 steps
  // stopWhen: stepCountIs(20),
});

const result = await weatherAgent.generate({
  prompt: 'What is the weather in San Francisco in celsius?',
});

console.log(result.text); // agent's final answer
console.log(result.steps); // steps taken by the agent
```

The agent automatically:

1. Calls the `weather` tool to get the temperature in Fahrenheit
2. Calls `convertFahrenheitToCelsius` to convert it
3. Generates a final text response with the result

The Agent class handles the loop, context management, and stopping conditions.

## Why Use the Agent Class?

The Agent class is the recommended approach for building agents with the AI SDK because it:

- **Reduces boilerplate** - Manages loops and message arrays
- **Improves reusability** - Define once, use throughout your application
- **Simplifies maintenance** - Single place to update agent configuration

For most use cases, start with the Agent class. Use core functions (`generateText`, `streamText`) when you need explicit control over each step for complex structured workflows.

## Structured Workflows

Agents are flexible and powerful, but non-deterministic. When you need reliable, repeatable outcomes with explicit control flow, use core functions with structured workflow patterns combining:

- Conditional statements for explicit branching
- Standard functions for reusable logic
- Error handling for robustness
- Explicit control flow for predictability

[Explore workflow patterns](/docs/agents/workflows) to learn more about building structured, reliable systems.

## Next Steps

- **[Building Agents](/docs/agents/building-agents)** - Guide to creating agents with the Agent class
- **[Workflow Patterns](/docs/agents/workflows)** - Structured patterns using core functions for complex workflows
- **[Loop Control](/docs/agents/loop-control)** - Execution control with stopWhen and prepareStep


# Building Agents

The Agent class provides a structured way to encapsulate LLM configuration, tools, and behavior into reusable components. It handles the agent loop for you, allowing the LLM to call tools multiple times in sequence to accomplish complex tasks. Define agents once and use them across your application.

## Why Use the ToolLoopAgent Class?

When building AI applications, you often need to:

- **Reuse configurations** - Same model settings, tools, and prompts across different parts of your application
- **Maintain consistency** - Ensure the same behavior and capabilities throughout your codebase
- **Simplify API routes** - Reduce boilerplate in your endpoints
- **Type safety** - Get full TypeScript support for your agent's tools and outputs

The ToolLoopAgent class provides a single place to define your agent's behavior.

## Creating an Agent

Define an agent by instantiating the ToolLoopAgent class with your desired configuration:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const myAgent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: 'You are a helpful assistant.',
  tools: {
    // Your tools here
  },
});
```

## Configuration Options

The Agent class accepts all the same settings as `generateText` and `streamText`. Configure:

### Model and System Instructions

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: 'You are an expert software engineer.',
});
```

### Tools

Provide tools that the agent can use to accomplish tasks:

```ts
import { ToolLoopAgent, tool } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const codeAgent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    runCode: tool({
      description: 'Execute Python code',
      inputSchema: z.object({
        code: z.string(),
      }),
      execute: async ({ code }) => {
        // Execute code and return result
        return { output: 'Code executed successfully' };
      },
    }),
  },
});
```

### Loop Control

By default, agents run for 20 steps (`stopWhen: stepCountIs(20)`). In each step, the model either generates text or calls a tool. If it generates text, the agent completes. If it calls a tool, the AI SDK executes that tool.

To let agents call multiple tools in sequence, configure `stopWhen` to allow more steps. After each tool execution, the agent triggers a new generation where the model can call another tool or generate text:

```ts
import { ToolLoopAgent, stepCountIs } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  stopWhen: stepCountIs(20), // Allow up to 20 steps
});
```

Each step represents one generation (which results in either text or a tool call). The loop continues until:

- A finish reasoning other than tool-calls is returned, or
- A tool that is invoked does not have an execute function, or
- A tool call needs approval, or
- A stop condition is met

You can combine multiple conditions:

```ts
import { ToolLoopAgent, stepCountIs } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  stopWhen: [
    stepCountIs(20), // Maximum 20 steps
    yourCustomCondition(), // Custom logic for when to stop
  ],
});
```

Learn more about [loop control and stop conditions](/docs/agents/loop-control).

### Tool Choice

Control how the agent uses tools:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools here
  },
  toolChoice: 'required', // Force tool use
  // or toolChoice: 'none' to disable tools
  // or toolChoice: 'auto' (default) to let the model decide
});
```

You can also force the use of a specific tool:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    weather: weatherTool,
    cityAttractions: attractionsTool,
  },
  toolChoice: {
    type: 'tool',
    toolName: 'weather', // Force the weather tool to be used
  },
});
```

### Structured Output

Define structured output schemas:

```ts
import { ToolLoopAgent, Output, stepCountIs } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const analysisAgent = new ToolLoopAgent({
  model: __MODEL__,
  output: Output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  }),
  stopWhen: stepCountIs(10),
});

const { output } = await analysisAgent.generate({
  prompt: 'Analyze customer feedback from the last quarter',
});
```

## Define Agent Behavior with System Instructions

System instructions define your agent's behavior, personality, and constraints. They set the context for all interactions and guide how the agent responds to user queries and uses tools.

### Basic System Instructions

Set the agent's role and expertise:

```ts
const agent = new ToolLoopAgent({
  model: __MODEL__,
  instructions:
    'You are an expert data analyst. You provide clear insights from complex data.',
});
```

### Detailed Behavioral Instructions

Provide specific guidelines for agent behavior:

```ts
const codeReviewAgent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: `You are a senior software engineer conducting code reviews.

  Your approach:
  - Focus on security vulnerabilities first
  - Identify performance bottlenecks
  - Suggest improvements for readability and maintainability
  - Be constructive and educational in your feedback
  - Always explain why something is an issue and how to fix it`,
});
```

### Constrain Agent Behavior

Set boundaries and ensure consistent behavior:

```ts
const customerSupportAgent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: `You are a customer support specialist for an e-commerce platform.

  Rules:
  - Never make promises about refunds without checking the policy
  - Always be empathetic and professional
  - If you don't know something, say so and offer to escalate
  - Keep responses concise and actionable
  - Never share internal company information`,
  tools: {
    checkOrderStatus,
    lookupPolicy,
    createTicket,
  },
});
```

### Tool Usage Instructions

Guide how the agent should use available tools:

```ts
const researchAgent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: `You are a research assistant with access to search and document tools.

  When researching:
  1. Always start with a broad search to understand the topic
  2. Use document analysis for detailed information
  3. Cross-reference multiple sources before drawing conclusions
  4. Cite your sources when presenting information
  5. If information conflicts, present both viewpoints`,
  tools: {
    webSearch,
    analyzeDocument,
    extractQuotes,
  },
});
```

### Format and Style Instructions

Control the output format and communication style:

```ts
const technicalWriterAgent = new ToolLoopAgent({
  model: __MODEL__,
  instructions: `You are a technical documentation writer.

  Writing style:
  - Use clear, simple language
  - Avoid jargon unless necessary
  - Structure information with headers and bullet points
  - Include code examples where relevant
  - Write in second person ("you" instead of "the user")

  Always format responses in Markdown.`,
});
```

## Using an Agent

Once defined, you can use your agent in three ways:

### Generate Text

Use `generate()` for one-time text generation:

```ts
const result = await myAgent.generate({
  prompt: 'What is the weather like?',
});

console.log(result.text);
```

### Stream Text

Use `stream()` for streaming responses:

```ts
const result = await myAgent.stream({
  prompt: 'Tell me a story',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Respond to UI Messages

Use `createAgentUIStreamResponse()` to create API responses for client applications:

```ts
// In your API route (e.g., app/api/chat/route.ts)
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    uiMessages: messages,
  });
}
```

### Track Step Progress

Use `onStepFinish` to track each step's progress, including token usage:

```ts
const result = await myAgent.generate({
  prompt: 'Research and summarize the latest AI trends',
  onStepFinish: async ({ usage, finishReason, toolCalls }) => {
    console.log('Step completed:', {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      finishReason,
      toolsUsed: toolCalls?.map(tc => tc.toolName),
    });
  },
});
```

You can also define `onStepFinish` in the constructor for agent-wide tracking. When both constructor and method callbacks are provided, both are called (constructor first, then the method callback):

```ts
const agent = new ToolLoopAgent({
  model: __MODEL__,
  onStepFinish: async ({ usage }) => {
    // Agent-wide logging
    console.log('Agent step:', usage.totalTokens);
  },
});

// Method-level callback runs after constructor callback
const result = await agent.generate({
  prompt: 'Hello',
  onStepFinish: async ({ usage }) => {
    // Per-call tracking (e.g., for billing)
    await trackUsage(usage);
  },
});
```

## End-to-end Type Safety

You can infer types for your agent's `UIMessage`s:

```ts
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';

const myAgent = new ToolLoopAgent({
  // ... configuration
});

// Infer the UIMessage type for UI components or persistence
export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>;
```

Use this type in your client components with `useChat`:

```tsx filename="components/chat.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import type { MyAgentUIMessage } from '@/agent/my-agent';

export function Chat() {
  const { messages } = useChat<MyAgentUIMessage>();
  // Full type safety for your messages and tools
}
```

## Next Steps

Now that you understand building agents, you can:

- Explore [workflow patterns](/docs/agents/workflows) for structured patterns using core functions
- Learn about [loop control](/docs/agents/loop-control) for advanced execution control
- See [manual loop examples](/cookbook/node/manual-agent-loop) for custom workflow implementations



# Workflow Patterns

Combine the building blocks from the [overview](/docs/agents/overview) with these patterns to add structure and reliability to your agents:

- [Sequential Processing](#sequential-processing-chains) - Steps executed in order
- [Parallel Processing](#parallel-processing) - Independent tasks run simultaneously
- [Evaluation/Feedback Loops](#evaluator-optimizer) - Results checked and improved iteratively
- [Orchestration](#orchestrator-worker) - Coordinating multiple components
- [Routing](#routing) - Directing work based on context

## Choose Your Approach

Consider these key factors:

- **Flexibility vs Control** - How much freedom does the LLM need vs how tightly you must constrain its actions?
- **Error Tolerance** - What are the consequences of mistakes in your use case?
- **Cost Considerations** - More complex systems typically mean more LLM calls and higher costs
- **Maintenance** - Simpler architectures are easier to debug and modify

**Start with the simplest approach that meets your needs**. Add complexity only when required by:

1. Breaking down tasks into clear steps
2. Adding tools for specific capabilities
3. Implementing feedback loops for quality control
4. Introducing multiple agents for complex workflows

Let's look at examples of these patterns in action.

## Patterns with Examples

These patterns, adapted from [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents), serve as building blocks you can combine to create comprehensive workflows. Each pattern addresses specific aspects of task execution. Combine them thoughtfully to build reliable solutions for complex problems.

## Sequential Processing (Chains)

The simplest workflow pattern executes steps in a predefined order. Each step's output becomes input for the next step, creating a clear chain of operations. Use this pattern for tasks with well-defined sequences, like content generation pipelines or data transformation processes.

```ts
import { generateText, generateObject } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

async function generateMarketingCopy(input: string) {
  const model = __MODEL__;

  // First step: Generate marketing copy
  const { text: copy } = await generateText({
    model,
    prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
  });

  // Perform quality check on copy
  const { object: qualityMetrics } = await generateObject({
    model,
    schema: z.object({
      hasCallToAction: z.boolean(),
      emotionalAppeal: z.number().min(1).max(10),
      clarity: z.number().min(1).max(10),
    }),
    prompt: `Evaluate this marketing copy for:
    1. Presence of call to action (true/false)
    2. Emotional appeal (1-10)
    3. Clarity (1-10)

    Copy to evaluate: ${copy}`,
  });

  // If quality check fails, regenerate with more specific instructions
  if (
    !qualityMetrics.hasCallToAction ||
    qualityMetrics.emotionalAppeal < 7 ||
    qualityMetrics.clarity < 7
  ) {
    const { text: improvedCopy } = await generateText({
      model,
      prompt: `Rewrite this marketing copy with:
      ${!qualityMetrics.hasCallToAction ? '- A clear call to action' : ''}
      ${qualityMetrics.emotionalAppeal < 7 ? '- Stronger emotional appeal' : ''}
      ${qualityMetrics.clarity < 7 ? '- Improved clarity and directness' : ''}

      Original copy: ${copy}`,
    });
    return { copy: improvedCopy, qualityMetrics };
  }

  return { copy, qualityMetrics };
}
```

## Routing

This pattern lets the model decide which path to take through a workflow based on context and intermediate results. The model acts as an intelligent router, directing the flow of execution between different branches of your workflow. Use this when handling varied inputs that require different processing approaches. In the example below, the first LLM call's results determine the second call's model size and system prompt.

```ts
import { generateObject, generateText } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

async function handleCustomerQuery(query: string) {
  const model = __MODEL__;

  // First step: Classify the query type
  const { object: classification } = await generateObject({
    model,
    schema: z.object({
      reasoning: z.string(),
      type: z.enum(['general', 'refund', 'technical']),
      complexity: z.enum(['simple', 'complex']),
    }),
    prompt: `Classify this customer query:
    ${query}

    Determine:
    1. Query type (general, refund, or technical)
    2. Complexity (simple or complex)
    3. Brief reasoning for classification`,
  });

  // Route based on classification
  // Set model and system prompt based on query type and complexity
  const { text: response } = await generateText({
    model:
      classification.complexity === 'simple'
        ? 'openai/gpt-4o-mini'
        : 'openai/o4-mini',
    system: {
      general:
        'You are an expert customer service agent handling general inquiries.',
      refund:
        'You are a customer service agent specializing in refund requests. Follow company policy and collect necessary information.',
      technical:
        'You are a technical support specialist with deep product knowledge. Focus on clear step-by-step troubleshooting.',
    }[classification.type],
    prompt: query,
  });

  return { response, classification };
}
```

## Parallel Processing

Break down tasks into independent subtasks that execute simultaneously. This pattern uses parallel execution to improve efficiency while maintaining the benefits of structured workflows. For example, analyze multiple documents or process different aspects of a single input concurrently (like code review).

```ts
import { generateText, generateObject } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

// Example: Parallel code review with multiple specialized reviewers
async function parallelCodeReview(code: string) {
  const model = __MODEL__;

  // Run parallel reviews
  const [securityReview, performanceReview, maintainabilityReview] =
    await Promise.all([
      generateObject({
        model,
        system:
          'You are an expert in code security. Focus on identifying security vulnerabilities, injection risks, and authentication issues.',
        schema: z.object({
          vulnerabilities: z.array(z.string()),
          riskLevel: z.enum(['low', 'medium', 'high']),
          suggestions: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),

      generateObject({
        model,
        system:
          'You are an expert in code performance. Focus on identifying performance bottlenecks, memory leaks, and optimization opportunities.',
        schema: z.object({
          issues: z.array(z.string()),
          impact: z.enum(['low', 'medium', 'high']),
          optimizations: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),

      generateObject({
        model,
        system:
          'You are an expert in code quality. Focus on code structure, readability, and adherence to best practices.',
        schema: z.object({
          concerns: z.array(z.string()),
          qualityScore: z.number().min(1).max(10),
          recommendations: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),
    ]);

  const reviews = [
    { ...securityReview.object, type: 'security' },
    { ...performanceReview.object, type: 'performance' },
    { ...maintainabilityReview.object, type: 'maintainability' },
  ];

  // Aggregate results using another model instance
  const { text: summary } = await generateText({
    model,
    system: 'You are a technical lead summarizing multiple code reviews.',
    prompt: `Synthesize these code review results into a concise summary with key actions:
    ${JSON.stringify(reviews, null, 2)}`,
  });

  return { reviews, summary };
}
```

## Orchestrator-Worker

A primary model (orchestrator) coordinates the execution of specialized workers. Each worker optimizes for a specific subtask, while the orchestrator maintains overall context and ensures coherent results. This pattern excels at complex tasks requiring different types of expertise or processing.

```ts
import { generateObject } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

async function implementFeature(featureRequest: string) {
  // Orchestrator: Plan the implementation
  const { object: implementationPlan } = await generateObject({
    model: __MODEL__,
    schema: z.object({
      files: z.array(
        z.object({
          purpose: z.string(),
          filePath: z.string(),
          changeType: z.enum(['create', 'modify', 'delete']),
        }),
      ),
      estimatedComplexity: z.enum(['low', 'medium', 'high']),
    }),
    system:
      'You are a senior software architect planning feature implementations.',
    prompt: `Analyze this feature request and create an implementation plan:
    ${featureRequest}`,
  });

  // Workers: Execute the planned changes
  const fileChanges = await Promise.all(
    implementationPlan.files.map(async file => {
      // Each worker is specialized for the type of change
      const workerSystemPrompt = {
        create:
          'You are an expert at implementing new files following best practices and project patterns.',
        modify:
          'You are an expert at modifying existing code while maintaining consistency and avoiding regressions.',
        delete:
          'You are an expert at safely removing code while ensuring no breaking changes.',
      }[file.changeType];

      const { object: change } = await generateObject({
        model: __MODEL__,
        schema: z.object({
          explanation: z.string(),
          code: z.string(),
        }),
        system: workerSystemPrompt,
        prompt: `Implement the changes for ${file.filePath} to support:
        ${file.purpose}

        Consider the overall feature context:
        ${featureRequest}`,
      });

      return {
        file,
        implementation: change,
      };
    }),
  );

  return {
    plan: implementationPlan,
    changes: fileChanges,
  };
}
```

## Evaluator-Optimizer

Add quality control to workflows with dedicated evaluation steps that assess intermediate results. Based on the evaluation, the workflow proceeds, retries with adjusted parameters, or takes corrective action. This creates robust workflows capable of self-improvement and error recovery.

```ts
import { generateText, generateObject } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

async function translateWithFeedback(text: string, targetLanguage: string) {
  let currentTranslation = '';
  let iterations = 0;
  const MAX_ITERATIONS = 3;

  // Initial translation
  const { text: translation } = await generateText({
    model: __MODEL__,
    system: 'You are an expert literary translator.',
    prompt: `Translate this text to ${targetLanguage}, preserving tone and cultural nuances:
    ${text}`,
  });

  currentTranslation = translation;

  // Evaluation-optimization loop
  while (iterations < MAX_ITERATIONS) {
    // Evaluate current translation
    const { object: evaluation } = await generateObject({
      model: __MODEL__,
      schema: z.object({
        qualityScore: z.number().min(1).max(10),
        preservesTone: z.boolean(),
        preservesNuance: z.boolean(),
        culturallyAccurate: z.boolean(),
        specificIssues: z.array(z.string()),
        improvementSuggestions: z.array(z.string()),
      }),
      system: 'You are an expert in evaluating literary translations.',
      prompt: `Evaluate this translation:

      Original: ${text}
      Translation: ${currentTranslation}

      Consider:
      1. Overall quality
      2. Preservation of tone
      3. Preservation of nuance
      4. Cultural accuracy`,
    });

    // Check if quality meets threshold
    if (
      evaluation.qualityScore >= 8 &&
      evaluation.preservesTone &&
      evaluation.preservesNuance &&
      evaluation.culturallyAccurate
    ) {
      break;
    }

    // Generate improved translation based on feedback
    const { text: improvedTranslation } = await generateText({
      model: __MODEL__,
      system: 'You are an expert literary translator.',
      prompt: `Improve this translation based on the following feedback:
      ${evaluation.specificIssues.join('\n')}
      ${evaluation.improvementSuggestions.join('\n')}

      Original: ${text}
      Current Translation: ${currentTranslation}`,
    });

    currentTranslation = improvedTranslation;
    iterations++;
  }

  return {
    finalTranslation: currentTranslation,
    iterationsRequired: iterations,
  };
}
```


# Loop Control

You can control both the execution flow and the settings at each step of the agent loop. The loop continues until:

- A finish reasoning other than tool-calls is returned, or
- A tool that is invoked does not have an execute function, or
- A tool call needs approval, or
- A stop condition is met

The AI SDK provides built-in loop control through two parameters: `stopWhen` for defining stopping conditions and `prepareStep` for modifying settings (model, tools, messages, and more) between steps.

## Stop Conditions

The `stopWhen` parameter controls when to stop execution when there are tool results in the last step. By default, agents stop after 20 steps using `stepCountIs(20)`.

When you provide `stopWhen`, the agent continues executing after tool calls until a stopping condition is met. When the condition is an array, execution stops when any of the conditions are met.

### Use Built-in Conditions

The AI SDK provides several built-in stopping conditions:

```ts
import { ToolLoopAgent, stepCountIs } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools
  },
  stopWhen: stepCountIs(20), // Default state: stop after 20 steps maximum
});

const result = await agent.generate({
  prompt: 'Analyze this dataset and create a summary report',
});
```

### Combine Multiple Conditions

Combine multiple stopping conditions. The loop stops when it meets any condition:

```ts
import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools
  },
  stopWhen: [
    stepCountIs(20), // Maximum 20 steps
    hasToolCall('someTool'), // Stop after calling 'someTool'
  ],
});

const result = await agent.generate({
  prompt: 'Research and analyze the topic',
});
```

### Create Custom Conditions

Build custom stopping conditions for specific requirements:

```ts
import { ToolLoopAgent, StopCondition, ToolSet } from 'ai';
__PROVIDER_IMPORT__;

const tools = {
  // your tools
} satisfies ToolSet;

const hasAnswer: StopCondition<typeof tools> = ({ steps }) => {
  // Stop when the model generates text containing "ANSWER:"
  return steps.some(step => step.text?.includes('ANSWER:')) ?? false;
};

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools,
  stopWhen: hasAnswer,
});

const result = await agent.generate({
  prompt: 'Find the answer and respond with "ANSWER: [your answer]"',
});
```

Custom conditions receive step information across all steps:

```ts
const budgetExceeded: StopCondition<typeof tools> = ({ steps }) => {
  const totalUsage = steps.reduce(
    (acc, step) => ({
      inputTokens: acc.inputTokens + (step.usage?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (step.usage?.outputTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0 },
  );

  const costEstimate =
    (totalUsage.inputTokens * 0.01 + totalUsage.outputTokens * 0.03) / 1000;
  return costEstimate > 0.5; // Stop if cost exceeds $0.50
};
```

## Prepare Step

The `prepareStep` callback runs before each step in the loop and defaults to the initial settings if you don't return any changes. Use it to modify settings, manage context, or implement dynamic behavior based on execution history.

### Dynamic Model Selection

Switch models based on step requirements:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: 'openai/gpt-4o-mini', // Default model
  tools: {
    // your tools
  },
  prepareStep: async ({ stepNumber, messages }) => {
    // Use a stronger model for complex reasoning after initial steps
    if (stepNumber > 2 && messages.length > 10) {
      return {
        model: __MODEL__,
      };
    }
    // Continue with default settings
    return {};
  },
});

const result = await agent.generate({
  prompt: '...',
});
```

### Context Management

Manage growing conversation history in long-running loops:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools
  },
  prepareStep: async ({ messages }) => {
    // Keep only recent messages to stay within context limits
    if (messages.length > 20) {
      return {
        messages: [
          messages[0], // Keep system instructions
          ...messages.slice(-10), // Keep last 10 messages
        ],
      };
    }
    return {};
  },
});

const result = await agent.generate({
  prompt: '...',
});
```

### Tool Selection

Control which tools are available at each step:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    summarize: summarizeTool,
  },
  prepareStep: async ({ stepNumber, steps }) => {
    // Search phase (steps 0-2)
    if (stepNumber <= 2) {
      return {
        activeTools: ['search'],
        toolChoice: 'required',
      };
    }

    // Analysis phase (steps 3-5)
    if (stepNumber <= 5) {
      return {
        activeTools: ['analyze'],
      };
    }

    // Summary phase (step 6+)
    return {
      activeTools: ['summarize'],
      toolChoice: 'required',
    };
  },
});

const result = await agent.generate({
  prompt: '...',
});
```

You can also force a specific tool to be used:

```ts
prepareStep: async ({ stepNumber }) => {
  if (stepNumber === 0) {
    // Force the search tool to be used first
    return {
      toolChoice: { type: 'tool', toolName: 'search' },
    };
  }

  if (stepNumber === 5) {
    // Force the summarize tool after analysis
    return {
      toolChoice: { type: 'tool', toolName: 'summarize' },
    };
  }

  return {};
};
```

### Message Modification

Transform messages before sending them to the model:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools
  },
  prepareStep: async ({ messages, stepNumber }) => {
    // Summarize tool results to reduce token usage
    const processedMessages = messages.map(msg => {
      if (msg.role === 'tool' && msg.content.length > 1000) {
        return {
          ...msg,
          content: summarizeToolResult(msg.content),
        };
      }
      return msg;
    });

    return { messages: processedMessages };
  },
});

const result = await agent.generate({
  prompt: '...',
});
```

## Access Step Information

Both `stopWhen` and `prepareStep` receive detailed information about the current execution:

```ts
prepareStep: async ({
  model, // Current model configuration
  stepNumber, // Current step number (0-indexed)
  steps, // All previous steps with their results
  messages, // Messages to be sent to the model
}) => {
  // Access previous tool calls and results
  const previousToolCalls = steps.flatMap(step => step.toolCalls);
  const previousResults = steps.flatMap(step => step.toolResults);

  // Make decisions based on execution history
  if (previousToolCalls.some(call => call.toolName === 'dataAnalysis')) {
    return {
      toolChoice: { type: 'tool', toolName: 'reportGenerator' },
    };
  }

  return {};
},
```

## Forced Tool Calling

You can force the agent to always use tools by combining `toolChoice: 'required'` with a `done` tool that has no `execute` function. This pattern ensures the agent uses tools for every step and stops only when it explicitly signals completion.

```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    done: tool({
      description: 'Signal that you have finished your work',
      inputSchema: z.object({
        answer: z.string().describe('The final answer'),
      }),
      // No execute function - stops the agent when called
    }),
  },
  toolChoice: 'required', // Force tool calls at every step
});

const result = await agent.generate({
  prompt: 'Research and analyze this topic, then provide your answer.',
});

// extract answer from done tool call
const toolCall = result.staticToolCalls[0]; // tool call from final step
if (toolCall?.toolName === 'done') {
  console.log(toolCall.input.answer);
}
```

Key aspects of this pattern:

- **`toolChoice: 'required'`**: Forces the model to call a tool at every step instead of generating text directly. This ensures the agent follows a structured workflow.
- **`done` tool without `execute`**: A tool that has no `execute` function acts as a termination signal. When the agent calls this tool, the loop stops because there's no function to execute.
- **Accessing results**: The final answer is available in `result.staticToolCalls`, which contains tool calls that weren't executed.

This pattern is useful when you want the agent to always use specific tools for operations (like code execution or data retrieval) rather than attempting to answer directly.

## Manual Loop Control

For scenarios requiring complete control over the agent loop, you can use AI SDK Core functions (`generateText` and `streamText`) to implement your own loop management instead of using `stopWhen` and `prepareStep`. This approach provides maximum flexibility for complex workflows.

### Implementing a Manual Loop

Build your own agent loop when you need full control over execution:

```ts
import { generateText, ModelMessage } from 'ai';
__PROVIDER_IMPORT__;

const messages: ModelMessage[] = [{ role: 'user', content: '...' }];

let step = 0;
const maxSteps = 10;

while (step < maxSteps) {
  const result = await generateText({
    model: __MODEL__,
    messages,
    tools: {
      // your tools here
    },
  });

  messages.push(...result.response.messages);

  if (result.text) {
    break; // Stop when model generates text
  }

  step++;
}
```

This manual approach gives you complete control over:

- Message history management
- Step-by-step decision making
- Custom stopping conditions
- Dynamic tool and model selection
- Error handling and recovery

[Learn more about manual agent loops in the cookbook](/cookbook/node/manual-agent-loop).


# Configuring Call Options

Call options allow you to pass type-safe structured inputs to your agent. Use them to dynamically modify any agent setting based on the specific request.

## Why Use Call Options?

When you need agent behavior to change based on runtime context:

- **Add dynamic context** - Inject retrieved documents, user preferences, or session data into prompts
- **Select models dynamically** - Choose faster or more capable models based on request complexity
- **Configure tools per request** - Pass user location to search tools or adjust tool behavior
- **Customize provider options** - Set reasoning effort, temperature, or other provider-specific settings

Without call options, you'd need to create multiple agents or handle configuration logic outside the agent.

## How It Works

Define call options in three steps:

1. **Define the schema** - Specify what inputs you accept using `callOptionsSchema`
2. **Configure with `prepareCall`** - Use those inputs to modify agent settings
3. **Pass options at runtime** - Provide the options when calling `generate()` or `stream()`

## Basic Example

Add user context to your agent's prompt at runtime:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const supportAgent = new ToolLoopAgent({
  model: __MODEL__,
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(['free', 'pro', 'enterprise']),
  }),
  instructions: 'You are a helpful customer support agent.',
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions:
      settings.instructions +
      `\nUser context:
- Account type: ${options.accountType}
- User ID: ${options.userId}

Adjust your response based on the user's account level.`,
  }),
});

// Call the agent with specific user context
const result = await supportAgent.generate({
  prompt: 'How do I upgrade my account?',
  options: {
    userId: 'user_123',
    accountType: 'free',
  },
});
```

The `options` parameter is now required and type-checked. If you don't provide it or pass incorrect types, TypeScript will error.

## Modifying Agent Settings

Use `prepareCall` to modify any agent setting. Return only the settings you want to change.

### Dynamic Model Selection

Choose models based on request characteristics:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: __MODEL__, // Default model
  callOptionsSchema: z.object({
    complexity: z.enum(['simple', 'complex']),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    model:
      options.complexity === 'simple' ? 'openai/gpt-4o-mini' : 'openai/o1-mini',
  }),
});

// Use faster model for simple queries
await agent.generate({
  prompt: 'What is 2+2?',
  options: { complexity: 'simple' },
});

// Use more capable model for complex reasoning
await agent.generate({
  prompt: 'Explain quantum entanglement',
  options: { complexity: 'complex' },
});
```

### Dynamic Tool Configuration

Configure tools based on runtime context:

```ts
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const newsAgent = new ToolLoopAgent({
  model: __MODEL__,
  callOptionsSchema: z.object({
    userCity: z.string().optional(),
    userRegion: z.string().optional(),
  }),
  tools: {
    web_search: openai.tools.webSearch(),
  },
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    tools: {
      web_search: openai.tools.webSearch({
        searchContextSize: 'low',
        userLocation: {
          type: 'approximate',
          city: options.userCity,
          region: options.userRegion,
          country: 'US',
        },
      }),
    },
  }),
});

await newsAgent.generate({
  prompt: 'What are the top local news stories?',
  options: {
    userCity: 'San Francisco',
    userRegion: 'California',
  },
});
```

### Provider-Specific Options

Configure provider settings dynamically:

```ts
import { openai, OpenAIProviderOptions } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: 'openai/o3',
  callOptionsSchema: z.object({
    taskDifficulty: z.enum(['low', 'medium', 'high']),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    providerOptions: {
      openai: {
        reasoningEffort: options.taskDifficulty,
      } satisfies OpenAIProviderOptions,
    },
  }),
});

await agent.generate({
  prompt: 'Analyze this complex scenario...',
  options: { taskDifficulty: 'high' },
});
```

## Advanced Patterns

### Retrieval Augmented Generation (RAG)

Fetch relevant context and inject it into your prompt:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const ragAgent = new ToolLoopAgent({
  model: __MODEL__,
  callOptionsSchema: z.object({
    query: z.string(),
  }),
  prepareCall: async ({ options, ...settings }) => {
    // Fetch relevant documents (this can be async)
    const documents = await vectorSearch(options.query);

    return {
      ...settings,
      instructions: `Answer questions using the following context:

${documents.map(doc => doc.content).join('\n\n')}`,
    };
  },
});

await ragAgent.generate({
  prompt: 'What is our refund policy?',
  options: { query: 'refund policy' },
});
```

The `prepareCall` function can be async, enabling you to fetch data before configuring the agent.

### Combining Multiple Modifications

Modify multiple settings together:

```ts
import { ToolLoopAgent } from 'ai';
__PROVIDER_IMPORT__;
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: __MODEL__,
  callOptionsSchema: z.object({
    userRole: z.enum(['admin', 'user']),
    urgency: z.enum(['low', 'high']),
  }),
  tools: {
    readDatabase: readDatabaseTool,
    writeDatabase: writeDatabaseTool,
  },
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    // Upgrade model for urgent requests
    model: options.urgency === 'high' ? __MODEL__ : settings.model,
    // Limit tools based on user role
    activeTools:
      options.userRole === 'admin'
        ? ['readDatabase', 'writeDatabase']
        : ['readDatabase'],
    // Adjust instructions
    instructions: `You are a ${options.userRole} assistant.
${options.userRole === 'admin' ? 'You have full database access.' : 'You have read-only access.'}`,
  }),
});

await agent.generate({
  prompt: 'Update the user record',
  options: {
    userRole: 'admin',
    urgency: 'high',
  },
});
```

## Using with createAgentUIStreamResponse

Pass call options through API routes to your agent:

```ts filename="app/api/chat/route.ts"
import { createAgentUIStreamResponse } from 'ai';
import { myAgent } from '@/ai/agents/my-agent';

export async function POST(request: Request) {
  const { messages, userId, accountType } = await request.json();

  return createAgentUIStreamResponse({
    agent: myAgent,
    messages,
    options: {
      userId,
      accountType,
    },
  });
}
```

## Next Steps

- Learn about [loop control](/docs/agents/loop-control) for execution management
- Explore [workflow patterns](/docs/agents/workflows) for complex multi-step processes