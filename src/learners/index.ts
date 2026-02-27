// Base
export { BaseLearner } from './base'
export type {
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	UnderstandCallResult,
} from './base'
export type {
	BaseLearnerState,
	ModelSlots,
	StoredModelRef,
	StateTransform,
} from './base'
export type {
	SharedLearnerEventMap,
	EventUsage,
	BaseResolvedConfig,
	BaseLearnerUpdateInput,
	UnderstandThresholds,
} from './base'
export type { QueryOptions, QueryResult } from './base/query'
export { ToolBasedMethod } from './base/query'

// Schemas
export {
	type GeneratedLearnerConfig,
	learnerConfigSchema,
} from './schema.config'

// Store
export type {
	Store,
	Collection,
	ObservationRecord,
	UnderstandingRecord,
	EvolutionRecord,
	StateRecord,
} from './stores'
export { MemoryStore, MemoryCollection } from './stores'

// TextLearner
export { TextLearner } from './text-learner'
export type {
	TextLearnerConfig,
	TextLearnerEvent,
	TextLearnerEventMap,
	TextGovernanceConfig,
	ResolvedGovernanceConfig,
	ResolvedTextLearnerConfig,
	TextLearnerUpdateResult,
} from './text-learner'

export type {
	GovernanceConfig,
	Strategy,
	StrategyContext,
	StrategyFn,
	StrategyResult,
} from './text-learner/strategies'
export {
	applyStrategy,
	STRATEGIES,
	strategyFunctions,
	strategyPrompts,
} from './text-learner/strategies'

// ListLearner
export { ListLearner } from './list-learner'
export type {
	ListItem,
	ListLearnerConfig,
	ListLearnerEvent,
	ListLearnerEventMap,
	ListLearnerUpdateResult,
	ListGovernanceConfig,
	ListOperation,
	ResolvedListLearnerConfig,
	ResolvedListGovernanceConfig,
} from './list-learner'

export type {
	Learner,
	LearnerHealth,
	LearnerMetadata,
	LearnerOrigin,
	LearnerStatus,
	Significance,
	TokenUsage,
	LearnerTypeDescriptor,
} from './types'

// Descriptors
export { textLearnerDescriptor } from './text-learner/descriptor'
export { listLearnerDescriptor } from './list-learner/descriptor'
