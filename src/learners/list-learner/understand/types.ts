/**
 * Types for the list understand phase
 */

import type { Significance } from '../../types'
import type { ListItem } from '../types'

export interface Usage {
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
}

export type UnderstandOutput =
	| {
			status: 'synthesized'
			newItems: ListItem[]
			significance: Significance
			evolution: string
			reasoning?: string
			usage?: Usage
	  }
	| { status: 'dismissed'; output: string; usage?: Usage }
	| { status: 'error'; error: unknown }

export interface UnderstandContext {
	learnerId: string
	instructions: string
	currentItems: ListItem[]
	observations: string[]
}

export interface UnderstandCallbacks {
	onThinking?: (thoughts: string[]) => void
}
