import { generateText, type LanguageModel, Output } from 'ai'
import { TextLearner, type GeneratedLearnerConfig } from '../learners'
import {
	createSynthesisAgent,
	type SynthesisAgent,
	type SynthesizeParams,
} from './agent'
import { learnerConfigsPromptTemplate } from './prompts/prompt.template.learner-configs'
import { learnerConfigsSchema } from './schemas/schema.learner-configs'
import type { BrainAskResult, BrainConfig, InjectResult } from './types'

/**
 * Brain - A learning system that auto-generates and coordinates multiple learners
 *
 * Brain takes a natural language prompt and decomposes it into specialized learners.
 * Data injection routes to all learners, and queries synthesize responses from all learners.
 */
export class Brain {
	readonly prompt: string
	private model: LanguageModel
	private learners: Map<string, TextLearner> = new Map()
	private learnerNames: Map<string, string> = new Map()
	private initialized = false
	private synthesisAgent: SynthesisAgent

	constructor(config: BrainConfig) {
		this.prompt = config.prompt
		this.model = config.model
		this.synthesisAgent = createSynthesisAgent(config.model)
	}

	/**
	 * Explicitly initialize the Brain (parse prompt and generate learners)
	 * Called automatically on first inject() or ask() if not called explicitly.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		const result = await generateText({
			model: this.model,
			prompt: learnerConfigsPromptTemplate(this.prompt),
			output: Output.object({ schema: learnerConfigsSchema }),
		})

		if (!result.output) {
			throw new Error('Failed to generate learner configurations')
		}

		for (const config of result.output.learners) {
			this.createLearnerFromConfig(config)
		}

		this.initialized = true
	}

	/**
	 * Create a TextLearner from a generated config
	 */
	private createLearnerFromConfig(config: GeneratedLearnerConfig): TextLearner {
		const learner = new TextLearner({
			id: config.id,
			model: this.model,
			instructions: config.instructions,
			origin: 'prompt',
			maintenance: config.maintenance,
		})

		this.learners.set(config.id, learner)
		this.learnerNames.set(config.id, config.name)

		return learner
	}

	/**
	 * Ensure Brain is initialized before operations
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}
	}

	/**
	 * Add a learner manually
	 */
	addLearner(config: GeneratedLearnerConfig): TextLearner {
		return this.createLearnerFromConfig(config)
	}

	/**
	 * Get all learners
	 */
	getLearners(): TextLearner[] {
		return Array.from(this.learners.values())
	}

	/**
	 * Get a specific learner by ID
	 */
	getLearner(id: string): TextLearner | undefined {
		return this.learners.get(id)
	}

	/**
	 * Inject data into all learners
	 *
	 * Data is sent to ALL learners. Each processes independently.
	 */
	async inject(data: unknown | unknown[]): Promise<InjectResult> {
		await this.ensureInitialized()

		const batch = Array.isArray(data) ? data : [data]
		const learnerArray = this.getLearners()

		const results = await Promise.all(
			learnerArray.map(async (learner) => {
				const result = await learner.ingest(batch)
				return {
					learnerId: learner.id,
					relevance: result.relevance,
				}
			}),
		)

		return { results }
	}

	/**
	 * Ask all learners and synthesize a unified response
	 *
	 * Query is sent to ALL learners. Responses are synthesized via LLM.
	 */
	async ask(query: string): Promise<BrainAskResult> {
		await this.ensureInitialized()

		const learnerArray = this.getLearners()

		// Query all learners in parallel
		const learnerResults = await Promise.all(
			learnerArray.map(async (learner) => {
				const result = await learner.ask(query)
				return {
					learnerId: learner.id,
					name: this.learnerNames.get(learner.id) ?? learner.id,
					relevant: result.relevant,
					confidence: result.confidence,
					insight: result.insight,
					gaps: result.gaps,
				}
			}),
		)

		// Build sources from relevant responses
		const sources = learnerResults
			.filter((r) => r.relevant)
			.map((r) => ({
				learnerId: r.learnerId,
				confidence: r.confidence,
				insight: r.insight,
			}))

		// Synthesize responses
		const synthesisResult = await this.synthesisAgent.generate({
			prompt: query,
			options: {
				query,
				brainPrompt: this.prompt,
				responses: learnerResults,
			},
		})

		// Extract synthesized output from done tool
		const synthesizeCall = synthesisResult.staticToolCalls.find(
			(call) => call.toolName === 'synthesize',
		)

		if (!synthesizeCall) {
			// Fallback if synthesis failed
			const allGaps = learnerResults.flatMap((r) => r.gaps)
			return {
				insight: 'Unable to synthesize response from learners.',
				sources,
				gaps: [...new Set(allGaps)],
			}
		}

		const synthesis = synthesizeCall.input as SynthesizeParams

		return {
			insight: synthesis.insight,
			sources,
			gaps: synthesis.gaps,
		}
	}
}
