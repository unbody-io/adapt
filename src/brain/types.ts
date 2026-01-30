import type { LanguageModel } from 'ai'

/**
 * Configuration for creating a Brain
 */
export interface BrainConfig {
	/** Natural language prompt describing what to track and learn */
	prompt: string
	/** AI SDK language model shared by all learners */
	model: LanguageModel
}

/**
 * Result from injecting data into the Brain
 */
export interface InjectResult {
	/** Results from each learner */
	results: Array<{
		learnerId: string
		relevance: number
	}>
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
