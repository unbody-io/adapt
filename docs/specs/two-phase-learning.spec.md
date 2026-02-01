# Two-Phase Learning Specification

## Overview

This specification defines a two-phase learning architecture for TextLearner agents that separates **observation** (capture) from **synthesis** (understanding update). This addresses understanding degradation risks in the current single-pass approach: truncation, drift, loss, and token cost.

### Current Problem

The current learning method receives `currentUnderstanding + newData` and returns a complete `newUnderstanding` — a full replacement every time. This creates risks:

- **Truncation**: LLM cuts long understanding short
- **Drift**: LLM subtly rewords things that shouldn't change
- **Loss**: LLM forgets sections during rewrite
- **Token cost**: Rewriting everything even for tiny updates

### Solution

Split learning into two distinct phases:

| Phase | Responsibility | Frequency |
|-------|---------------|-----------|
| **Observe** | Extract what's relevant to purpose | Every `learn()` call |
| **Synthesize** | Update understanding from buffered observations | When thresholds met |

This separates capture (frequent, cheap, safe) from synthesis (less frequent, more careful). Understanding only gets rewritten during synthesis, reducing degradation risk.

---

## Phase 1: Observe

### Purpose

Pure attention-oriented extraction. The learner looks at data and extracts whatever is relevant to its purpose. No comparison to understanding — that's deferred to Synthesize.

### Input

- Raw data (same as current `learn(data)`)
- Learner's purpose/instructions

### Output

```typescript
type ObserveResult =
  | { status: 'observed', output: string, importance: number }
  | { status: 'dismissed', output: string }
  | { status: 'error', output: null }
```

- **observed**: Relevant content found, extracted as plain text with importance score (0-1)
- **dismissed**: Data examined but nothing relevant to purpose. Output contains model's explanation.
- **error**: LLM failure

### Characteristics

- **No classification**: Raw extraction only. Classification requires comparison to understanding (Synthesize phase)
- **No schema**: Plain text output. No metadata, no structure.
- **No source tracking**: If it's relevant, capture it. Source doesn't matter.
- **Purpose-guided**: Relevance determined by learner's purpose, not current understanding

### Processing

Extraction + filtering only:
- "Is this relevant to my purpose?"
- If yes → capture it
- If no → dismiss with explanation

---

## Observation Buffer

### Structure

```typescript
interface ObservationBuffer {
  observations: Array<{ text: string; importance: number }>
}
```

Simple array. Derived metrics computed on demand:
- `count` — `observations.length`
- `avgImportance` — average of importance scores
- `totalTokens` — estimated token count

### Behavior

- Only `status: 'observed'` results get buffered
- Dismissed observations are not buffered
- Buffer clears completely after synthesis

---

## Phase 2: Synthesize

### Purpose

Compare buffered observations against current understanding and produce updated understanding. This is where the cognitive framework (CONFIRMS, CONTRADICTS, EXTENDS, NEW, IRRELEVANT) guides reasoning — embedded in prompts, not as explicit classification output.

### Input

- Buffered observations (array of strings)
- Current understanding
- Learner's purpose/instructions
- Cognitive skills framework (embedded in prompt)

### Output

```typescript
interface SynthesizeOutput {
  newUnderstanding: string
  significance: 'routine' | 'notable' | 'critical'
  evolution: string      // what changed and why
  reasoning?: string     // optional explanation
}
```

No `dismissed` or `relevance` fields — Observe already handled relevance filtering.

### Characteristics

- **Careful synthesis**: Less frequent than Observe, more deliberate
- **Full replacement**: Produces complete new understanding (but from curated observations, not raw data)
- **Cognitive framework**: Skills guide reasoning implicitly via prompts

---

## Synthesis Triggers

After each Observe, check conditions. If any threshold is met, trigger Synthesize.

```typescript
if (count >= maxObservations || totalTokens >= maxTokens || avgImportance >= minImportance) {
  → synthesize()
}
```

### Thresholds

Configurable at initialization:

```typescript
thresholds: {
  maxObservations?: number    // count trigger
  maxTokens?: number          // token limit trigger
  minImportance?: number      // importance trigger (high importance = synthesize sooner)
}
```

Thresholds respect model token limits (which vary by model for input vs output).

---

## Methods

Both phases support multiple methods, following the existing pattern:

### Observe Methods

