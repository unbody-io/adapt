// Core types
export type {
	AskResult,
	BaseLearnerEvent,
	BaseLearnerEventMap,
	EvolutionEntry,
	IngestResult,
	Learner,
	LearnerConfig,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
	LearnerStatus,
	Significance,
	TokenUsage,
} from './types'

// Schemas
export { learnerConfigSchema, type GeneratedLearnerConfig } from './schema.config'

// TextLearner
export { 
	TextLearner
 } from './text-learner'

export type {
	LearnerEndEvent,
	LearnerInitErrorEvent,
	LearnerInitializedEvent,
	LearnerObserver,
	LearnerStartEvent,
	LearnerStepEvent,
	OnStepCallback,
	TextLearnerConfig,
	TextLearnerMaintenance,
} from './text-learner'

// Strategies
export { 
	applyStrategy, 
	strategyFunctions, 
	strategyPrompts, 
	STRATEGIES 
} from './text-learner/strategies'

export type {
	Strategy,
	StrategyContext,
	StrategyFn,
	StrategyResult,
	MaintenanceConfig,
} from './text-learner/strategies'

// Tools (for extensibility)
export * as tools from './text-learner/tools'
