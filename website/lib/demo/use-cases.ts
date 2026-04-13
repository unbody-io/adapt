/**
 * Use case configs — mirrors playground's BrainConfig type structure
 */

export type ModelRef = { provider?: string; model: string }

export interface UseCase {
	id: string
	title: string
	description: string
	prompt: string
	autoSetup?: boolean
	/** Default provider for all model slots */
	provider?: string
	/** Main model — string or { provider, model } */
	model?: string | ModelRef
	/** Blueprint model — string or { provider, model } */
	blueprintModel?: string | ModelRef
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
	/** Estimated duration label, e.g. "~3 min" */
	duration?: string
	dataPaths: string[]
}

export const USE_CASES: UseCase[] = [
	{
		id: "daily-standups",
		title: "Daily Standups",
		description: "Watch a Brain learn from standup meeting transcripts — discovering team dynamics, projects, and patterns.",
		prompt: "You are learning from daily standup transcripts of a software team. You start knowing nothing — everything must be discovered from the data.\n\nPrioritize specialization over generalization. Create dedicated specialists for each distinct thing you discover — individual team members, projects, dynamics, cultural signals — rather than lumping things together. If two things could be separate specialists, they should be.\n\nLet understanding build incrementally. Follow the data.",
		model: "google/gemini-3.1-flash-lite-preview",
		autoSetup: true,
		ingest: { batchSize: 3 },
		appBatchSize: 10,
		duration: "~3 min",
		learning: {
			understand: {
				thresholds: {
					maxObservations: 5,
					minImportance: 0.1,
				},
			},
		},
		evolution: {
			enabled: true,
			autoEvaluate: true,
			evaluatorSignalThreshold: 5,
			model: "x-ai/grok-4.1-fast",
		},
		dataPaths: [
			"/demo/data/daily-standups/2026-02-25.json",
			// "/demo/data/daily-standups/2026-03-04.json",
			// "/demo/data/daily-standups/2026-03-10.json",
		],
	},
	{
		id: "product-feedback",
		title: "Product Feedback",
		description: "Watch a Brain learn from multi-channel feedback — tweets, support tickets, and app reviews.",
		prompt: "You are learning from product feedback across multiple channels. You start knowing nothing — let the data guide you.",
		model: "google/gemini-3.1-flash-lite-preview",
		autoSetup: true,
		ingest: { batchSize: 3 },
		duration: "~1 min",
		learning: {
			understand: {
				thresholds: {
					maxObservations: 2,
					minImportance: 0.1,
				},
			},
		},
		evolution: {
			enabled: true,
			autoEvaluate: false,
			evaluatorSignalThreshold: 5,
			model: "x-ai/grok-4.1-fast",
		},
		dataPaths: [
			"/demo/data/product-feedback/tweets.json",
			"/demo/data/product-feedback/support-tickets.json",
			"/demo/data/product-feedback/app-reviews.json",
		],
	},
]
