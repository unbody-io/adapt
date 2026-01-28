// Core types
export type {
	AskResult,
	EvolutionEntry,
	IngestResult,
	Learner,
	LearnerConfig,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
	LearnerStatus,
	Significance,
} from './types'

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
	TokenUsage,
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
