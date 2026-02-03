/**
 * Evolution system exports
 */

export { EvolutionOrchestrator } from './orchestrator'
export { EvolutionActionHandler } from './base-handler'

// Handlers
export { CreateHandler } from './handlers/create'
export { MergeHandler } from './handlers/merge'
export { SplitHandler } from './handlers/split'
export { UpdateHandler } from './handlers/update'
export { DeleteHandler } from './handlers/delete'

// Types
export type {
	CreateActionResult,
	MergeActionResult,
	SplitActionResult,
	UpdateActionResult,
	DeleteActionResult,
	EvolutionActionResult,
	EvolutionEventMap,
} from './types'
