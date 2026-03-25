# Adapt — Design History

This document captures the design journey of Adapt (originally "Unbody Brain") from initial sketches through implementation. It preserves the key decisions, reasoning, bugs found, and lessons learned — the thinking behind the code.

---

## 1. Origins (Jan 2026)

### Initial Vision

Unbody Brain was conceived as a **general-purpose cognitive infrastructure** — a self-hosted, open-source system where a "brain" is an intelligent container that ingests raw data, maintains understanding via attention units, answers questions requiring continuous observation, and recalls specifics by falling back to storage.

> **"The core insight:** Some questions can't be answered by search alone. 'Have the user's political views shifted over time?' requires continuous observation — you can't reconstruct it from storage. This is what makes Brain different from RAG."

> **Tagline:** "Not a database that stores. A brain that learns."

### The "Fragments" Concept and Its Evolution

The system originally used the term **"fragments"** for its core learning units. Through iterative design, fragments evolved into **"attention units"** — stateful agents that maintain compressed understanding of specific concerns, rather than passive data caches.

Units were envisioned as attention agents with fixed purposes. Evolution would happen through **population dynamics** — split, merge, spawn, die — not by changing a unit's purpose. Understanding was type-specific (TextUnit, ListUnit, GraphUnit, extensible).

### Agent-Chains and Emergent Governance

The early architecture moved away from a centralized orchestrator model toward **emergent governance**:

> "Started with 'orchestrator controls' → evolved to 'emergent governance'"

The governing principle became: **"LLM for semantics, mechanical formulas for lifecycle."** Local mechanics (activation update, threshold check, ignition detection) would be handled by individual units, while global mechanics (decay, deprecation, split/merge) would be handled by the brain. No meta-agent controller — governance emerges from substrate conditions.

### Working Backwards from Use Cases

The team worked backwards from use cases to architecture:

1. Validated use cases — conversational memory, IoT behavior engine, personal knowledge assistant, customer data intelligence
2. First principles exploration — asking "why inject?", "why fragments?", "what is understanding?"
3. Architecture refinement — moving from centralized control to emergent governance

> "The goal is: **Design for ultimate, implement incrementally.**"

### Storage as Optional Tooling

A key early decision was that storage types (Vector, Graph, Postgres) would be **optional BYODB (Bring Your Own DB) tools**, not architectural layers. They serve recall, not understanding. A brain could run "attention-only" with no storage at all.

---

## 2. Core Architecture Decisions

### Perceivers vs Learners: The Statefulness Distinction

The fundamental architectural boundary is **statefulness**. The test:

> **"Can this be answered/extracted from one data point, or does it require having paid attention over time?"**

- **One data point → Perceiver** (stateless extraction agent)
- **Paid attention over time → Learner** (stateful understanding agent)

| | Perceiver | Learner |
|---|---|---|
| State | Stateless | Stateful |
| Operation | Extract from THIS data point | Compare against EXISTING understanding |
| Memory | None | Persists and evolves |
| Output | Enriched data → storage | Updated understanding |

### Two-Phase Learning Rationale

Brain separates learning into **Observe** (extraction) and **Synthesize** (integration).

**The problem with single-phase learning:**
- Every data point modifies understanding → high degradation risk
- As understanding grows, the LLM may truncate, drift, or lose sections
- Token cost of rewriting everything for tiny updates

**Two-phase benefits:**
- Understanding only changes during synthesis (controlled updates)
- Importance and relevance scores filter noise before synthesis
- Buffer enables batch processing and better pattern detection

> **"This adds complexity but significantly reduces the risk of understanding degradation over time."**

The tradeoff was explicitly accepted: favor stability and quality over immediacy.

### Key Tradeoffs Documented

1. **Compressed understanding vs raw data**: Chose lossy compression for constant memory, faster queries, and privacy — accepting that details may be forgotten and original data can't be re-analyzed.

2. **Auto-generated vs manual learners**: LLM decomposes prompts into learners automatically. Favors ease of use and adaptability over determinism, accepting non-deterministic decomposition and upfront token cost.

3. **Parallel routing vs selective routing**: All data sent to all learners, each self-filters. Favors simplicity and emergence over efficiency at small scale, accepting linear cost scaling with learner count.

### Comparison to Alternatives

| Approach | Difference from Brain |
|----------|----------------------|
| **RAG** | RAG stores raw data and retrieves chunks; Brain compresses understanding and scales with constant memory |
| **Fine-tuning** | Fine-tuning updates model weights (permanent, opaque); Brain maintains external understanding (reversible, inspectable) |
| **Long-context models** | Long-context needs full data each query; Brain maintains persistent compressed state |
| **Agent frameworks** | Agents are stateless and task-focused; Brain is stateful and learning-focused |

