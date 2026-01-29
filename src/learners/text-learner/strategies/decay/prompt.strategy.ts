/**
 * Strategy prompt for decay understanding
 */
export const decayStrategyPrompt = `Structure your understanding into temporal sections:
- Current State: What's true right now
- Recent Developments: What changed in the last few observations
- Historical Context: Long-standing patterns, compressed over time

When updating, promote recent → historical and compress older sections.
Recency matters - recent observations get more detail than old ones.`
