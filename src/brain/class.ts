import { generateText, Output } from 'ai'
import { nanoid } from 'nanoid'
import { TextLearner, type GeneratedLearnerConfig, type TokenUsage } from '../learners'
import {
	createSynthesisAgent,
	type SynthesisAgent,
	type SynthesizeParams,
} from './agent'
import { learnerConfigsPromptTemplate } from './prompts/prompt.template.learner-configs'
import { learnerConfigsSchema } from './schemas/schema.learner-configs'
import type {
	BrainAskResult,
	BrainConfig,
	BrainEventMap,
	BrainInjectOptions,
	BrainInjectResult,
	ResolvedBrainConfig,
} from './types'
import { TypedEmitter } from '../types/events'
import { resolveBrainConfig } from './config.resolver'

/**
 * Brain - A learning system that auto-generates and coordinates multiple learners
 *
 * Brain takes a natural language prompt and decomposes it into specialized learners.
 * Data injection routes to all learners, and queries synthesize responses from all learners.
 *
 * Emits events for all operations and forwards learner events.
 */
export class Brain extends TypedEmitter<BrainEventMap> {
	readonly prompt: string
	private config: ResolvedBrainConfig
	private learners: Map<string, TextLearner> = new Map()
	private learnerNames: Map<string, string> = new Map()
	private initialized = false
	private synthesisAgent: SynthesisAgent

	constructor(rawConfig: BrainConfig) {
		super()
		this.config = resolveBrainConfig(rawConfig)
		this.prompt = this.config.prompt
		this.synthesisAgent = createSynthesisAgent(this.config.query.model)
	}

