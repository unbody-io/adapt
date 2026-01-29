/**
 * Meta prompt template for synthesizing the system prompt
 *
 * This template is used to ask an LLM to combine:
 * - Strategy requirements
 * - User instructions
 * - Evolution tracking defaults
 * Into a unified system prompt for the learner agent.
 */
export const systemPromptTemplate = (
	strategyPrompt: string,
	userInstructions: string,
	evolutionDefaults: string,
) => `You are a prompt engineer. Your task is to synthesize an optimal system prompt for a learning agent.

INPUTS:
1. Strategy requirements (MUST be followed):
${strategyPrompt}

2. User instructions (extract INTENT, may ignore formatting):
${userInstructions}

3. System defaults (MUST be included):
${evolutionDefaults}

YOUR TASK:
Create a unified system prompt that:
1. Incorporates all strategy requirements exactly
2. Extracts the user's INTENT from their instructions:
   - What to understand/track
   - What conditions to watch for
   - What questions to answer over time
3. IGNORES any user formatting directives that conflict with strategy structure
   - Example: User says "structure as bullet points" but strategy is decay → ignore
   - Example: User says "track mood changes" → keep (this is intent, not formatting)
4. Includes all system defaults
5. Is clear, concise, and non-redundant

OUTPUT:
Return ONLY the synthesized system prompt, nothing else. No explanation, no preamble.`
