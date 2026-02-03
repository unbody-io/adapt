/**
 * Strategy functions for understanding maintenance
 *
 * These functions handle post-processing of understanding based on the chosen strategy.
 * They are called after each synthesis to maintain understanding according to strategy rules.
 */

export * from './types'

import { continuous, continuousStrategyPrompt } from './continuous'
import { cumulative, cumulativeStrategyPrompt } from './cumulative'
import { decay, decayStrategyPrompt } from './decay'
import type {
	Strategy,
	StrategyContext,
	StrategyFn,
	StrategyResult,
} from './types'

/**
 * Map of strategy names to their implementation functions
 */
export const strategyFunctions: Record<Strategy, StrategyFn> = {
	continuous,
	cumulative,
	decay,
}

/**
 * Map of strategy names to their description prompts
 */
export const strategyPrompts: Record<Strategy, string> = {
	continuous: continuousStrategyPrompt,
	cumulative: cumulativeStrategyPrompt,
	decay: decayStrategyPrompt,
}

/**
 * Apply the appropriate strategy to maintain understanding
 */
export async function applyStrategy(
	ctx: StrategyContext,
): Promise<StrategyResult> {
	const fn = strategyFunctions[ctx.config.strategy]
	return fn(ctx)
}

// Re-export individual strategies for direct access
export { continuous, continuousStrategyPrompt } from './continuous'
export { cumulative, cumulativeStrategyPrompt } from './cumulative'
export { decay, decayStrategyPrompt } from './decay'
