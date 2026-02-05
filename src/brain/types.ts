import type { LanguageModel } from 'ai'
import type { GeneratedLearnerConfig } from '../learners/schema.config'
import type { Strategy } from '../learners/text-learner/strategies'
import type { TextLearnerEventMap } from '../learners/text-learner/types'
import type { TokenUsage } from '../learners/types'
import type { LearnOutput } from '../learners/text-learner/learning-methods/two-phase/types'
import type {
	CascadableConfig,
	ResolvedCascadableConfig,
} from '../types/config'
import type { EventsFromMap } from '../types/events'

// ─────────────────────────────────────────────────────────────────────────────
// Learning Config (passed to learners)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observe phase configuration
 */
export interface ObservePhaseConfig extends CascadableConfig {}

/**
 * Synthesize phase configuration
 */
export interface SynthesizePhaseConfig extends CascadableConfig {
	thresholds?: {
		maxObservations?: number
		maxTokens?: number
		minImportance?: number
	}
}

/**
 * Query phase configuration
 */
export interface QueryPhaseConfig {
	model?: LanguageModel
	method?: 'tool-based' | 'direct'
}

/**
 * Maintenance configuration
 */
export interface MaintenanceConfig {
	strategy?: Strategy
	maxTokens?: number
}

/**
 * Learning config - applied to all auto-generated learners
 */
export interface LearningConfig extends CascadableConfig {
	observe?: ObservePhaseConfig
	synthesize?: SynthesizePhaseConfig
	query?: QueryPhaseConfig
	maintenance?: MaintenanceConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain Config (input)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Init phase configuration (decomposition)
 */
export interface InitPhaseConfig {
	model?: LanguageModel
}

/**
 * Brain query configuration (ask synthesis)
 */
export interface BrainQueryConfig {
	model?: LanguageModel
}

/**
 * Ingest configuration
 */
export interface IngestConfig {
	batchSize?: number
}

/**
 * Evolution configuration (Living Brain)
 */
export interface EvolutionConfig {
	/** Whether evolution is enabled */
	enabled?: boolean
	/** Number of signals before auto-evaluation */
	evaluatorSignalThreshold?: number
	/** Whether to auto-evaluate when threshold reached */
	autoEvaluate?: boolean
}

/**
 * Configuration for creating a Brain
 */
export interface BrainConfig extends CascadableConfig {
	/** Natural language prompt describing what to track and learn */
	prompt: string
	/** Default model - cascades to all operations */
	model: LanguageModel
	/** Init phase config (decomposition) */
	init?: InitPhaseConfig
	/** Query config (brain.ask synthesis) */
	query?: BrainQueryConfig
	/** Ingest config */
	ingest?: IngestConfig
	/** Learning config (applied to all learners) */
	learning?: LearningConfig
	/** Evolution config (Living Brain) */
	evolution?: EvolutionConfig
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved Brain Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved observe phase config
 */
export interface ResolvedObservePhaseConfig extends ResolvedCascadableConfig {}

/**
 * Resolved synthesize phase config
 */
export interface ResolvedSynthesizePhaseConfig
	extends ResolvedCascadableConfig {
	thresholds: {
		maxObservations: number
		maxTokens: number
		minImportance: number
	}
}

/**
 * Resolved query phase config
 */
export interface ResolvedQueryPhaseConfig {
	model: LanguageModel
	method: 'tool-based' | 'direct'
}

/**
 * Resolved maintenance config
 */
export interface ResolvedMaintenanceConfig {
	strategy: Strategy
	maxTokens: number
}

/**
 * Resolved learning config
 */
export interface ResolvedLearningConfig extends ResolvedCascadableConfig {
	observe: ResolvedObservePhaseConfig
	synthesize: ResolvedSynthesizePhaseConfig
	query: ResolvedQueryPhaseConfig
	maintenance: ResolvedMaintenanceConfig
}

/**
 * Resolved init phase config
 */
export interface ResolvedInitPhaseConfig {
	model: LanguageModel
}

/**
 * Resolved brain query config
 */
export interface ResolvedBrainQueryConfig {
	model: LanguageModel
}

/**
 * Resolved ingest config
 */
export interface ResolvedIngestConfig {
	batchSize: number
}

/**
 * Resolved evolution config
 */
export interface ResolvedEvolutionConfig {
	enabled: boolean
	evaluatorSignalThreshold: number
	autoEvaluate: boolean
}

/**
 * Fully resolved Brain config - all values defined
 */
export interface ResolvedBrainConfig extends ResolvedCascadableConfig {
	prompt: string
	init: ResolvedInitPhaseConfig
	query: ResolvedBrainQueryConfig
	ingest: ResolvedIngestConfig
	learning: ResolvedLearningConfig
	evolution: ResolvedEvolutionConfig
}

/**
 * Options for brain.inject()
 */
export interface BrainInjectOptions {
	/** Custom inject ID. If not provided, auto-generated with inject_ prefix */
	id?: string
}

/**
 * Result from a single learner within a batch
 */
export interface LearnerBatchResult {
	learnerId: string
	result: LearnOutput
}

/**
 * Result from processing a single batch
 */
export interface BatchResult {
	/** Unique batch identifier (batch_xxx) */
	id: string
	/** 0-indexed position within the inject operation */
	index: number
	/** Results from each learner for this batch */
	results: LearnerBatchResult[]
}

/**
 * Result from injecting data into the Brain
 */
export interface BrainInjectResult {
	/** Unique inject identifier (inject_xxx) */
	id: string
	/** Results grouped by batch */
	batches: BatchResult[]
}

/**
 * Result from asking the Brain a question
 */
export interface BrainAskResult {
	/** Synthesized answer integrating all learner insights */
	insight: string
	/** Individual learner responses */
	sources: Array<{
		learnerId: string
		confidence: number
		insight: string
	}>
	/** Aggregated gaps from all learners */
	gaps: string[]
}

/**
 * Learner response for ask synthesis
 */
export interface LearnerResponse {
	learnerId: string
	name: string
	relevant: boolean
	confidence: number
	insight: string
	gaps: string[]
}

/**
 * Brain's own events (not forwarded from learners)
 */
export interface BrainOwnEventMap {
	// Init
	'brain:init:started': Record<string, never>
	'brain:init:config:generating': Record<string, never>
	'brain:init:config:generated': {
		configs: GeneratedLearnerConfig[]
		usage: TokenUsage
	}
	'brain:init:completed': { learnerIds: string[] }
	'brain:init:failed': { error: string }