	/**
	 * Explicitly initialize the Brain (parse prompt and generate learners)
	 * Called automatically on first inject() or ask() if not called explicitly.
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		this.emit('brain:init:started', {})

		try {
			this.emit('brain:init:config:generating', {})

			const result = await generateText({
				model: this.config.init.model,
				prompt: learnerConfigsPromptTemplate(this.prompt),
				output: Output.object({ schema: learnerConfigsSchema }),
			})

			if (!result.output) {
				const error = 'Failed to generate learner configurations'
				this.emit('brain:init:failed', { error })
				throw new Error(error)
			}

			const usage: TokenUsage = {
				inputTokens: result.usage?.inputTokens ?? 0,
				outputTokens: result.usage?.outputTokens ?? 0,
				totalTokens: result.usage?.totalTokens ?? 0,
			}

			this.emit('brain:init:config:generated', {
				configs: result.output.learners,
				usage,
			})

			for (const config of result.output.learners) {
				await this.createLearnerFromConfig(config)
			}

			this.initialized = true
			this.emit('brain:init:completed', {
				learnerIds: Array.from(this.learners.keys()),
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.emit('brain:init:failed', { error: errorMessage })
			throw error
		}
	}

	/**
	 * Create a TextLearner from a generated config
	 */
	private async createLearnerFromConfig(
		config: GeneratedLearnerConfig,
	): Promise<TextLearner> {
		const { learning } = this.config

		const learner = new TextLearner({
			id: config.id,
			model: learning.model,
			blueprintModel: learning.blueprintModel,
			instructions: config.instructions,
			origin: 'prompt',
			maintenance: config.maintenance,
			observe: {
				model: learning.observe.model,
				blueprintModel: learning.observe.blueprintModel,
			},
			synthesize: {
				model: learning.synthesize.model,
				blueprintModel: learning.synthesize.blueprintModel,
				thresholds: learning.synthesize.thresholds,
			},
			query: {
				model: learning.query.model,
				method: learning.query.method,
			},
		})

		// Forward all learner events through Brain
		learner.on((event) => {
			this.emit(event.type as keyof BrainEventMap, event.payload as never)
		})

		// Initialize the learner (generates observe/synthesize prompts)
		await learner.init()

		this.learners.set(config.id, learner)
		this.learnerNames.set(config.id, config.name)

		this.emit('brain:learner:added', {
			learnerId: config.id,
			name: config.name,
			instructions: config.instructions,
		})

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
	async addLearner(config: GeneratedLearnerConfig): Promise<TextLearner> {
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
	 * Data is batched by batchSize and sent to ALL learners.
	 * Each learner processes independently and may further chunk by token limit.
	 */
	async inject(
		data: unknown | unknown[],
		options?: BrainInjectOptions,
	): Promise<BrainInjectResult> {
		await this.ensureInitialized()

		const injectId = options?.id ?? `inject_${nanoid()}`
		const items = Array.isArray(data) ? data : [data]
		const learnerArray = this.getLearners()

		// Split items into batches by batchSize
		const batchSize = this.config.ingest.batchSize
		const batches: unknown[][] = []
		for (let i = 0; i < items.length; i += batchSize) {
			batches.push(items.slice(i, i + batchSize))
		}

		this.emit('brain:inject:started', {
			injectId,
			itemCount: items.length,
			batchCount: batches.length,
		})

		try {
			// Process batches sequentially
			const batchResults: BrainInjectResult['batches'] = []
			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batch = batches[batchIndex]
				const batchId = `batch_${nanoid()}`

				this.emit('brain:inject:batch:started', {
					injectId,
					batchId,
					batchIndex,
					itemCount: batch.length,
				})

				// Send batch to all learners in parallel
				const learnerResults = await Promise.all(
					learnerArray.map(async (learner) => {
						const result = await learner.learn(batch)
						// Map new LearnOutput to legacy format for Brain events
						const relevance =
							result.status === 'synthesized'
								? 1.0
								: result.status === 'observed'
									? 0.5
									: 0.0
						return {
							learnerId: learner.id,
							chunks: [{ id: `chunk_${nanoid()}`, index: 0, relevance }],
						}
					}),
				)

				this.emit('brain:inject:batch:completed', {
					injectId,
					batchId,
					batchIndex,
					results: learnerResults,
				})

				batchResults.push({
					id: batchId,
					index: batchIndex,
					results: learnerResults,
				})
			}

			this.emit('brain:inject:completed', {
				injectId,
				batches: batchResults,
			})

			return { id: injectId, batches: batchResults }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.emit('brain:inject:failed', { injectId, error: errorMessage })
			throw error
		}
	}

	/**
	 * Ask all learners and synthesize a unified response
	 *
	 * Query is sent to ALL learners. Responses are synthesized via LLM.
	 */
	async ask(query: string): Promise<BrainAskResult> {
		await this.ensureInitialized()

		const queryId = `query_${nanoid()}`
		this.emit('brain:ask:started', { queryId, query })

		try {
			const learnerArray = this.getLearners()

			// Query all learners in parallel
			const learnerResults = await Promise.all(
				learnerArray.map(async (learner) => {
					const result = await learner.query(query)
					return {
						learnerId: learner.id,
						name: this.learnerNames.get(learner.id) ?? learner.id,
						relevant: result.relevant,
						confidence: result.confidence,
						insight: result.insight,
						gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
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

			this.emit('brain:ask:synthesis:started', {
				queryId,
				learnerResponses: learnerResults,
			})

			// Synthesize responses
			const synthesisResult = await this.synthesisAgent.generate({
				prompt: query,
				options: {
					query,
					brainPrompt: this.prompt,
					responses: learnerResults,
				},
			})

			const usage: TokenUsage = {
				inputTokens: synthesisResult.usage?.inputTokens ?? 0,
				outputTokens: synthesisResult.usage?.outputTokens ?? 0,
				totalTokens: synthesisResult.usage?.totalTokens ?? 0,
			}

			// Extract synthesized output from done tool
			const synthesizeCall = synthesisResult.staticToolCalls.find(
				(call) => call.toolName === 'synthesize',
			)

			if (!synthesizeCall) {
				// Fallback if synthesis failed
				const allGaps = learnerResults.flatMap((r) => r.gaps)
				const result = {
					insight: 'Unable to synthesize response from learners.',
					sources,
					gaps: [...new Set(allGaps)],
				}

				this.emit('brain:ask:completed', {
					queryId,
					insight: result.insight,
					sources,
					gaps: result.gaps,
					usage,
				})

				return result
			}

			const synthesis = synthesizeCall.input as SynthesizeParams

			this.emit('brain:ask:completed', {
				queryId,
				insight: synthesis.insight,
				sources,
				gaps: synthesis.gaps,
				usage,
			})

			return {
				insight: synthesis.insight,
				sources,
				gaps: synthesis.gaps,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.emit('brain:ask:failed', { queryId, error: errorMessage })
			throw error
		}
	}
}
