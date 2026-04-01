/**
 * Types for Evolution Action Handlers (Living Brain)
 */

/**
 * Result of a create action
 */
export interface CreateActionResult {
	newNeuronIds: string[]
}

/**
 * Result of a merge action
 */
export interface MergeActionResult {
	newNeuronIds: string[]
	deletedNeuronIds: string[]
}

/**
 * Result of a split action
 */
export interface SplitActionResult {
	newNeuronIds: string[]
	deletedNeuronIds: string[]
}

/**
 * Result of an update action
 */
export interface UpdateActionResult {
	updatedNeuronIds: string[]
}

/**
 * Result of a delete action
 */
export interface DeleteActionResult {
	deletedNeuronIds: string[]
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
