/**
 * Strategy functions for understanding maintenance
 *
 * These functions handle post-processing of understanding based on the chosen strategy.
 * They are called after each synthesis to maintain understanding according to strategy rules.
 */

import { generateText, type LanguageModel } from 'ai'
import type { Strategy, TextLearnerMaintenance } from './text-learner.js'
import { estimateTokens } from './utils.js'

/**
 * Context passed to strategy functions
 */
export interface StrategyContext {
	understanding: string
	model: LanguageModel
	config: TextLearnerMaintenance
}

/**
 * Result from a strategy function
 */
export interface StrategyResult {
	understanding: string
	/** Whether the understanding was modified by the strategy */
	modified: boolean
}

/**
 * Strategy function type
 */
export type StrategyFn = (ctx: StrategyContext) => Promise<StrategyResult>

/**
 * Continuous strategy - understanding grows without limits
 * No post-processing needed
 */
const continuous: StrategyFn = async ({ understanding }) => ({
	understanding,
	modified: false,
})

/**
 * Rolling-summary strategy - summarize when understanding exceeds maxTokens
 */
const rollingSummary: StrategyFn = async ({ understanding, model, config }) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	if (currentTokens <= maxTokens) {
		return { understanding, modified: false }
	}

	// Summarize the understanding to fit within limits
	const result = await generateText({
		model,
		prompt: `You are summarizing a learning agent's understanding to fit within token limits.

CURRENT UNDERSTANDING (${currentTokens} tokens, limit is ${maxTokens}):
${understanding}

TASK:
Summarize this understanding to approximately ${Math.floor(maxTokens * 0.7)} tokens.
Preserve the most important patterns, recent observations, and critical insights.
Output ONLY the summarized understanding, nothing else.`,
	})

	return {
		understanding: result.text.trim(),
		modified: true,
	}
}

/**
 * Temporal-layers strategy - compress historical sections periodically
 */
const temporalLayers: StrategyFn = async ({ understanding, model, config }) => {
	const maxTokens = config.maxTokens ?? 4000
	const currentTokens = estimateTokens(understanding)

	// Only compress if we're approaching the limit
	if (currentTokens <= maxTokens * 0.8) {
		return { understanding, modified: false }
	}

	// Compress the temporal layers
	const result = await generateText({
		model,
		prompt: `You are compressing a learning agent's temporal-layered understanding.

CURRENT UNDERSTANDING:
${understanding}

TASK:
The understanding should have three temporal sections:
- Current State: What's true right now (keep detailed)
- Recent Developments: What changed recently (moderate detail)
- Historical Context: Long-standing patterns (compress heavily)

Compress the Historical Context section significantly while preserving key patterns.
Move older items from Recent Developments to Historical Context.
Keep Current State detailed.

Target approximately ${Math.floor(maxTokens * 0.7)} tokens total.
Output ONLY the restructured understanding with the three sections clearly labeled.`,
	})

	return {
		understanding: result.text.trim(),
		modified: true,
	}
}

/**
 * Map of strategy names to their implementation functions
 */
export const strategyFunctions: Record<Strategy, StrategyFn> = {
	continuous,
	'rolling-summary': rollingSummary,
	'temporal-layers': temporalLayers,
}

/**
 * Apply the appropriate strategy to maintain understanding
 */
export async function applyStrategy(ctx: StrategyContext): Promise<StrategyResult> {
	const fn = strategyFunctions[ctx.config.strategy]
	return fn(ctx)
}
