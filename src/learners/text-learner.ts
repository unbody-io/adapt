import type { LanguageModel } from 'ai'
import { createLearnerAgent, type LearnerAgent } from './agent.js'
import type { CompleteParams, SynthesizeParams } from './tools/schemas.js'
import type {
	Learner,
	LearnerConfig,
	LearnerGovernance,
	LearnerMetadata,
	LearnerOrigin,
	OnDataResult,
	OnQueryResult,
} from './types.js'

/**
 * Maintenance configuration for TextLearner
 */
export interface TextLearnerMaintenance {
	strategy: 'summarize' | 'truncate'
	maxTokens: number
}

/**
 * Configuration for creating a TextLearner
 */
export type TextLearnerConfig = LearnerConfig<TextLearnerMaintenance>

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * The most common learner type. Understanding is stored as a free text blob
 * that gets updated through data processing and queried for insights.
 */
export class TextLearner implements Learner<string> {
	readonly id: string
	readonly purpose: string
	readonly origin: LearnerOrigin

	private understanding = ''
	private governance: LearnerGovernance
	private agent: LearnerAgent
	// TODO: Implement maintenance (compression/summarization when understanding exceeds maxTokens)
	private _maintenance: TextLearnerMaintenance

	constructor(config: TextLearnerConfig, model: LanguageModel) {
		this.id = config.id ?? crypto.randomUUID()
		this.purpose = config.purpose
		this.origin = config.origin ?? 'developer'
		this._maintenance = config.maintenance ?? {
			strategy: 'summarize',
			maxTokens: 4000,
		}

		this.governance = {
			activation: 0,
			threshold: 0.3,
			status: 'dormant',
			lastAccessed: new Date(),
			retrievalCount: 0,
			successRate: 0,
		}

		this.agent = createLearnerAgent(model)
	}

	/**
	 * Get the current understanding (narrative text)
	 */
	getUnderstanding(): string {
		return this.understanding
	}

	/**
	 * Get the maintenance configuration
	 */
	getMaintenance(): TextLearnerMaintenance {
		return { ...this._maintenance }
	}

	/**
	 * Get a copy of the governance state
	 */
	getGovernance(): LearnerGovernance {
		return { ...this.governance }
	}

	/**
	 * Process a batch of data and update understanding
	 *
	 * The agent analyzes the data in relation to its purpose,
	 * then synthesizes an updated understanding.
	 */
	async onData(batch: unknown[]): Promise<OnDataResult> {
		const result = await this.agent.generate({
			prompt: 'Process the provided data batch.',
			options: {
				operation: 'data',
				understanding: this.understanding,
				purpose: this.purpose,
				input: batch,
			},
		})

		// Extract structured output from done tool (synthesize)
		// staticToolCalls contains tool calls that weren't executed (done tools)
		const synthesizeCall = result.staticToolCalls.find(
			(call) => call.toolName === 'synthesize',
		)

		if (synthesizeCall) {
			const input = synthesizeCall.input as SynthesizeParams
			this.understanding = input.newUnderstanding
			const relevance = input.relevance

			// Update governance
			this.updateGovernance(relevance)

			return { relevance }
		}

		return { relevance: 0 }
	}

	/**
	 * Handle a query and return insights from understanding
	 *
	 * The agent generates a response based on its understanding
	 * and identifies any gaps in what it couldn't answer.
	 */
	async onQuery(query: string): Promise<OnQueryResult> {
		this.governance.lastAccessed = new Date()
		this.governance.retrievalCount++

		const result = await this.agent.generate({
			prompt: query,
			options: {
				operation: 'query',
				understanding: this.understanding,
				purpose: this.purpose,
				input: query,
			},
		})

		// Extract structured output from done tool (complete)
		// staticToolCalls contains tool calls that weren't executed (done tools)
		const completeCall = result.staticToolCalls.find(
			(call) => call.toolName === 'complete',
		)

		if (completeCall) {
			const input = completeCall.input as CompleteParams
			return {
				relevant: input.relevant,
				confidence: input.confidence,
				insight: input.insight,
				gaps: input.gaps,
			}
		}

		return {
			relevant: false,
			confidence: 0,
			insight: '',
			gaps: ['Failed to process query'],
		}
	}

	/**
	 * Get a human-readable summary of current understanding
	 */
	getSummary(): string {
		return this.understanding || '(no understanding yet)'
	}

	/**
	 * Get learner metadata including governance state
	 */
	getMetadata(): LearnerMetadata {
		return {
			id: this.id,
			purpose: this.purpose,
			origin: this.origin,
			governance: this.getGovernance(),
		}
	}

	/**
	 * Update governance based on relevance of processed data
	 *
	 * Uses exponential moving average to smooth activation changes
	 */
	private updateGovernance(relevance: number): void {
		// EMA: weight recent relevance at 20%
		this.governance.activation =
			this.governance.activation * 0.8 + relevance * 0.2

		// Update status based on threshold
		if (this.governance.activation >= this.governance.threshold) {
			this.governance.status = 'active'
		}

		this.governance.lastAccessed = new Date()
	}
}
