/**
 * Playground shared types
 */

// --- Use Case ---

export type ProviderType = "openrouter" | "ollama" | "lmstudio"

export interface ModelRef {
	provider?: ProviderType
	model: string
}

/** Usecase-level metadata (usecase.json) */
export interface UseCaseInfo {
	id: string
	title: string
	description: string
}

/** Brain config (versioned, configs/*.json) */
export interface BrainConfig {
	prompt: string
	autoSetup?: boolean
	learners?: Array<{
		id: string
		name: string
		type: "text" | "list"
		description: string
		instructions: string
		governance?: Record<string, unknown>
	}>
	/** Default provider for all model slots (default: "openrouter") */
	provider?: ProviderType
	/** Main model — string or { provider, model } */
	model?: string | ModelRef
	/** Blueprint model — string or { provider, model } */
	blueprintModel?: string | ModelRef
	/** Commentator model — string or { provider, model } */
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
	/** App-level batch size: how many items to pass to brain.inject() per call */
	appBatchSize?: number
	/** Optional persistent storage — when set, Brain uses SQLite instead of memory */
	storage?: {
		path: string
	}
}

/** Combined config used internally by the server */
export interface UseCaseConfig extends UseCaseInfo, BrainConfig {
	/** Config version name (derived from filename) */
	version?: string
	/** All available version names for this usecase */
	versions?: string[]
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

// --- SSE ---

export type SSESender = (event: string, data: unknown) => void
