/**
 * Types for the Evaluator component (Living Brain)
 */

/**
 * Evolution action types
 */
export const EVOLUTION_ACTIONS = {
	create: 'create',
	merge: 'merge',
	split: 'split',
	update: 'update',
	delete: 'delete',
} as const

/**
 * Evolution action type union
 */
export type EvolutionAction =
	(typeof EVOLUTION_ACTIONS)[keyof typeof EVOLUTION_ACTIONS]

/**
 * Signal from a learner or external source
 */
export interface Signal {
	source: string
	description: string
	timestamp: Date
	bypass?: boolean
	metrics?: {
		dismissalRate?: number
		avgRelevance?: number
		avgConfidence?: number
		gapCount?: number
		bufferCount?: number
		activation?: number
		observationsSinceLastSynthesis?: number
		severity?: 'minor' | 'moderate' | 'severe'
	}
}

/**
 * Evolution decision from Evaluator
 */
export interface EvolutionDecision {
	action: EvolutionAction
	reasoning: string
	guidance: string
	targets: string[]
}

/**
 * Learner context for evaluation
 */
export interface LearnerContext {
	id: string
	name: string
	purpose: string
	understandingSize: number
	health: {
		activation: number
		status: string
		lastAccessed: Date
	}
	metrics: {
		queryCount: number
		dismissalRate: number
		synthesisCount: number
		observationsSinceLastSynthesis: number
	}
}

/**
 * Full evaluation context (brain + learners)
 */
export interface EvaluationContext {
	brain: {
		prompt: string
		learnerCount: number
	}
	learners: LearnerContext[]
	includeUnderstanding: boolean
}

/**
 * Learner activity data for evaluation investigation
 */
export interface LearnerActivity {
	ingestion: {
		observationCount: number
		dismissalCount: number
		dismissalRate: number
		synthesisCount: number
		observationsSinceLastSynthesis: number
	}
	recentObservations: Array<{ text: string; importance: number }>
}

/**
 * Record of past evaluation decisions (in-memory, capped)
 */
export interface EvolutionHistoryEntry {
	timestamp: Date
	decisions: Array<{
		action: string
		targets: string[]
		reasoning: string
	}>
}

/**
 * Event map for Evaluator
 */
export interface EvaluatorEventMap {
	'evaluator:evaluation:started': {
		signalCount: number
	}
	'evaluator:evaluation:completed': {
		source: 'auto' | 'manual'
		decisionCount: number
		decisions: EvolutionDecision[]
	}
	'evaluator:evaluation:failed': {
		error: string
	}
}