> **"Core Innovation**: Persistent, multi-perspective understanding that evolves continuously while avoiding catastrophic forgetting and context limitations through two-phase learning and compressed representations."

---

## 3. Learner Design

### Philosophy: Learning Agents, Not Caches

> "Learners are **learning agents** that maintain compressed understanding of specific concerns. Learners are not caches or data structures — they are what enables the brain to answer questions that require having paid attention all along."

The litmus test: "Can this be answered from one data point, or does it require having paid attention over time?" One data point → storage recalls it. Paid attention → learner maintains understanding.

### Population Dynamics Over Individual Tuning

Learners do not evolve individually. Their purpose is fixed at creation and never changes. Instead, the system evolves through population dynamics:

> "Evolution through population dynamics — learners don't evolve individually; they ignite, deprecate, and get replaced by new learners with refined purposes."

- **Split**: A learner tracking too broad a concern spawns two narrower learners, then deprecates itself.
- **Merge**: Two learners with overlapping purposes combine into one; the redundant one deprecates.

### Governance Strategies

Three understanding management strategies for TextLearners:

| Strategy | Behavior | Target Use Case |
|----------|----------|-----------------|
| **Continuous** | Single understanding blob, refined on each update (unbounded) | Short-lived subjects, single sessions |
| **Cumulative** | Fixed size; when limit reached, summarize and start fresh seeded with summary | Long-running with bounded cost |
| **Decay** | Temporal sections (recent/medium/old), older sections compressed progressively | Time-sensitive understanding where recency matters |

### Text vs List Types and Why

Type was defined by understanding shape:

**TextLearner** stored understanding as free-text narrative — suited for patterns, evolution, and synthesis across observations. Synthesis was a single LLM call: current understanding + observations in, rewritten prose out.

**ListLearner** stored understanding as structured items with metadata (confidence, firstSeen, signals). Synthesis was agentic — the LLM used store methods as tools to add/update/remove items iteratively. This was driven by context window constraints:

> "Whether understand uses direct LLM synthesis or agentic tool use depends on whether understanding fits in LLM context. Text: small, fits in context → direct. List: potentially large → agentic (tools)."

### Store as Dumb CRUD

> "The store is a persistence layer. It saves what it's told, retrieves what's asked, deletes what's requested. It has **zero logic** — no governance, no validation, no thresholds, no rules. It's a database driver, not an application."

### Evolution from Monolithic to Pluggable Types

**Phase 1 (v0)**: Monolithic TextLearner only. A single `ToolLoopAgent` handled both data processing and queries.

**Phase 2 (learner-types-refactor)**: Extracted `BaseLearner` abstract class from TextLearner. Introduced `LearningMethod` as a pluggable interface.

**Phase 3 (architecture-v2)**: First-principles redesign that rejected the pluggable learning method abstraction entirely:

> "The system claims pluggable learning methods, but bakes specific method assumptions into shared base types. Only introduce plugin boundaries where there's a real, current need."

Learning methods became built-in per type. Pluggability was preserved only for store persistence backends.

---

## 4. Brain Orchestration

### Prompt Decomposition: The Seven-Principle Playbook

The Brain decomposes user prompts into learner configurations via LLM. Seven principles encoded hard-won lessons:

**Principle 1: Understand Before Decomposing.** Analyze what is being tracked, what questions will be asked, what data flows in, the time horizon.

**Principle 2: Find Orthogonal Dimensions.** Decompose into independent dimensions that can evolve at different rates.

> "If dimension A changes significantly, does B necessarily change?" If no, they are orthogonal.

**Principle 3: Decide Learner Count Deliberately.**

> "Start with the minimum number that provides meaningful separation. One well-scoped learner is better than three overlapping ones."

**Principle 4: Generic vs Specialist Trade-off.** If all questions are broad, a single generic learner may suffice. If aspects interact heavily, a generic learner captures interactions better than siloed specialists.

**Principle 5: Define Clear Boundaries.** Each learner needs clear scope, clear non-scope, and unique questions only it should answer.

**Principle 6: Write Actionable Instructions.** Core directives required one clear sentence with verb + what to understand + specific focus.

**Principle 7: Validate Before Finalizing.** Coverage check, overlap check, routing clarity, and proportionality.

### Injection Routing

Data is sent to ALL learners. Each learner processes independently. Results are aggregated. Smart routing was explicitly deferred:

> "Smart routing (sending only to relevant learners) was explicitly listed as out of scope for Stage 1."

### Query Synthesis

