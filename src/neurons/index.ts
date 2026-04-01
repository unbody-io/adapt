// Base
export { BaseNeuron } from './base'
export type {
	AdjustResult,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	UnderstandCallResult,
} from './base'
export type {
	BaseNeuronState,
	ModelSlots,
	StoredModelRef,
	StateTransform,
} from './base'
export type {
	SharedNeuronEventMap,
	EventUsage,
	BaseResolvedConfig,
	BaseNeuronUpdateInput,
	UnderstandThresholds,
} from './base'
export type { QueryOptions, QueryResult } from './base/query'
export { ToolBasedMethod } from './base/query'

// Schemas
export {
	type GeneratedNeuronConfig,
	neuronConfigSchema,
} from './schema.config'

// Store (re-exported from stores/)
export type {
	NeuronStore,
	NeuronCollection,
	ObservationRecord,
	UnderstandingRecord,
	EvolutionRecord,
	StateRecord,
} from '../stores'
export { MemoryNeuronStore, MemoryNeuronCollection } from '../stores'

// TextNeuron
export { TextNeuron } from './text'
export type {
	TextNeuronConfig,
	TextNeuronEvent,
	TextNeuronEventMap,
	TextGovernanceConfig,
	ResolvedGovernanceConfig,
	ResolvedTextNeuronConfig,
	TextNeuronUpdateResult,
} from './text'

export type {
	GovernanceConfig,
	Strategy,
	StrategyContext,
	StrategyFn,
	StrategyResult,
} from './text/strategies'
export {
	applyStrategy,
	STRATEGIES,
	strategyFunctions,
	strategyPrompts,
} from './text/strategies'

// ListNeuron
export { ListNeuron } from './list'
export type {
	ListItem,
	ListNeuronConfig,
	ListNeuronEvent,
	ListNeuronEventMap,
	ListNeuronUpdateResult,
	ListGovernanceConfig,
	ListOperation,
	ResolvedListNeuronConfig,
	ResolvedListGovernanceConfig,
} from './list'

export type {
	Neuron,
	NeuronHealth,
	NeuronMetadata,
	NeuronOrigin,
	NeuronStatus,
	Significance,
	TokenUsage,
	NeuronTypeDescriptor,
} from './types'

// Descriptors
export { textNeuronDescriptor } from './text/descriptor'
export { listNeuronDescriptor } from './list/descriptor'
