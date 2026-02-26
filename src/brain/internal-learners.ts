/**
 * Internal learner definitions — fixed learners Brain creates for self-knowledge.
 *
 * Each definition is a GeneratedLearnerConfig with a fixed ID prefix (__internal_).
 * Brain creates these during init and stores refs in store.internalLearners.
 */

import type { GeneratedLearnerConfig } from '../learners/schema.config'
import type { InternalLearnersConfig, LearningConfig } from './types'

// ── Internal Learner IDs ────────────────────────────────────────────────────

export const INTERNAL_LEARNER_IDS = {
	globalInjectionUnderstanding: '__internal_global_injection_understanding',
	globalQueryUnderstanding: '__internal_global_query_understanding',
	injectionGaps: '__internal_injection_gaps',
	queryGaps: '__internal_query_gaps',
} as const

// ── Consult Tool Names (used in ask synthesis) ──────────────────────────────

export const CONSULT_TOOL_NAMES = {
	[INTERNAL_LEARNER_IDS.globalInjectionUnderstanding]: 'consultGlobalUnderstanding',
	[INTERNAL_LEARNER_IDS.globalQueryUnderstanding]: 'consultQueryPatterns',
	[INTERNAL_LEARNER_IDS.injectionGaps]: 'consultInjectionGaps',
	[INTERNAL_LEARNER_IDS.queryGaps]: 'consultQueryGaps',
} as const

// ── Definitions ─────────────────────────────────────────────────────────────

interface InternalLearnerDef {
	key: keyof InternalLearnersConfig
	config: GeneratedLearnerConfig
}

const definitions: InternalLearnerDef[] = [
	{
		key: 'globalInjectionUnderstanding',
		config: {
			id: INTERNAL_LEARNER_IDS.globalInjectionUnderstanding,
			name: 'Global Injection Understanding',
			description: 'Cross-domain understanding synthesized from all external learner knowledge',
			type: 'text',
			instructions: `Build a cross-domain understanding of everything the system has learned from ingested data.

Watch for:
- Connections and patterns that span multiple learners/domains
- Overarching themes and tensions across different knowledge areas
- Emerging trends that no single learner can see on its own

Track answers to:
- What are the major cross-domain patterns?
- Where do different knowledge areas reinforce or contradict each other?
- What meta-level insights emerge from combining all learner knowledge?`,
			governance: { strategy: 'decay', maxTokens: 16000 },
		},
	},
	{
		key: 'globalQueryUnderstanding',
		config: {
			id: INTERNAL_LEARNER_IDS.globalQueryUnderstanding,
			name: 'Global Query Understanding',
			description: 'Tracks what users ask — query topics, frequency, clusters, and coverage gaps',
			type: 'list',
			instructions: `Track and categorize all user queries to understand what information users need.

Watch for:
- Recurring query topics and themes
- Clusters of related questions
- Questions that no learner could answer well
- Shifts in query patterns over time

Track answers to:
- What topics do users ask about most frequently?
- What query clusters exist and how are they related?
- Where are the coverage gaps between what users ask and what the system knows?`,
		},
	},
	{
		key: 'injectionGaps',
		config: {
			id: INTERNAL_LEARNER_IDS.injectionGaps,
			name: 'Injection Gap Learner',
			description: 'Tracks data that no external learner could process — injection gaps',
			type: 'text',
			instructions: `You are a cross-domain, general-purpose gap tracker. You are NOT limited to any specific subject area — you track gaps from ALL topics and domains.

You receive reports about data that was rejected by all specialized learners in the system. These reports describe what topics were dismissed. EVERY item you receive is relevant by definition — never dismiss it.

Each report includes a timestamp. Use timestamps to track recency and frequency.

Track:
- What topic domains are appearing as gaps, and when (most recent date)
- How frequently each domain appears
- Clusters of related gap topics
- What new learner(s) would be needed to cover these domains

Drop topics that haven't appeared recently — if a gap stops being reported, it's likely been resolved.`,
			governance: { strategy: 'decay', maxTokens: 8000 },
		},
	},
	{
		key: 'queryGaps',
		config: {
			id: INTERNAL_LEARNER_IDS.queryGaps,
			name: 'Query Gap Learner',
			description: 'Tracks questions that external learners could not answer well',
			type: 'text',
			instructions: `Accumulate and reason about query gaps — questions that users ask but no learner can answer well.

Watch for:
- Questions where all learners have low relevance
- Recurring unanswerable topics
- Patterns in the types of knowledge gaps

Track answers to:
- What questions are consistently unanswerable?
- Are there topic clusters of unanswerable questions?
- What knowledge would need to be acquired to close these gaps?`,
			governance: { strategy: 'cumulative', maxTokens: 8000 },
		},
	},
]

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Returns configs for all enabled internal learners.
 * Merges user-provided LearningConfig overrides into each definition.
 */
export function getInternalLearnerConfigs(
	internalLearnersConfig?: InternalLearnersConfig,
): GeneratedLearnerConfig[] {
	const configs: GeneratedLearnerConfig[] = []

	for (const def of definitions) {
		const toggle = internalLearnersConfig?.[def.key] ?? true // enabled by default

		if (toggle === false) continue

		if (toggle === true) {
			configs.push(def.config)
		} else {
			// Merge user overrides into the default config
			const overrides = toggle as Partial<LearningConfig>
			configs.push({
				...def.config,
				governance: overrides.governance
					? { ...def.config.governance, ...overrides.governance }
					: def.config.governance,
			})
		}
	}

	return configs
}

/**
 * Check if an ID belongs to an internal learner
 */
export function isInternalLearnerId(id: string): boolean {
	return id.startsWith('__internal_')
}
