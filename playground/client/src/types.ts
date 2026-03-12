export type ProviderType = "openrouter" | "ollama" | "lmstudio"

export interface ModelRef {
	provider?: ProviderType
	model: string
}

export interface BrainConfig {
	prompt: string
	autoSetup?: boolean
	learners?: Array<{
		id: string
		name: string
		type: "text" | "list"
		description: string
		instructions: string
	}>
	provider?: ProviderType
	model?: string | ModelRef
	blueprintModel?: string | ModelRef
	commentatorModel?: string | ModelRef
	learning?: {
		understand?: {
			thresholds?: {
				maxObservations?: number
				maxTokens?: number
				minImportance?: number
			}
		}
		governance?: {
			strategy?: "continuous" | "cumulative" | "decay"
			maxTokens?: number
		}
	}
	evolution?: {
		enabled?: boolean
		model?: string | ModelRef
		autoEvaluate?: boolean
		evaluatorSignalThreshold?: number
	}
	ingest?: {
		batchSize?: number
	}
	appBatchSize?: number
	storage?: {
		path: string
	}
}

export interface VersionDetail {
	name: string
	provider: string
	model?: string | { provider?: string; model: string }
	inited: boolean
	lastInited: string | null
}

export interface UseCase {
	id: string
	title: string
	description: string
	versions: string[]
	versionDetails: VersionDetail[]
	itemCount: number
}

export interface UseCaseDetail extends UseCase {
	prompt: string
	version: string
	autoSetup?: boolean
	learners?: Array<{
		id: string
		name: string
		type: "text" | "list"
		description: string
		instructions: string
	}>
	dataSources: DataSource[]
}

export interface DataSource {
	id: string
	source: string
	description: string
	items: DataItem[]
}

export interface DataItem {
	id: string
	label: string
	data: Record<string, unknown>
}

export interface LearnerMetrics {
	observations: number
	dismissals: number
	syntheses: number
	queries: number
	lastSynthesisSignificance: string | null
	lastSynthesisEvolution: string | null
}

export interface LearnerHealth {
	activation: number
	status: string
}

export interface Learner {
	id: string
	name: string
	type: string
	description: string
	/** Size of understanding — string length for text, item count for list */
	understandingSize: number
	/** Current activity: what this learner is doing right now */
	activity: "idle" | "observing" | "synthesizing"
	/** Real-time metrics tracked from SSE events */
	metrics: LearnerMetrics
	/** Health status from the brain */
	health: LearnerHealth
}

export interface InjectionProgress {
	batchIndex: number
	batchCount: number
	activeItemIds: Set<string>
	completedItemIds: Set<string>
}

export interface SessionState {
	sessionId: string | null
	status: "idle" | "pending" | "initializing" | "ready" | "error"
	activity: string
	learners: Learner[]
	commentary: string
	events: BrainEvent[]
	injectedIds: Set<string>
	injectionProgress: InjectionProgress | null
}

export interface BrainEvent {
	id: string
	type: string
	payload: Record<string, unknown>
	timestamp: string
}
