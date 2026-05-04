import type { AdaptLLMPlugin, LanguageModel } from '../../../llm'

/**
 * Understanding management strategies
 */
export const STRATEGIES = ['continuous', 'cumulative', 'decay'] as const
export type Strategy = (typeof STRATEGIES)[number]

/**
 * Governance configuration for text understanding management
 */
export interface GovernanceConfig {
	strategy: Strategy
	maxTokens?: number
}

/**
 * Context passed to strategy functions
 */
export interface StrategyContext {
	understanding: string
	llm: AdaptLLMPlugin
	model: LanguageModel
	config: GovernanceConfig
}

/**
 * Result from a strategy function
 */
export interface StrategyResult {
	understanding: string
	modified: boolean
	/** True when cumulative strategy triggers a cycle reset (understanding becomes a seed) */
	cycleReset?: boolean
}

/**
 * Strategy function type
 */
export type StrategyFn = (ctx: StrategyContext) => Promise<StrategyResult>
