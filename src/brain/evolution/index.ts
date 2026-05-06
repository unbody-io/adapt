/**
 * Evolution system exports
 */

export { EvolutionActionHandler } from './base-handler'
// Handlers
export { CreateHandler } from './handlers/create'
export { DeleteHandler } from './handlers/delete'
export { MergeHandler } from './handlers/merge'
export { SplitHandler } from './handlers/split'
export { UpdateHandler } from './handlers/update'
export { EvolutionOrchestrator } from './orchestrator'

// Types
export type {
	CreateActionResult,
	DeleteActionResult,
	EvolutionActionResult,
	EvolutionEventMap,
	MergeActionResult,
	SplitActionResult,
	UpdateActionResult,
} from './types'
