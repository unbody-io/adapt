# Brain

> **Status: R&D / Work in Progress**

An adaptive learning system that builds and maintains understanding from streaming data.

## What is Brain?

Brain is an experimental framework for creating AI systems that learn continuously from data streams. Instead of stateless question-answering, Brain accumulates knowledge over time, similar to how humans build understanding through repeated exposure and synthesis.

**Core capabilities:**

- 🧠 **Incremental Learning** - Processes data streams (events, documents, conversations) continuously
- 🔄 **Understanding Synthesis** - Builds structured knowledge from observations
- 💬 **Confident Responses** - Answers queries with calibrated confidence and explicit gap awareness
- 🎯 **Auto-specialization** - Generates specialized learners from natural language prompts
- 📊 **Self-governance** - Manages learner lifecycle based on relevance and activation signals

Think of it as giving an LLM persistent, evolving memory that improves over time.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [OpenRouter API key](https://openrouter.ai/) (for LLM access)

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd brain-v0

# Install dependencies
bun install

# Set up your API key
export OPENROUTER_API_KEY=your_key_here
```

### Option 1: Web UI (Recommended for exploring)

Launch the interactive web interface:

```bash
bun run server
# Open http://localhost:3000
```

The UI lets you:

- Configure Brain with natural language prompts
- Inject data (paste text, upload files, or use test datasets)
- Chat with Brain and see real-time learning
- Monitor learner states and token usage
- View live observations and synthesis events

### Option 2: Programmatic Usage

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Brain } from './src/brain'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
})

// Create Brain with natural language prompt
const brain = new Brain({
  prompt: `
    Track my coding patterns and development philosophy.
    Learn from my git commits, code reviews, and conversations.
  `,
  model: openrouter('google/gemini-2.0-flash-001')
})

// Initialize (generates specialized learners via LLM)
await brain.initialize()

// Inject data - Brain routes to relevant learners
await brain.inject([
  {
    type: 'git_commit',
    message: 'refactor: extract validation into pure functions',
    files: ['src/utils/validators.ts']
  },
  {
    type: 'code_review',
    comment: 'Too heavy. Factory functions work fine for our scale.',
    sentiment: 'reject'
  }
])

// Ask questions - queries all learners, synthesizes unified response
const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)
console.log('Confidence:', result.confidence)
console.log('Gaps:', result.gaps)
```

## Key Concepts

### Brain

The orchestration layer that:

- Auto-generates specialized learners from your prompt
- Routes data to relevant learners
- Synthesizes unified responses from multiple learner perspectives
- Manages learner lifecycle (activation, deactivation, retirement)

### Learners

Independent learning agents that:

- Have specific focus areas (e.g., "coding philosophy", "preferences", "behavioral patterns")
- Observe incoming data for relevance
- Build understanding over time through synthesis
- Answer queries from their specialized perspective
- Report confidence and knowledge gaps

### Two-Phase Learning

Brain uses a two-phase approach:

1. **Observe Phase**: Extract relevant information from raw data
   - Filters noise, focuses on purpose-specific content
   - Buffers observations until synthesis threshold

2. **Synthesize Phase**: Update understanding from buffered observations
   - Merges new insights with existing knowledge
   - Produces evolved understanding
   - Strategies: cumulative (merge), replace (rewrite), hybrid

### Cascading Configuration

Model selection flows down from Brain → Learners → Operations:

```typescript
const brain = new Brain({
  prompt: '...',
  model: fastModel,                    // Default for all operations
  config: {
    init: { model: smartModel },       // Override for initialization
    learner: {
      observe: { model: fastModel },   // Override for observations
      synthesize: { model: smartModel }, // Override for synthesis
      query: { model: smartModel }     // Override for queries
    }
  }
})
```

This lets you optimize cost vs quality:
- Use fast models for high-volume observations
- Use smart models for critical synthesis and queries

## Web UI Guide

### Starting the Server

```bash
bun run server
# Server starts at http://localhost:3000
```

### Workflow

1. **Configure Brain** (left panel)
   - Write natural language prompt describing what Brain should learn
   - Select models for different operations
   - Set batch size and synthesis thresholds

2. **Initialize Brain**
   - Click "Initialize Brain" button
   - Brain uses LLM to generate specialized learners from your prompt
   - View auto-generated learners in right panel

3. **Inject Data** (center panel, top)
   - Paste raw text data
   - Or load sample datasets (developer-memory, crisis-hostage, etc.)
   - Click "Inject Data"
   - Watch real-time observation and synthesis events in the feed

4. **Chat with Brain** (center panel, bottom)
   - Type questions in the chat input
   - Brain queries all learners and synthesizes a unified response
   - Responses include confidence scores and identified knowledge gaps

5. **Monitor State** (right panel)
   - View learner activation levels and governance status
   - See current understanding for each learner
   - Track token usage by model and learner

## Running Evaluations

Brain includes comprehensive eval suites for testing different scenarios:

```bash
# Run full Brain evaluation (init + inject + query)
bun run evals/brain.eval.ts

# Run two-phase learning eval with test datasets
bun run evals/two-phase.eval.ts developer-memory
bun run evals/two-phase.eval.ts crisis-hostage

# Use npm scripts
bun run eval:developer
bun run eval:crisis

# Override model
MODEL="anthropic/claude-opus-4.5" bun run evals/brain.eval.ts
```

Eval reports are saved to `evals/reports/` with detailed metrics on confidence, relevance, and token usage.

## Architecture

Brain uses a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                         Brain                           │
│  (Orchestration, learner generation, synthesis)         │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │Learner 1│     │Learner 2│ ... │Learner N│
    │ (Text)  │     │ (Text)  │     │ (Text)  │
    └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │
         │ Observe → Buffer → Synthesize │
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
                   ┌───────────┐
                   │ LLM Layer │
                   │ (ai-sdk)  │
                   └───────────┘
```

For detailed architecture diagrams, see [docs/ARCHITECTURE-DIAGRAMS.md](docs/ARCHITECTURE-DIAGRAMS.md).

### Tech Stack

- **Runtime**: Bun (Node.js-compatible)
- **LLM SDK**: Vercel AI SDK v6
- **Providers**: OpenRouter (multi-provider access)
- **Validation**: Zod schemas
- **Server**: Hono (lightweight, fast)
- **Events**: Server-Sent Events (SSE) for real-time updates

## Configuration Options

### Brain Configuration

```typescript
interface BrainConfig {
  prompt: string                  // Natural language description
  model: LanguageModel           // Default model
  config?: {
    init?: {
      model?: LanguageModel      // Model for learner generation
      blueprintBatchSize?: number // How many learners to generate
    }
    learner?: {
      model?: LanguageModel      // Default for learners
      observe?: {
        model?: LanguageModel    // Model for observations
        batchSize?: number       // Events per observe call
      }
      synthesize?: {
        model?: LanguageModel    // Model for synthesis
        minBufferSize?: number   // Min observations before synthesis
        maxBufferSize?: number   // Max before forced synthesis
        strategy?: Strategy      // 'cumulative' | 'replace' | 'hybrid'
      }
      query?: {
        model?: LanguageModel    // Model for queries
        method?: QueryMethod     // 'direct' | 'tool-based'
      }
    }
  }
}
```

### Model Selection Strategy

**For cost optimization:**
```typescript
const fastModel = openrouter('google/gemini-2.0-flash-001')
const smartModel = openrouter('anthropic/claude-opus-4.5')

const brain = new Brain({
  prompt: '...',
  model: fastModel,              // Default: fast and cheap
  config: {
    init: { model: smartModel }, // Important: learner generation
    learner: {
      synthesize: { model: smartModel }, // Important: understanding updates
      query: { model: smartModel }       // Important: user-facing responses
    }
  }
})
```

## Development

### Project Structure

```
brain-v0/
├── src/
│   ├── brain/              # Brain orchestration layer
│   │   ├── class.ts        # Brain implementation
│   │   ├── agent.ts        # Synthesis agent
│   │   └── prompts/        # System prompts
│   ├── learners/           # Learner implementations
│   │   └── text-learner/
│   │       ├── class.ts    # TextLearner
│   │       ├── learning-methods/
│   │       │   └── two-phase/  # Observe + Synthesize
│   │       └── query-methods/
│   │           ├── direct/     # Structured output query
│   │           └── tool-based/ # Tool loop query
│   ├── llm/                # LLM wrapper (JSON repair, usage tracking)
│   └── utils/              # Shared utilities
├── server/                 # Web UI
│   ├── index.ts            # Hono server
│   └── public/
│       └── index.html      # Single-page UI
├── evals/                  # Evaluation scripts
│   ├── datasets/           # Test data
│   └── reports/            # Eval results
└── docs/                   # Documentation
    ├── ARCHITECTURE-DIAGRAMS.md
    └── specs/              # Design specs
```

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/brain/class.test.ts
```

### Code Style

```bash
# Check formatting and linting
bun run lint

# Auto-fix issues
bun run lint:fix

# Format code
bun run format
```

### Building

```bash
# Compile TypeScript
bun run build

# Watch mode for development
bun run dev
```

## Use Cases

### Personal AI Assistant
Track your preferences, work patterns, and interests from conversations and activities:
```typescript
const brain = new Brain({
  prompt: `
    Learn about my interests, preferences, and behavioral patterns.
    Track what frustrates me, what excites me, and how I communicate.
  `,
  model: openrouter('google/gemini-2.0-flash-001')
})
```

### Developer Profile Tracker
Build understanding of coding philosophy from git history:
```typescript
const brain = new Brain({
  prompt: `
    Track my coding patterns, development philosophy, and technical preferences.
    Learn from git commits, code reviews, and technical reading.
  `,
  model: openrouter('anthropic/claude-sonnet-4.5')
})
```

### Domain Expert System
Accumulate specialized knowledge from documents and conversations:
```typescript
const brain = new Brain({
  prompt: `
    Build expertise in crisis negotiation techniques.
    Learn from case studies, transcripts, and expert guidance.
  `,
  model: openrouter('anthropic/claude-opus-4.5')
})
```

## Limitations & Future Work

### Current Limitations
- **Memory**: Understanding stored in-memory only (no persistence yet)
- **Scale**: Not optimized for large-scale data (100K+ events)
- **Learner types**: Only TextLearner implemented (no structured data, images, etc.)
- **Evaluation**: Limited eval datasets and metrics

### Roadmap
- [ ] Persistent storage (vector DB integration)
- [ ] Learner state serialization/deserialization
- [ ] More learner types (StructuredLearner, VisionLearner, etc.)
- [ ] Streaming injection (real-time data sources)
- [ ] Advanced governance (auto-merging, splitting learners)
- [ ] Benchmark suite (accuracy, calibration, cost)
- [ ] Multi-Brain federation (Brain networks)

## Research Background

Brain is inspired by research in:
- **Continual Learning**: Learning without catastrophic forgetting
- **Meta-learning**: Learning how to learn from task descriptions
- **Confidence Calibration**: Accurate self-assessment of knowledge
- **Modular Neural Networks**: Specialized sub-networks for different tasks

See [docs/cognitive-units.research.md](docs/cognitive-units.research.md) for detailed research notes.

## Contributing

This is an active R&D project. Contributions welcome:

1. **Try it out**: Run evals, test with your own data
2. **Report issues**: What breaks? What's confusing?
3. **Share results**: How does it perform in your use case?
4. **Propose ideas**: Architecture improvements, new features

Open an issue or PR on GitHub.

## License

MIT

---

*This is an [Unbody](https://unbody.io) research project.*