	// Inject
	'brain:inject:started': {
		injectId: string
		itemCount: number
		batchCount: number
	}
	'brain:inject:batch:started': {
		injectId: string
		batchId: string
		batchIndex: number
		itemCount: number
	}
	'brain:inject:batch:completed': {
		injectId: string
		batchId: string
		batchIndex: number
		results: LearnerBatchResult[]
	}
	'brain:inject:completed': { injectId: string; batches: BatchResult[] }
	'brain:inject:failed': { injectId: string; error: string }

	// Ask
	'brain:ask:started': { queryId: string; query: string }
	'brain:ask:synthesis:started': {
		queryId: string
		learnerResponses: LearnerResponse[]
	}
	'brain:ask:completed': {
		queryId: string
		insight: string
		sources: BrainAskResult['sources']
		gaps: string[]
		usage: TokenUsage
	}
	'brain:ask:failed': { queryId: string; error: string }

	// Learner management
	'brain:learner:added': {
		learnerId: string
		name: string
		instructions: string
	}
	'brain:learner:removed': {
		learnerId: string
	}

	// Signal events (Living Brain)
	'brain:signal:received': {
		source: string
		description: string
		timestamp: Date
	}

	// Evaluator events (Living Brain)
	'evaluator:evaluation:started': {
		signalCount: number
	}
	'evaluator:evaluation:completed': {
		decisionCount: number
		decisions: Array<{
			action: 'create' | 'merge' | 'split' | 'adjust' | 'delete'
			reasoning: string
			guidance: string
			targets: string[]
		}>
	}
	'evaluator:evaluation:failed': {
		error: string
	}

	// Evolution action events (Living Brain)
	'evolution:action:started': {
		action: string
		targets: string[]
		timestamp: Date
	}
	'evolution:action:executed': {
		action: 'create' | 'merge' | 'split' | 'adjust' | 'delete'
		reasoning: string
		guidance: string
		targets: string[]
		timestamp: Date
		result: {
			newLearnerIds?: string[]
			deletedLearnerIds?: string[]
			updatedLearnerIds?: string[]
		}
	}
	'evolution:action:failed': {
		action: string
		targets: string[]
		error: string
		timestamp: Date
	}

	// Brain config update events
	'brain:config:updated': {
		updates: {
			prompt?: string
			model?: import('ai').LanguageModel
			blueprintModel?: import('ai').LanguageModel
			evolution?: {
				enabled?: boolean
				evaluatorSignalThreshold?: number
				autoEvaluate?: boolean
			}
		}
	}
}

/**
 * Combined Brain event map (Brain's own events + forwarded learner events)
 */
export type BrainEventMap = BrainOwnEventMap & TextLearnerEventMap

/**
 * Union type of all Brain events
 */
export type BrainEvent = EventsFromMap<BrainEventMap>
