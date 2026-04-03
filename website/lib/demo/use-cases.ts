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
	appBatchSize?: number
	dataPaths: string[]
}

export const USE_CASES: UseCase[] = [
	{
		id: "daily-standups",
		title: "Daily Standups",
		description: "Watch a Brain learn from standup meeting transcripts — discovering team dynamics, projects, and patterns.",
		prompt: "Learn from daily standup transcripts of a software team. Discover team members, projects, and dynamics — start with no assumptions.\n\nKeep it lean and focused.",
		model: "google/gemini-3.1-flash-lite-preview",
		autoSetup: true,
		ingest: { batchSize: 3 },
		appBatchSize: 10,
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
			evaluatorSignalThreshold: 3,
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
		prompt: "Track product feedback for a B2B SaaS tool across support tickets, social media, and app reviews. Identify recurring themes, sentiment patterns, and emerging issues.\n\nKeep it lean — group related signals together rather than tracking each concern separately.",
		model: "google/gemini-3.1-flash-lite-preview",
		autoSetup: true,
		ingest: { batchSize: 3 },
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
			autoEvaluate: true,
			evaluatorSignalThreshold: 5,
		},
		dataPaths: [
			"/demo/data/product-feedback/tweets.json",
			"/demo/data/product-feedback/support-tickets.json",
			"/demo/data/product-feedback/app-reviews.json",
		],
	},
]
