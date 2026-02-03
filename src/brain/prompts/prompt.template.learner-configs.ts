/**
 * Prompt template for decomposing a user prompt into learner configurations
 *
 * Includes the Learner Creation Playbook (7 principles) to guide the LLM.
 */
export const learnerConfigsPromptTemplate = (userPrompt: string) => `You are a learning system architect. Your task is to decompose a user's prompt into a set of specialized learners.

══════════════════════════════════════════════════════════════════════════════
USER PROMPT
══════════════════════════════════════════════════════════════════════════════
${userPrompt}

══════════════════════════════════════════════════════════════════════════════
LEARNER CREATION PLAYBOOK
══════════════════════════════════════════════════════════════════════════════

Follow these principles when decomposing the prompt into learners:

PRINCIPLE 1: UNDERSTAND BEFORE DECOMPOSING

Before creating learners, analyze:
- What is being tracked? Patterns, preferences, behaviors, states, relationships
- What questions will be asked? Prediction, explanation, comparison, recommendation
- What data will flow in? Events, documents, conversations, observations
- What's the time horizon? Session, days, months, ongoing

PRINCIPLE 2: FIND ORTHOGONAL DIMENSIONS

Decompose the domain into independent dimensions — aspects that:
- Can evolve at different rates
- Answer fundamentally different question types
- Can be reasoned about without reference to each other

Test for orthogonality: "If dimension A changes significantly, does B necessarily change?" If no, they are orthogonal and may warrant separate learners.

Test for independence: "Can I ask a meaningful question about A without needing to know about B?" If yes, they are separable concerns.

PRINCIPLE 3: DECIDE LEARNER COUNT DELIBERATELY

Fewer learners when:
- Domain is simple or highly interconnected
- Questions tend to be broad, crossing multiple aspects
- Token budget is a concern
- Dimensions don't evolve independently

More learners when:
- Domain has clearly separable aspects
- Questions are often specific to one aspect
- Different aspects require different depth
- Aspects evolve at very different rates

Heuristic: Start with the minimum number that provides meaningful separation. One well-scoped learner is better than three overlapping ones.

PRINCIPLE 4: GENERIC VS SPECIALIST TRADE-OFF

Generic learner: Broad coverage, sees cross-cutting patterns, answers "big picture" questions. Risk: may lack depth.

Specialist learners: Deep focus on specific aspect, answers detailed questions within scope. Risk: may miss connections.

Decision logic:
- If all expected questions are broad → single generic may suffice
- If questions span broad and specific → consider generic + specialists
- If questions are always aspect-specific → specialists without generic
- If aspects interact heavily → generic may capture interactions better than siloed specialists

PRINCIPLE 5: DEFINE CLEAR BOUNDARIES

Each learner must have:
- Clear scope: What it tracks, stated positively
- Clear non-scope: What it explicitly leaves to others
- Unique questions: Questions that ONLY this learner should answer

The boundary test: For any expected question, exactly one learner should be the natural answerer. If multiple learners would answer equally well, boundaries are unclear.

The data test: For any data point, it should be clear which learner(s) find it relevant. If the same data updates multiple learners in the same way, consider merging them.

PRINCIPLE 6: WRITE ACTIONABLE INSTRUCTIONS

Core directive: One clear sentence. Verb + what to understand + specific focus.
- Good: "Understand the user's error handling preferences and patterns"
- Bad: "Track coding stuff"

Watch conditions: Observable, specific triggers that warrant attention.
- Good: "Explicit statements rejecting or endorsing a practice"
- Bad: "Anything important about their style"

Questions to track: Concrete questions the learner should be able to answer.
- Good: "Do they prefer exceptions or explicit error returns?"
- Bad: "What is their philosophy?"

PRINCIPLE 7: VALIDATE BEFORE FINALIZING

Coverage check: Do the learners together cover the full intent of the user's prompt?

Overlap check: Is there significant redundancy where the same insight would appear in multiple learners?

Routing clarity: For each type of question the user might ask, is there a clear "best" learner to answer it?

Proportionality: Is the number of learners proportional to the complexity of the domain? Over-decomposition wastes tokens; under-decomposition loses nuance.

══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
══════════════════════════════════════════════════════════════════════════════

CRITICAL: Output ONLY valid JSON. No markdown, no explanation, no code blocks.
- Use \\n for newlines inside string values (do NOT use actual line breaks in strings)
- Escape all special characters properly

Return a JSON object with this exact structure:
{
  "learners": [
    {
      "id": "kebab-case-identifier",
      "name": "Human-readable display name",
      "description": "Brief description for query routing",
      "instructions": "Full structured instructions...",
      "type": "text",
      "maintenance": { "strategy": "continuous" }
    }
  ]
}

For each learner:
- id: kebab-case identifier (e.g., "coding-style", "learning-interests")
- name: Human-readable display name
- description: Brief description for query routing (what questions this learner answers)
- instructions: Full structured instructions following this format:

  [Core understanding directive - one clear sentence]

  Watch for:
  - [Specific observable condition 1]
  - [Specific observable condition 2]

  Track answers to:
  - [Concrete question 1]
  - [Concrete question 2]

- type: "text" (only supported type in MVP)
- maintenance: { strategy: "continuous" | "cumulative" | "decay" } (optional)
  - continuous: Single growing understanding (default, good for most cases)
  - cumulative: Summarize when understanding gets large (good for high-volume data)
  - decay: Weight recent observations higher (good for tracking evolving preferences)

Output the JSON now:`
