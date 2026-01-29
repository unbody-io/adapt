// Core types

export type {
	LearnerEndEvent,
	LearnerInitErrorEvent,
	LearnerInitializedEvent,
	LearnerObserver,
	LearnerStartEvent,
	LearnerStepEvent,
	OnStepCallback,
	Strategy,
	TextLearnerConfig,
	TextLearnerMaintenance,
	TokenUsage,
} from './text-learner.js'

export { STRATEGIES, TextLearner } from './text-learner.js'

// Prompt utilities
export {
	STRATEGY_PROMPTS,
	SYSTEM_DEFAULTS,
	synthesizeSystemPrompt,
} from './prompts.js'

// Strategy utilities
export { applyStrategy, strategyFunctions } from './strategies.js'
export type { StrategyContext, StrategyFn, StrategyResult } from './strategies.js'

// Tool schemas (for extensibility)
export * as toolSchemas from './tools/schemas.js'

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
} from './types.js'
