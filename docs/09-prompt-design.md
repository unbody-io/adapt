# Writing Instructions

Instructions are the single most important input to a neuron. They determine everything downstream:

```text
Instructions → Observer identity (what data is relevant?)
            → Schema generation (ListNeuron: what fields exist?)
            → Understand identity (how to synthesize?)
            → Query behavior (how to answer questions?)
```

A neuron with vague instructions produces vague understanding. A neuron with specific instructions produces grounded, evidence-backed knowledge.

## Brain Prompt

The brain prompt seeds LLM decomposition — it determines what neurons are created and what they track.

**Good prompts** are specific about the domain and what matters:

```text
Track my coding patterns across git commits, code reviews, and technical
discussions. I want to understand my evolving development philosophy,
preferred tools, and antipatterns I avoid.
```

**Bad prompts** are vague:

```text
Be a good brain that learns stuff.
```

## Neuron Instructions

Lead with the questions the neuron should be able to answer. These root questions orient everything — what the observer filters for, how the synthesizer reasons, and what the query layer prioritizes.

```text
Track product design principles and user research insights.

Track answers to:
- What are the team's core design principles?
- How do user needs inform design choices?
- Where do design principles conflict with each other?

Watch for:
- Design decisions and their rationale
- User testing results and behavioral patterns
- Accessibility considerations and standards applied
```

The "Track answers to" section is the most important part. It gives the neuron a purpose beyond collecting data.

## Instructions for TextNeuron

TextNeuron instructions shape how cognitive skills are applied to your domain. The neuron automatically detects confirmation, contradiction, recurrence, intensification, avoidance, etc. — your instructions determine *what* it applies these skills to.

**Ask for specifics if you want them.** The synthesizer defaults to abstract patterns unless instructions push for grounding:

```text
// Vague — produces "Alex exercises sometimes"
Track Alex's daily habits.

// Specific — produces "Alex cancelled gym 6 times with excuses,
// rescheduled dentist 4 times, dodged promotion conversation at 4 separate 1:1s"
Track Alex's behavioral patterns across daily activities.

Track answers to:
- What does Alex consistently avoid, and how? (approximate counts, timeframes)
- What topics recur most frequently? How many times, over what period?
- Where do stated intentions contradict actual behavior?
```

The difference is that specific instructions trigger the dynamics skills (recurs, avoids, shifts) to gather evidence — counts, timeframes, concrete instances — rather than just labeling patterns.

### Real-World Example: Clinical Trajectory

From a therapy copilot that tracks client patterns across sessions:

```text
You are the narrative memory of this therapeutic relationship — the through-line.

Track answers to:
- **Themes**: What topics recur? How has the client's language and framing
  around each topic shifted? Which carry the most emotional charge?
- **Emotional patterns**: What emotions come up most frequently and in what
  contexts? What triggers emotional shifts? How does the client regulate?
- **Avoidance**: What does the client consistently steer away from? How does
  avoidance manifest — topic changes, humor, intellectualization, somatic
  complaints, silence?
- **Language shifts**: How is the client's language evolving? Self-descriptions
  changing? Emotional vocabulary deepening? Agency language emerging?
- **Overall arc**: Where is this client right now? What is concretely shifting?
  What remains stuck despite effort?

Ground everything in the client's own language and specific interactions.
A claim without a quote or concrete example is not a claim.
```

Notice: specific sub-questions, explicit dimensions to track, and a grounding instruction at the end.

## Instructions for ListNeuron

ListNeuron instructions directly control schema generation. **The fields in your schema come from what you describe in instructions.**

**Name the fields you want.** If you say "track cuisine type, location, and price range," the schema will have those fields. If you don't mention a field, it won't exist.

```text
// Missing status field — if a PM rejects a feature, there's nowhere to record it
Track feature requests with name, description, and customer segment.

// Has status field — deprioritization data is captured
Track feature requests for a SaaS product. Each item is a distinct feature request.

For each feature request, track:
- The feature name and description
- Which customer segments are asking (enterprise, SMB, startup)
- Whether it's been deprioritized or rejected by the PM
```

**Describe what each item IS.** "Each item is a distinct feature request" is better than "Track features" — it tells the synthesizer the granularity you expect, which affects deduplication behavior.

**Don't ask the LLM to count.** If your instructions say "track how many sources requested this," the LLM will manage a `request_count` field — but it drifts over time (LLMs are bad at arithmetic across batches). Use `metadata.touchCount` instead, which is mechanically accurate.

## Specificity and Signal-to-Noise

Instructions control how much data the observer lets through:

- **Narrow instructions** → observer dismisses most data → high precision, may miss related patterns
- **Broad instructions** → observer accepts most data → comprehensive but noisy, more synthesis needed

This is a design choice, not a quality issue. A neuron tracking "React performance antipatterns" will be precise but miss general coding philosophy. A neuron tracking "coding patterns" will be comprehensive but need more synthesis cycles to find structure.

## Neuron Granularity

**Few broad neurons vs many narrow ones?**

Start with 3–7 neurons covering broad domains. Let evolution split them as data arrives. Reasons:

- Each neuron makes independent LLM calls during observe, understand, and query. More neurons = linear cost increase per inject/ask.
- Evolution is designed for this — it detects when a neuron is overloaded (high dismissal, low confidence) and splits it.
- Narrow neurons miss cross-cutting patterns. A "React hooks" neuron won't notice your general preference for functional patterns.

**When to go narrow:** If you know your domains upfront and they're distinct (e.g., "recipes" vs "workout tracking" vs "journal entries"), define explicit neurons. If domains emerge from usage, let `autoSetup: true` and evolution handle it.

**Practical limits:** Brain processes all neurons in parallel per inject/ask call. 10–20 neurons is comfortable. 50+ will work but increases latency and cost proportionally. The bottleneck is LLM calls, not Brain itself.

## Adjust Directives

Natural language steering for `adjustNeuron()` / `neuron.adjust()`:

```typescript
// Expand scope
await brain.adjustNeuron('design', 'Also track accessibility patterns')

// Narrow scope
await brain.adjustNeuron('tech', 'Focus only on React, stop tracking Vue')

// Change behavior
await brain.adjustNeuron('patterns', 'Be stricter about what counts as a distinct pattern')

// Shift emphasis
await brain.adjustNeuron('trends', 'Weight recent observations more heavily')
```

The LLM sees the neuron's current instructions and identity, then evolves them incrementally. If the directive is ambiguous, it preserves more rather than less.
