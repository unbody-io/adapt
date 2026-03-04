# Prompting Playbook

Learnings from Mycelium's prompt philosophy, applied to Brain's internal systems (evaluator, evolution handlers, synthesis).

---

## Core Principles

### 1. Root Question Over Rule Lists

Every agent/prompt should be organized around a single orienting question — not a methodology or decision tree. The root question gives the model a lens through which to reason about ANY situation, rather than mapping specific inputs to specific outputs.

**Bad:** "If dismissal rate > 80%, consider updating scope. If coverage gap, consider creating."
**Good:** "Is this network the right shape for what it's encountering?"

The model derives the right action from the question + context, not from a lookup table.

### 2. Biological Framing Over Technical Language

The system is a living knowledge network, not a database. Use organic metaphors consistently:

| Technical | Biological |
|-----------|-----------|
| Data ingestion | Nutrients flowing in |
| Dismissed data | Rejected nutrients — wrong shape to absorb |
| Learner overloaded | A node under stress |
| Coverage gap | Territory the network hasn't grown into |
| Merge learners | Consolidate overlapping growth |
| Split learner | A node differentiating into specialized parts |
| Delete learner | Pruning — letting go of what no longer serves |
| Healthy dormancy | Resting — not every node needs to be active |

This isn't decoration — it changes how the model reasons. Mechanical framing produces mechanical decisions. Organic framing produces adaptive decisions.

### 3. Mirror, Don't Prescribe

Present the situation — signals, context, patterns — and let the model reason. Don't tell it what to do with what it sees.

**Bad:** "When you see a coverage gap signal, investigate whether an existing learner can be expanded before creating a new one."
**Good:** Give it tools to inspect the system, show it the signals, let it investigate and decide.

The model's reasoning is better than our pre-scripted methodology. Our job is to give it the right information and the right question, not the right procedure.

### 4. One True Thing Beats Ten Clever Things

Prefer one well-reasoned decision over many. When creating learners, one broad learner is better than four specialized ones. When signaling, one synthesized insight is better than ten raw data points.

This applies to prompt length too — a shorter prompt with the right framing outperforms a longer prompt with exhaustive rules.

### 5. Silence Is Valid Output

"No action needed" is a first-class outcome, not a failure. The system should feel comfortable doing nothing when the shape is right. Don't create anxiety about inaction through principles that all push toward doing something.

### 6. Ground in Data, Not Abstractions

Always reference specific, concrete information — learner names, actual dismissed topics, real query patterns. Never reason from abstractions alone.

**Bad:** "There appears to be a coverage gap in the system."
**Good:** "Cooking, fitness, and travel data has been dismissed 14 times across 6 batches. No learner covers these domains."

### 7. Tools as Senses, Not Procedures

Give the model tools to SENSE the system (inspect, query, consult), not tools that encode procedures. The model decides what to look at based on what the signals suggest. Don't instruct it to "always call X first" — that removes autonomy.

Name tools by what they reveal, not by internal architecture:
- "Query a specialist" not "queryLearner"
- "Consult the system's self-knowledge" not "consultInternalLearner"
- "Review what's been dismissed" not "getDismissedBatches"

### 8. Revise, Don't Accumulate

When fixing prompt issues, don't patch — rethink. Each patch adds weight and creates conflicts with other patches. If a prompt needs a third fix, rewrite it from first principles.

This applies to the system too: when the evaluator keeps making the same mistake, the answer isn't another rule — it's a better framing or better tools.

---

## Anti-Patterns

1. **Decision trees in prompts** — "If X then Y" removes model autonomy
2. **Accumulated patches** — Each fix for a specific failure makes the prompt longer and more brittle
3. **Conflicting principles** — "Preserve knowledge" + "Act decisively" pull in opposite directions without guidance on when each applies
4. **Redundant tool descriptions** — Don't describe tools the model already receives via schemas
5. **Lossy abstractions in context** — Don't convert rich data to labels ("significant knowledge" instead of "4,200 chars of understanding about cooking techniques"). Give the model real data.
6. **Over-triggering** — Don't wake up a decision-maker for every atomic event. Let understanding accumulate, then trigger.

---

## Prompt Structure Template

For any Brain agent (evaluator, handlers, synthesis):

```
1. Identity (1-2 sentences)
   - Who you are (biological framing)
   - Your root question

2. What you can do (action list, brief)
   - No methodology — just the verbs

3. What you can see (tools, brief)
   - Named by function, not architecture

4. Constraints (only the essential ones)
   - Max 3-4 hard rules that prevent real damage
   - NOT behavioral guidance — the root question handles that

5. Context (dynamic, per-evaluation)
   - The actual state of the system
   - The signals that triggered you
   - Raw data, not abstractions
```

Total system prompt: aim for under 40 lines. Let the context carry the weight.

---

## Architectural Patterns

### Signals as Wake-Up Calls, Not Information

Signals should trigger decision-making, not carry the decision context. Keep signals lightweight — a source and a description. The real information lives in tools the decision-maker can use to sense the system.

**Bad:** Signal carries detailed metrics, raw data, and action suggestions.
**Good:** Signal says "something changed here." Decision-maker uses tools to understand what.

Exception: include a **preview** in signals when an internal process has already synthesized understanding. This saves a tool call for the common case while letting the model dig deeper if needed.

### Separate Urgency From Decision Quality

When data needs to be preserved (e.g., dismissed injection batches), handle that mechanically and immediately. The decision about what to DO with that data can wait for understanding to accumulate. Don't couple data custody with decision-making speed.

### Feed Resolutions Back Into the System

When the system changes shape (new specialist created, existing one broadened), feed that change back as a natural-language observation to any component tracking gaps or state. This keeps the system's self-knowledge current without special mechanisms — it's just learning about itself.

### Different Prompts for Different Jobs

Even when two tasks share infrastructure (e.g., the same LLM call pattern), they may need different prompts if the cognitive task is different:

- **Strategic decomposition** (initial setup): "Given this purpose, what specialists do I need?" → Rich decomposition framework.
- **Tactical creation** (evolution): "The evaluator already decided we need a cooking specialist. Generate the config." → Simple, focused prompt.

Sharing a prompt between these leads to contradictions ("follow these 7 decomposition principles" + "but only create ONE").

### Let Architecture Handle Hard Constraints

If something should NEVER happen (e.g., modifying system-level components), enforce it architecturally, not in prompts. The model shouldn't need to know about constraints that the system already guarantees. Prompt constraints should be reserved for genuinely ambiguous judgment calls — and even then, prefer a good root question over explicit rules.