Fan-out/synthesize pattern: query all learners → each responds independently with relevance, confidence, insight, gaps → LLM synthesis call integrates all responses → unified answer. The Brain is "coordination, not computation."

### Model Cascade Design

Models cascade from specific to general:

> "Models cascade: local > parent blueprint > local model > parent model."

A learner could have its own model per phase, or fall back to the brain-level model. Enables cost optimization: cheap model for high-volume observation, smart model for synthesis.

### Batching

Two-level mechanism: **Brain-level batching** (default: 20 items per inject call) and **Learner-level chunking** (default: 30,000 tokens per processing call). Batches process sequentially; within each batch, all learners process in parallel.

---

## 5. Evolution System

### The Living Brain (February 2026)

On February 3, 2026, the "Living Brain" specification established Brain as an autonomously evolving system. Five core principles:

1. **Autonomous Adaptation** — evolution happens without human approval
2. **Signal-Driven** — all evolution decisions triggered by observable signals
3. **Intelligent Decision Making** — centralized Evaluator using LLM intelligence
4. **Consistent Execution Pattern** — every action follows `Guidance → LLM → Config → Execute`
5. **Full Runtime Mutability** — every parameter updatable at runtime

Five evolution actions: spawn, merge, split, adjust, prune.

### Evaluator Bugs and the Audit (February–March 2026)

The evaluator accumulated serious bugs during implementation:

**Bug 1: Duplicate learner creation.** Race condition where `isEvaluating` flipped to `false` before evolution execution completed. The evaluator created 6 cooking learners.

**Bug 2: Signal loss during evaluation.** `this.signals = []` wiped ALL signals including ones arriving during the LLM call. Fixed with `this.signals.splice(0, consumedCount)`.

**Bug 3: Tool loop stagnation.** With `toolChoice: 'required'`, Gemini Flash cycled through tools without reasoning, never calling `finalizeDecisions`. Switching to `toolChoice: 'auto'` let the model actually reason.

**Bug 4: Learner proliferation.** A single "create a cooking learner" decision produced 4 sub-learners. The create handler's LLM was over-decomposing.

**Bug 5: Oscillating behavior.** After fixing duplicates, the evaluator swung to doing nothing (0 decisions across 12 evaluations). Then only used CREATE.

> "Each fix was a patch on the system prompt... These incremental fixes kept accumulating. We stepped back to audit the whole evaluator from first principles."

The audit found four structural problems: per-batch bypass triggers (19 batches = 19 LLM calls), no access to internal learners' synthesized understanding, over-prescriptive prompt (signal→action lookup table), and accumulated patches that didn't compose.

### The "One Root Question" Redesign (March 5, 2026)

The 68-line system prompt with 6 principles and accumulated patches was replaced with ~10 lines centered on one question:

> **"Is this network the right shape for what it's encountering?"**

| Old Principle | How the Root Question Handles It |
|---|---|
| "Investigate before deciding" | "Sense the network before deciding" |
| "Knowledge has value" | Model naturally reasons about cost of destroying knowledge |
| "Action priority: update > merge > create > split > delete" | Model reasons about best fit, not a priority list |
| "Healthy dormancy is success" | "Right shape" includes "already right — do nothing" |
| "No action is valid" | Explicit in prompt |

The evaluator's identity shifted from a system administrator following procedures to the **growth intelligence** of a living knowledge network:

> "It senses what flows through the network — what's being absorbed, what's rejected, where specialists are thriving, where they're struggling — and decides where the network needs to grow, reshape, or let go."

### Resilience Bugs (February 2026)

Three critical bugs crashed the server during stress testing:

1. **Evolution handlers throw on failure** — a single LLM parse error crashed the process. Fixed with `continue`.
2. **No concurrency guard** — multiple evaluation cycles ran simultaneously. Fixed with `isEvaluating` lock.
3. **Stagnation signal storm** — stagnation check fired on every batch once threshold crossed (31, 32, 33...). Fixed with fire-once flag.

---

## 6. Internal Learners & Self-Knowledge

### The "One Mechanism Solves All" Insight (March 2026)

The key insight was that Brain's existing learner primitive — observe, understand, query — was the only mechanism needed for self-knowledge. The gap wasn't missing features; it was that learners were only used for external data.

> "The previous spec proposed 3 separate features with 3 different mechanisms. This spec has **one mechanism** (internal learners) that solves all of them."

| Previous Approach | New Approach |
|---|---|
| Brain-level understanding via bespoke synthesis function | Internal TextLearner — same pipeline |
| Queries as observations via custom post-ask injection | Just `learn()` on internal + external learners |
| "Internal meta-learners — NOT in scope" | They ARE the scope |
| 3 separate mechanisms | 1 primitive reused in 3 places |

