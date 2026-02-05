/**
 * Types for Evolution Action Handlers (Living Brain)
 */

/**
 * Result of a create action
 */
export interface CreateActionResult {
	newLearnerIds: string[]
}

/**
 * Result of a merge action
 */
export interface MergeActionResult {
	newLearnerIds: string[]
	deletedLearnerIds: string[]
}

/**
 * Result of a split action
 */
export interface SplitActionResult {
	newLearnerIds: string[]
	deletedLearnerIds: string[]
}

/**
 * Result of an update action
 */
export interface UpdateActionResult {
	updatedLearnerIds: string[]
}

/**
 * Result of a delete action
 */
export interface DeleteActionResult {
	deletedLearnerIds: string[]
}

/**
 * Union of all action results
 */
export type EvolutionActionResult =
	| CreateActionResult
	| MergeActionResult
	| SplitActionResult
	| UpdateActionResult
	| DeleteActionResult

/**
 * Aggregated result from executing multiple evolution decisions
 */
export interface AggregatedEvolutionResult {
	created: string[]
	updated: string[]
	deleted: string[]
	merged: string[]
	split: string[]
}

/**
 * Event map for Evolution actions
 */
export interface EvolutionEventMap {
	'evolution:action:started': {
		action: string
		targets: string[]
		timestamp: Date
	}
	'evolution:action:executed': {
		action: string
		reasoning: string
		guidance: string
		targets: string[]
		timestamp: Date
		result: EvolutionActionResult
	}
	'evolution:action:failed': {
		action: string
		targets: string[]
		error: string
		timestamp: Date
	}
}
