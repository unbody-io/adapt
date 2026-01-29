# Adapt

> **Status: R&D / Work in Progress**

Adaptive learning agents that build and maintain understanding from streaming data.

## What is this?

Adapt is an experimental framework for building AI agents that:
- **Learn incrementally** from data streams (events, documents, conversations)
- **Synthesize understanding** into structured knowledge
- **Answer queries** with calibrated confidence and gap awareness
- **Self-govern** based on relevance and activation signals

Think of it as giving an LLM persistent, evolving memory that improves over time.

## Current State

This is active R&D. We're exploring:
- TextLearner implementation using Vercel AI SDK tool loops
- Multi-learner architectures (generic + specialists)
- Model-specific behavior (confidence calibration, relevance scoring)
- Governance and activation signals

### What Works
- Core learning loop with tool-based synthesis
- Query handling with confidence and gap identification
- Multi-model support via OpenRouter (Gemini, Claude Haiku/Opus)

### What's Being Explored
- Batch size optimization for different models
- Relevance discrimination tuning
- Specialist vs generic learner tradeoffs

## Project Structure

```
src/
├── learners/           # Core learner implementations
│   ├── types.ts        # Interfaces and types
│   ├── text-learner.ts # TextLearner implementation
│   └── tools/          # Tool schemas
docs/
├── specs/              # Design specifications
├── research/           # Research notes
└── architecture-notes.md
evals/
├── datasets/           # Test datasets (crisis, developer, therapist)
├── reports/            # Eval results and analysis
└── run-eval.ts         # Eval runner
```

## Running Evals

```bash
# Install dependencies
bun install

# Set up OpenRouter API key
export OPENROUTER_API_KEY=your_key

# Run eval with default model (Haiku)
bun run evals/run-eval.ts developer-memory

# Run with specific model
MODEL="anthropic/claude-opus-4.5" bun run evals/run-eval.ts developer-memory

# Run with custom batch size
BATCH_SIZE=50 bun run evals/run-eval.ts developer-memory
```

## Key Findings (from evals)

| Model | Confidence Calibration | Relevance Range | Cost |
|-------|------------------------|-----------------|------|
| Gemini 3 Flash | Poor (always "low") | 0.95-0.99 | Low |
| Claude Haiku 4.5 | Good (0.45-0.98) | 0.88-0.98 | Medium |
| Claude Opus 4.5 | Excellent (0.85-0.98) | 0.60-0.95 | High |

See [evals/reports/EVAL-SUMMARY.md](evals/reports/EVAL-SUMMARY.md) for detailed analysis.

## License

MIT

---

*This is an [Unbody](https://unbody.io) research project.*