### Four Internal Learners

**Global Injection Understanding** (TextLearner) — cross-domain connections, overarching themes, tensions. Listens to `learner:synthesized` events. Uses `decay` governance.

**Global Query Understanding** (ListLearner) — tracks what users ask: topics, frequency, clusters, coverage gaps.

**Injection Gap Learner** (TextLearner) — accumulates what data no external learner covers. Deduplicates naturally through observe-understand cycle.

**Query Gap Learner** (TextLearner) — tracks questions no learner could answer well.

### Queries as Data

A fundamental shift: queries stopped being purely extractive. After `brain.ask()`, the query plus responses are fed back through learners via `learn()`. The system learns from what users want to know, not just what they inject.

### The Consult Method

`brain.consult(query)` queries internal learners only, returning synthesized self-knowledge. Distinct from `brain.ask()` which queries external learners. The evaluator calls `consult()` for richer context during evolution decisions.

---

## 7. Operational Findings (February 2026)

### Seven Manual Testing Sessions (~1,250 Items)

Between February 12–17, 2026, seven manual testing sessions revealed critical bugs across every layer of the system.

### The Pre-Synthesis Dead Zone

Learners had buffered observations but reported "no knowledge" when queried.

> "Before synthesis, brain said 'I know nothing' 3 times in a row. After synthesis triggered... the exact same question got a rich, detailed response with 95% and 98% confidence."

Fix: pass buffered observations as fallback context in query prompts when understanding is empty.

### Confidence Semantics Inverted

The most architecturally significant bug: the LLM interpreted confidence as "certainty about my response," not "how well could I answer." When a learner was certain it couldn't help, it reported `confidence: 1.0`.

> "The LLM interprets confidence as 'certainty about my response.' When uncertain about nuanced topics it hedges (0.70–0.98), but when certain it can't help it reports 1.0."

This inverted the entire signal model. Fix: split into `relevance` (how related is the query to my domain?) and `confidence` (how well could I answer from my understanding?).

### Observe Too Permissive

Learners accepted ~5% of completely irrelevant noise by finding abstract metaphorical connections. The `problem-solving-approach` learner synthesized cooking data into its understanding:

> "...mirroring the precision required in complex culinary arts"

The observe prompt's dismissal criteria was too vague: "Dismiss data that doesn't connect to what you're tracking." The LLM found connections in anything.

### Auto-Evaluate Broken

> "Manually sent 3 signals via POST /brain/signal. At threshold (3), the evaluator auto-triggered... But NO evolution execution events fired — decisions were generated then discarded."

The auto-evaluate path and manual `brain.evaluateEvolution()` path were disconnected.

### Signal System Coverage Map

| Condition | Tracked? | Working? |
|---|---|---|
| High dismissal rate (>80%) | Yes | Untested (rate too low due to permissive observe) |
| Low confidence (<0.3) | Yes | **Broken** — confidence always 1.0 on failures |
| Stagnation (>100 obs) | Yes | Threshold practically unreachable |
| Auto-evaluate → execute | N/A | **Broken** — decisions never executed |
| Query relevance failures | **No** | Not implemented |
| Gap accumulation | **No** | Not implemented |
| Success rate tracking | **Dead code** | Field never updated anywhere |

---

## 8. Prompting Philosophy

### Root Question Over Rule Lists

> "Every agent/prompt should be organized around a single orienting question — not a methodology or decision tree. The root question gives the model a lens through which to reason about ANY situation."

Bad: "If dismissal rate > 80%, consider updating scope." Good: "Is this network the right shape for what it's encountering?"

### Biological Framing Over Technical Language

Data ingestion = "nutrients flowing in." Dismissed data = "rejected nutrients." Merging learners = "consolidating overlapping growth." Deletion = "pruning."

> "This isn't decoration — it changes how the model reasons. Mechanical framing produces mechanical decisions. Organic framing produces adaptive decisions."

### Mirror, Don't Prescribe

Present the situation — signals, context, patterns — and let the model reason. Don't tell it what to do with what it sees.

> "The model's reasoning is better than our pre-scripted methodology. Our job is to give it the right information and the right question, not the right procedure."

### Tools as Senses, Not Procedures

Name tools by what they reveal: "Query a specialist" not "queryLearner." The model decides what to look at based on what the signals suggest.

### One True Thing Beats Ten Clever Things

One well-reasoned decision over many. One broad learner over four specialized ones. A shorter prompt with the right framing over a longer prompt with exhaustive rules.

### Silence Is Valid Output

"No action needed" is a first-class outcome. Don't create anxiety about inaction through principles that all push toward doing something.

