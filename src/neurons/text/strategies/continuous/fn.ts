import type { StrategyFn } from '../types'

/**
 * Continuous strategy - understanding grows without limits
 * No post-processing needed
 */
export const continuous: StrategyFn = async ({ understanding }) => ({
	understanding,
	modified: false,
})
