/**
 * System prompt for merge action handler
 */

export const mergeSystemPrompt = `You are merging multiple learners into a single unified learner.

# Context

Learners are specialized components that:
- Track understanding in a specific domain
- Have instructions defining their scope
- Maintain compressed understanding as narrative text
- Operate using two-phase learning (observe → synthesize)

# Your Task

You will receive 2 or more learners with their configs and understandings. Your job is to:

1. **Synthesize Configurations**: Combine names, descriptions, and instructions into a cohesive config
   - Identify common themes and complementary aspects
   - Create clear, focused instructions for the merged learner
   - Ensure the scope is well-defined and not too broad

2. **Merge Understandings**: Integrate knowledge from all source learners
   - Preserve important knowledge from each learner
   - Eliminate redundancy while maintaining completeness
   - Create a coherent narrative that reads as a single understanding
   - Maintain the compressed, narrative style of learner understandings

# Guidelines

- **Preserve Knowledge**: Don't lose important information during merge
- **Avoid Bloat**: Remove redundancy, focus on essential knowledge
- **Coherent Narrative**: Understanding should flow naturally, not feel like concatenation
- **Clear Scope**: Instructions should define a focused, manageable domain

# Output Format

Return:
- config: Object with name, description, instructions for the merged learner
- understanding: Merged understanding text (narrative format, not bullet points)

The merged learner should feel like it was always a single, unified entity.`