| Method | Description |
|--------|-------------|
| `direct` | Single LLM call, structured output |
| `tool-based` | Multi-step with tools for traceability |

### Synthesize Methods

| Method | Description |
|--------|-------------|
| `direct` | One pass, cognitive skills embedded in prompt, implicit reasoning |
| `tool-based` | Optional classify tool for per-observation traceability |

The phase (Observe vs Synthesize) is separate from the method (direct vs tool-based).

---

## API

### Transparent Interface

Caller still uses `learn(data)`. Two-phase architecture is internal implementation detail.

```typescript
learn(data: unknown[], options?: { forceIntegrate?: boolean }): Promise<LearnResult>
```

- `forceIntegrate: true` — force synthesis regardless of thresholds (e.g., end of session)

### Return Type

Discriminated union — caller knows exactly what happened:

```typescript
type LearnResult =
  // Observe outcomes
  | { status: 'observed', output: string }           // buffered, waiting for synthesis
  | { status: 'observe:dismissed', output: string }  // nothing relevant in data
  | { status: 'observe:error', error: unknown }      // observe LLM failed

  // Synthesize outcomes
  | { status: 'synthesized', newUnderstanding: string, significance: 'routine' | 'notable' | 'critical', evolution: string, reasoning?: string }
  | { status: 'synthesize:dismissed', output: string } // observations didn't change understanding
  | { status: 'synthesize:error', error: unknown }     // synthesize LLM failed
```

---

## Configuration

```typescript
interface TwoPhaseConfig {
  observe: {
    method: 'direct' | 'tool-based'
    model?: LanguageModel  // optional, defaults to learner's model
  }
  synthesize: {
    method: 'direct' | 'tool-based'
    model?: LanguageModel  // optional, defaults to learner's model
    thresholds: {
      maxObservations?: number
      maxTokens?: number
      minImportance?: number
    }
  }
}
```

Per-phase model configuration enables:
- Cheap/fast model for Observe (it's just extraction)
- Smarter model for Synthesize (careful reasoning)

---

## Events

Granular events for full observability:

### Observe Phase Events

| Event | Payload |
|-------|---------|
| `learner:observed` | `{ output: string, importance: number, bufferCount: number }` |
| `learner:observe:dismissed` | `{ output: string }` |
| `learner:observe:error` | `{ error: unknown }` |

### Synthesize Phase Events

| Event | Payload |
|-------|---------|
| `learner:synthesized` | `{ newUnderstanding, previousUnderstanding, significance, evolution }` |
| `learner:synthesize:dismissed` | `{ output: string }` |
| `learner:synthesize:error` | `{ error: unknown }` |

Token usage tracked via events, not in result.

---

## Strategies

Existing understanding strategies (continuous, cumulative, decay) still apply — they post-process understanding after Synthesize.

Buffer strategies may be added later as a separate concern.

---

## Edge Cases

### Cold Start (No Understanding Yet)

Same flow. Observe uses purpose alone to determine relevance — understanding is what gets built from observations, not what guides Observe.

### Empty Observation

When Observe finds nothing relevant:
- Returns `{ status: 'dismissed', output: string }`
- Nothing buffered
- `learn()` returns `{ status: 'observe:dismissed', output: string }`

### Buffer After Synthesis

Clears completely. Start fresh for next observation cycle.

---

## File Structure

```
src/learners/text-learner/
├── observe-methods/
│   ├── direct/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── prompt.template.ts
│   ├── tool-based/
│   │   └── index.ts
│   └── types.ts
├── synthesize-methods/
│   ├── direct/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── prompt.template.ts
│   ├── tool-based/
│   │   └── index.ts
│   └── types.ts
├── buffer/
│   ├── index.ts
│   └── types.ts
└── ...existing files
```

---

## Summary

| Aspect | Current Approach | Two-Phase Approach |
|--------|-----------------|-------------------|
| Learning flow | Single pass: data → understanding | Two phases: Observe → Buffer → Synthesize |
| Understanding updates | Every `learn()` call | Only when thresholds met |
| Degradation risk | High (full rewrite every time) | Lower (synthesis from curated observations) |
| Token cost | High (rewrite everything) | Lower (observe is cheap, synthesize is batched) |
| Traceability | Method-dependent | Method-dependent per phase |
| API | `learn(data) → result` | Same (transparent) |
