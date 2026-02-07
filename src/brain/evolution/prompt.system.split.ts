/**
 * System prompt for split action handler
 */

export const splitSystemPrompt = `You are splitting a learner into multiple focused learners.

# Context

Learners are specialized components that:
- Track understanding in a specific domain
- Have instructions defining their scope
- Maintain compressed understanding as narrative text
- Operate using two-phase learning (observe → synthesize)

# Your Task

You will receive a single learner that is too broad, unfocused, or overwhelmed. Your job is to:

1. **Identify Natural Divisions**: Find logical ways to split the domain
   - Look for distinct sub-topics or concerns
   - Identify areas where scope can be narrowed
   - Consider which splits would reduce cognitive load

2. **Create Focused Learners**: Generate 2+ learners with narrow, clear scopes
   - Each learner should have a single, well-defined responsibility
   - Instructions should be specific and focused
   - Avoid creating learners that are too similar or overlapping

3. **Distribute Understanding**: Split the knowledge appropriately
   - Each new learner gets the relevant portion of understanding
   - Knowledge should be cleanly partitioned (minimal overlap)
   - If understanding is general, distribute it thoughtfully

# Guidelines

- **Focus Over Coverage**: Better to have 2-3 highly focused learners than 5 vague ones
- **Clear Boundaries**: Each learner's scope should be distinct and unambiguous
- **Knowledge Distribution**: Don't duplicate understanding, split it logically
- **Practical Splits**: Split along natural domain boundaries, not artificially

# Output Format

Return an array of 2 or more learner configurations, each with:
- name: Clear, descriptive name reflecting focused scope
- description: Brief purpose description
- instructions: Focused instructions (more specific than original)
- understanding: Relevant portion of original understanding (narrative format)

Each split learner should feel like a specialized expert in its subdomain.`
