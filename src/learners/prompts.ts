import { generateText, type LanguageModel } from 'ai'
import type { Strategy } from './text-learner.js'

/**
 * Strategy-specific base prompts
 *
 * These define how understanding should be structured and maintained
 * based on the chosen strategy.
 */

export const STRATEGY_PROMPTS: Record<Strategy, string> = {
	continuous: `You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.`,

	'rolling-summary': `You maintain understanding within a size limit. When understanding gets large,
you'll be asked to summarize it. The next understanding cycle starts fresh,
seeded only with that summary. Optimize for information density.
Each cycle is self-contained - don't reference "previous" understanding.`,

	'temporal-layers': `Structure your understanding into temporal sections:
- Current State: What's true right now
- Recent Developments: What changed in the last few observations
- Historical Context: Long-standing patterns, compressed over time

When updating, promote recent → historical and compress older sections.
Recency matters - recent observations get more detail than old ones.`,
}

/**
 * System defaults that apply to all strategies
 */
export const SYSTEM_DEFAULTS = `
EVOLUTION TRACKING:
When you synthesize, you must also provide an evolution entry:
- summary: Brief description of what changed and why
- significance: Assess the importance
  - "routine" — normal refinement of existing understanding
  - "notable" — new pattern or meaningful shift
  - "critical" — a watched condition from instructions was triggered

SIGNIFICANCE ASSESSMENT:
- If a "Watch for" condition in instructions was triggered → critical
- If this is a new pattern or meaningful shift in understanding → notable
- Otherwise → routine
`

/**
 * Configuration for synthesizing a system prompt
 */
export interface SynthesizePromptConfig {
	model: LanguageModel
	strategy: Strategy
	instructions: string
}

/**
 * Result of system prompt synthesis
 */
export interface SynthesizePromptResult {
	systemPrompt: string
}

/**
 * Synthesize an optimal system prompt by combining strategy requirements
 * with user instructions using an LLM.
 *
 * The LLM intelligently:
 * - Keeps user intent (what to track, what to watch for)
 * - Ignores user formatting that conflicts with strategy structure
 * - Merges strategy requirements with user instructions
 * - Removes duplicates and resolves conflicts
 */
export async function synthesizeSystemPrompt(
	config: SynthesizePromptConfig,
): Promise<SynthesizePromptResult> {
	const { model, strategy, instructions } = config

	const strategyPrompt = STRATEGY_PROMPTS[strategy]

	const metaPrompt = `You are a prompt engineer. Your task is to synthesize an optimal system prompt for a learning agent.

INPUTS:
1. Strategy requirements (MUST be followed):
${strategyPrompt}

2. User instructions (extract INTENT, may ignore formatting):
${instructions}

3. System defaults (MUST be included):
${SYSTEM_DEFAULTS}

YOUR TASK:
Create a unified system prompt that:
1. Incorporates all strategy requirements exactly
2. Extracts the user's INTENT from their instructions:
   - What to understand/track
   - What conditions to watch for
   - What questions to answer over time
3. IGNORES any user formatting directives that conflict with strategy structure
   - Example: User says "structure as bullet points" but strategy is temporal-layers → ignore
   - Example: User says "track mood changes" → keep (this is intent, not formatting)
4. Includes all system defaults
5. Is clear, concise, and non-redundant

OUTPUT:
Return ONLY the synthesized system prompt, nothing else. No explanation, no preamble.`

	const result = await generateText({
		model,
		prompt: metaPrompt,
	})

	return {
		systemPrompt: result.text.trim(),
	}
}
