/**
 * Types for the text understand phase
 */

import type { Significance } from '../../types'

export interface Usage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

export type UnderstandOutput =
	| {
			status: 'synthesized'
			newUnderstanding: string
			significance: Significance
			evolution: string
			reasoning?: string
			usage?: Usage
	  }
	| { status: 'dismissed'; output: string; usage?: Usage }
	| { status: 'error'; output: null; error: unknown }

export interface UnderstandContext {
	learnerId: string
	instructions: string
	currentUnderstanding: string
	observations: string[]
}

export interface UnderstandCallbacks {
	onThinking?: (thoughts: string[]) => void
}
