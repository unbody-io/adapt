# Eval: Thread Detection via Evolution + Brain Prompt

## Context

We're building an app called Mycelium — a personal AI system that watches what a user saves, reads, highlights, and bookmarks across tools, and over time discovers emergent "threads" of attention. A thread is a cluster of saves that share a coherent underlying concern — not a keyword tag, but a meaning. For example, bookmarks about note-taking apps, articles about extended cognition, and conversations about PKM might all belong to a thread called "building a cognitive exoskeleton."

Threads have lifecycle: they emerge, intensify, go dormant, merge, and sometimes die. The system should discover these threads organically without the user creating them.

## The Idea

We want to use `@unbody/brain` as the memory engine. The core idea is:

**Each thread IS a learner.** Instead of tracking threads as items in a single ListLearner, we let Brain's evolution system organically create, split, merge, and delete learners — where each learner represents one thread of attention. This way each thread has its own deep understanding (via TextLearner narrative) rather than being a shallow row in a list.

### How it works

1. **Initialize Brain with a few seed learners** representing threads we already know about (or let autoSetup generate initial ones).

2. **Write a very solid brain prompt** that guides the evaluator toward the idea of treating learners as threads. The brain prompt should make it absolutely clear that:
   - Each learner = one thread of user attention
   - When data doesn't fit existing threads, evolution should CREATE a new learner (thread)
   - When threads overlap, evolution should MERGE learners
   - When a thread becomes too broad, evolution should SPLIT the learner
   - When a thread dies (no activity), evolution should DELETE the learner

3. **Create an additional ListLearner with `skipObservation: true`** whose job is to maintain a registry/enum of all current threads. This learner has `skipObservation` set to true, meaning it does NOT filter incoming data — it learns from every single ingestion. It basically understands from every incoming piece of data what threads exist. We never use `setUnderstanding` on it — it builds its understanding organically through the normal learn pipeline (observe everything → synthesize into a thread list).

4. **Reference this registry learner in the brain prompt** — tell the brain "always consult this thread registry learner to know what threads currently exist and what's missing." The evaluator's existing consult tools should also help it make good evolution decisions.

## What We Need to Test

This eval should verify:

1. **Does the brain prompt actually influence evolution behavior?** — If we write a prompt that says "treat learners as threads of attention," does the evaluator actually create/merge/split/delete learners in a thread-like way when signals accumulate?

2. **Does the `skipObservation: true` ListLearner work as a thread registry?** — Since it skips observation filtering, it should learn from every ingestion. Does it organically build and maintain a useful list of threads through normal synthesis (not setUnderstanding)?

3. **Does evolution create new learners (threads) when data arrives that doesn't fit existing ones?** — If we inject bookmarks about a totally new topic, do coverage gap signals accumulate and does the evaluator decide to create a new thread-learner?

4. **Does evolution merge learners when threads converge?** — If two thread-learners start covering overlapping concerns, does the evaluator merge them?

5. **End-to-end: after injecting diverse bookmarks over time, does Brain end up with a learner structure that looks like a reasonable set of attention threads?**

## Test Scenario

Simulate a user who saves bookmarks across these domains over several weeks:

- **Cluster A — "Calm Technology"**: articles about e-ink devices, Daylight Computer, digital minimalism, calm tech philosophy, slow software
- **Cluster B — "Building Tools for Thought"**: articles about note-taking apps, Zettelkasten, knowledge graphs, PKM tools, personal wikis
- **Cluster C — "Wedding Planning"**: venue options, catering ideas, a note about "intimacy, informality, people actually relaxed and present"
- **Overlap A+B**: an article about "building a calm note-taking tool" (bridges calm tech + tools for thought)
- **New unexpected cluster D**: suddenly 5 bookmarks about sourdough baking with no prior history

Inject these in realistic batches (not all at once), with timestamps, simulating data arriving over weeks.

After injection:
- Check what learners exist — do they roughly correspond to the clusters?
- Check if the registry ListLearner has a useful thread list
- Check if the overlap triggered any merge/split signals
- Check if cluster D (sourdough) triggered creation of a new learner
- Query `brain.ask("What threads of attention do you see?")` and see if the answer is coherent

## Important Notes

- The brain prompt is the key lever here. Spend time making it solid.
- We need to understand how much influence the brain prompt has on evolution behavior — this is partially unknown.
- `skipObservation: true` means the learner's observer accepts everything (no filtering). It still goes through the normal observe → buffer → synthesize pipeline. It just doesn't dismiss anything as irrelevant.
- Do NOT use `setUnderstanding` anywhere. Everything should be organic through the learn pipeline.
- Evolution signals need to accumulate (default threshold is 5) before the evaluator runs. Make sure enough data is injected to trigger evolution.
- Use `evaluateEvolution({ dryRun: true })` at various points to see what the evaluator WOULD decide, even if the threshold hasn't been met yet.
- Also try `brain.evaluateEvolution()` (non-dry-run) to actually execute evolution decisions and see the results.
