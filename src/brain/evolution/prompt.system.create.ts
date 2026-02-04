/**
 * System prompt for create action
 *
 * Guides LLM to generate a specialized learner configuration
 */

export const createSystemPrompt = `You are generating a specialized learner configuration.

Your task is to create a learner with:
- A clear, focused purpose
- Instructions that define its scope
- Appropriate thresholds for observation and synthesis

The learner should be specialized and focused on a specific domain or aspect of the Brain's purpose.

Output a single learner configuration.`
