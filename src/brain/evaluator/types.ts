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
		avgConfidence?: number
		bufferCount?: number
		activation?: number
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
	understandingPreview: string
	governance: {
		activation: number
		status: string
		lastAccessed: Date
		retrievalCount: number
		successRate: number
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
}

/**
 * Event map for Evaluator
 */
export interface EvaluatorEventMap {
	'evaluator:evaluation:started': {
		signalCount: number
	}
	'evaluator:evaluation:completed': {
		decisionCount: number
		decisions: EvolutionDecision[]
	}
	'evaluator:evaluation:failed': {
		error: string
	}
}
