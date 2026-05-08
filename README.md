# Adapt

[![npm](https://img.shields.io/npm/v/@unbody-io/adapt?style=flat-square&color=blue)](https://www.npmjs.com/package/@unbody-io/adapt)
[![license](https://img.shields.io/npm/l/@unbody-io/adapt?style=flat-square)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/unbody-io/adapt?style=flat-square)](https://github.com/unbody-io/adapt)

A memory layer that learns. Instead of storing and retrieving, Adapt observes incoming data, builds understanding, and reshapes its own structure over time. It answers questions that databases and RAG pipelines can't — the ones that require paying attention as data flows in.

**[Documentation](https://adapt.unbody.io)** · **[Changelog](https://github.com/unbody-io/adapt/blob/main/CHANGELOG.md)** · **[Releases](https://github.com/unbody-io/adapt/releases)** · **[npm](https://www.npmjs.com/package/@unbody-io/adapt)** · **[Issues](https://github.com/unbody-io/adapt/issues)**

---

### Install

```bash
npm install @unbody-io/adapt
```

Adapt uses the [Vercel AI SDK](https://sdk.vercel.ai) for LLM access. Install a provider:

```bash
npm install @ai-sdk/openai    # or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

### Quick start

```typescript
import { Brain } from '@unbody-io/adapt'
import { openai } from '@ai-sdk/openai'

const brain = await Brain.create({
  prompt: 'Track my coding patterns and development philosophy.',
  model: openai('gpt-4o'),
})

await brain.inject([
  { type: 'commit', message: 'refactor: extract validation into pure functions' },
  { type: 'review', comment: 'Too heavy — factory functions work fine for our scale.' },
])

const result = await brain.ask('What is my coding philosophy?')
console.log(result.insight)
```

### Features

- **Self-evolving** — creates, merges, splits, and removes Neurons based on usage
- **Any LLM** — AI SDK by default, BYO runtime via the `AdaptLLMPlugin` contract
- **Pluggable stores** — in-memory or SQLite
- **Modular** — use the `Brain` orchestrator or `TextNeuron` / `ListNeuron` standalone
- **Persistent** — `Brain.restore(path)` rehydrates from SQLite; same for standalone neurons
- **Runs anywhere** — Node, Bun, and Electron (ESM + CJS builds)

### Limitations

- Requires models with structured output and tool calling support
- Local model support (Ollama, LMStudio) not fully tested yet
- Not a database — builds understanding, doesn't store raw data
- Experimental (`0.0.x`) — expect breaking changes

### Contributing

Found a bug or have an idea? [Open an issue](https://github.com/unbody-io/adapt/issues). PRs welcome.

---

MIT — [Unbody](https://unbody.io)