### Revise, Don't Accumulate

> "When fixing prompt issues, don't patch — rethink. Each patch adds weight and creates conflicts. If a prompt needs a third fix, rewrite it from first principles."

---

## 9. Store & Persistence (v2 Refactor)

### Design Decisions

**Pluggable abstraction with two separate store systems.** Learner stores (`Store`: observations, understanding, evolution, state) and Brain stores (`BrainStore`: state, registry, evolution) are fully isolated.

**Store is single source of truth.** Every piece of state goes through the store. "One source of truth, period. I/O is negligible vs LLM calls. Caching is easy to add later if needed."

**Store is injected, store is dumb.** The learner has no knowledge of store types; the caller decides the adapter. Per-learner SQLite databases provide isolation, portability, and no contention.

**Universal UnderstandingRecord.** No type parameter on Store. Same `metadata_***` columns for all learner types. Only `data` shape varies.

**Persistent observations with status field.** Observations are never deleted — marked `processed` after understand, not cleared.

### Key Decisions from Feedback Rounds

**Round 1** — Understanding was stored in-memory, not through the store. Critical violation of "single source of truth."

**Round 2** — No backward compatibility shims. "If something doesn't match our current naming, it gets deleted. If external callers reference old names, those callers get updated now — not shimmed." No `any` allowed.

**Round 3** — Naming convention standardized: `persistX()` / `restoreX()` for all store methods.

**Round 4** — ListLearner understand was fundamentally wrong: implemented as single-shot structured LLM call, but architecture required agentic tool-based flow. "The whole point of the store layer is to decouple understanding from context window limits. Dumping 200 items into a prompt defeats that purpose."

**Round 5** — Agentic understand verified. Missing semantic eval flagged.

**Round 6** — Two critical bugs: schema generation produced empty `{}`, and understand tools sent `data: {}` every call. Dedup became mechanical (forced search in `addItem` handler) rather than relying on agent behavior.

**Round 7** — 300/300 tests passed across both adapters. Implementation was cleaner than spec.

### Implementation Rules (distilled)

1. Store = single source of truth, no half-measures
2. No backward compat shims — rename, fix ALL callers, delete old name
3. No duplicate types — when spec says "X → Y," kill X completely
4. No `any` — use `unknown` for generic type params
5. Finish what the spec says or explicitly defer
6. Consistent naming: `persistX()` / `restoreX()`
7. Every phase needs eval coverage
8. Store is dumb storage, learner holds logic

---

## 10. Eval Findings

### Model Capabilities

The system includes a model capabilities eval testing five dimensions: text generation, structured output, tool calling, structured output + tools combined, and reasoning.

- **qwen2.5:7b** (ollama) — first local model to pass structured output + tools (7/8 overall). Required numeric clamping fix in LLM layer.
- **qwen2.5:3b** — tool calling works; structured output + tools combined fails.
- **strm-4b-v1** — partial structured output; multi-step tool calling fails.
- **deepseek-r1:1.5b** — no structured output or tool support.
- **liquid/lfm-2-24b** — scored 0/13 via OpenRouter; ignores schemas entirely.

### Eval Philosophy

Evals are semantic analysis tools, not automated tests. "Run the scripts, read the logs, verify the output makes semantic sense. This is the most important layer — it catches what automated tests miss."

---

## 11. Future/Deferred Ideas

### Perceivers (Perception Agents)

A perception layer that converts arbitrary input into consistent shape for learners. Perceivers are autonomous agents (not pipelines), stateless (no memory between data points), with tool pools for extraction, chunking, enrichment. Three scope levels: brain-wide, per-subject, per-record-type.

### MCP Integration (Nexus)

Brain as Claude's persistent memory layer via MCP. Four tools: `init`, `learn`, `ask`, `status`. Phased rollout from local MCP server to cloud deployment.

### Playground

Live demo app visualizing Brain as a living mycelium organism using WebGL shaders. Separate Commentator LLM narrates what the Brain is thinking. Two-panel layout: data control deck + mycelium visualization with commentator stream.

### Instruction Flexibility

Concern: instructions go through LLM interpretation, complex directives may get diluted. Needs eval verification before implementing any fix.

### Observe Passthrough Mode

Internal learners receive pre-curated data but the observer wastes LLM calls and rejects valid data (75% dismissal rate on query gap learner). Fix: `passthrough: boolean` in governance — skip observe, data goes straight to buffer.

### Prompt Playbook Alignment

Learner prompts predate the prompting playbook and are rule-heavy, prescriptive, and mechanical. The evaluator prompts already follow the playbook. Task: rewrite all learner prompt templates to follow playbook principles.
