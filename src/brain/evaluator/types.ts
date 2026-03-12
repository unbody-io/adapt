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
	type: string
	instructions: string
	health: {
		activation: number
		status: string
	}
	metrics: {
		observationCount: number
		synthesisCount: number
		dismissalRate: number
		queryCount: number
	}
}

/**
 * Full evaluation context (brain + learners)
 */
export interface EvaluationContext {
	brain: {
		prompt: string
		evolutionContext: string | null
		learnerCount: number
	}
	learners: LearnerContext[]
	dismissedBatchCount: number
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
		reasoning: string
	}
	'evaluator:evaluation:failed': {
		error: string
	}
}
