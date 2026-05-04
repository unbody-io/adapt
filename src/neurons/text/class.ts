import type { AdaptLLMPlugin, LanguageModel } from '../../llm'
import { resolveRuntimeLLM } from '../../llm'
import type { NeuronStore } from '../../stores'
import type { ParentModels } from '../../types/config'
import type { UnderstandCallResult } from '../base/class'
import { BaseNeuron } from '../base/class'
import type { QueryMethod } from '../base/query'
import { DirectMethod, ToolBasedMethod } from '../base/query'
import type { Significance } from '../types'
import { resolveTextNeuronConfig } from './config.resolver'
import {
	buildTextQueryPrompt,
	createReadUnderstandingTool,
} from './query-tools'
import { applyStrategy } from './strategies'
import type { TextNeuronConfig, TextNeuronState } from './types'
import {
	adjustUnderstand,
	adjustUnderstandingContent,
	initUnderstand,
	understand,
} from './understand'

const RESTORE_PLACEHOLDER_MODEL =
	'unknown:placeholder' as unknown as LanguageModel

/**
 * TextNeuron - A learning agent that maintains understanding as narrative text
 *
 * Strategy application is handled in postProcessUnderstanding.
 * Store is injected — caller must provide it.
 */
export class TextNeuron extends BaseNeuron<string, TextNeuronState> {
	get type(): string {
		return 'text'
	}

	constructor(
		rawConfig: TextNeuronConfig & { llm?: AdaptLLMPlugin },
		parentModels?: ParentModels,
	) {
		const config = resolveTextNeuronConfig(rawConfig, parentModels)
		const maxObsForStagnation =
			3 * (config.understand.thresholds.maxObservations ?? 10)
		const llm = resolveRuntimeLLM({
			llm: rawConfig.llm,
			models: [
				config.model,
				config.blueprintModel,
				config.observer.model,
				config.observer.blueprintModel,
				config.understand.model,
				config.understand.blueprintModel,
				config.query.model,
			],
		})

		const initialState: TextNeuronState = {
			instructions: config.instructions,
			name: rawConfig.name || config.id,
			description: rawConfig.description ?? '',
			focus: rawConfig.focus ?? null,
			origin: config.origin,
			models: {
				default: config.model,
				blueprint: config.blueprintModel,
				observer: config.observer.model,
				observer_blueprint: config.observer.blueprintModel,
				understand: config.understand.model,
				understand_blueprint: config.understand.blueprintModel,
				query: config.query.model,
			},
			observe_identity: null,
			observe_prompt: null,
			understand_prompt: null,
			understand_identity: null,
			observation_schema: rawConfig.observationSchema ?? null,
			understanding_schema: rawConfig.understandingSchema ?? null,
			thresholds: {
				maxObservations: config.understand.thresholds.maxObservations,
				maxTokens: config.understand.thresholds.maxTokens,
				minImportance: config.understand.thresholds.minImportance,
			},
			health: {
				activation: 0,
				threshold: 0.3,
				status: 'dormant',
				lastAccessed: new Date(),
				signalThresholds: {
					maxDismissalRate: 0.8,
					minRelevance: 0.3,
					minConfidence: 0.3,
					maxObservationsWithoutSynthesis: maxObsForStagnation,
					...rawConfig.health?.signalThresholds,
				},
			},
			metrics: {
				ingestion: {
					observationCount: 0,
					dismissalCount: 0,
					dismissalRate: 0,
					synthesisCount: 0,
					observationsSinceLastSynthesis: 0,
				},
				query: {
					count: 0,
					relevanceScores: [],
					confidenceScores: [],
					gaps: [],
				},
			},
			stagnation_signal_fired: false,
			dismissal_signal_fired: false,
			governance: config.governance,
			skipObservation: rawConfig.skipObservation ?? false,
		}

		super(config.id, llm, rawConfig.store, initialState)
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	async getUnderstanding(): Promise<string> {
		const record = await this.store.understanding.get('current')
		return record ? (record.data as string) : ''
	}

	async setUnderstanding(understanding: string): Promise<void> {
		const existing = await this.store.understanding.get('current')
		if (existing) {
			await this.store.understanding.update('current', {
				data: understanding,
				metadata_updated_at: new Date().toISOString(),
			})
		} else {
			await this.store.understanding.add({
				id: 'current',
				data: understanding,
				metadata_confidence: 1.0,
				metadata_created_at: new Date().toISOString(),
				metadata_updated_at: new Date().toISOString(),
			})
		}

		this.emit('neuron:understanding:set', {
			neuronId: this.id,
			understanding,
		})
	}

	async getSummary(): Promise<string> {
		const understanding = await this.getUnderstanding()
		return understanding || '(no understanding yet)'
	}

	async hasKnowledge(): Promise<boolean> {
		const record = await this.store.understanding.get('current')
		return !!record?.data
	}

	protected async regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = await initUnderstand(
			this.llm,
			model,
			instructions,
			this.state.governance.strategy,
		)
		await this.setState({
			understand_identity: result.identity,
			understand_prompt: result.systemPrompt,
		} as Partial<TextNeuronState>)
	}

	protected async adjustUnderstandPrompt(
		model: LanguageModel,
		directive: string,
		newInstructions: string,
	): Promise<void> {
		const result = await adjustUnderstand(
			this.llm,
			model,
			directive,
			newInstructions,
			this.state.understand_identity!,
			this.state.governance.strategy,
		)
		await this.setState({
			understand_identity: result.identity,
			understand_prompt: result.systemPrompt,
		} as Partial<TextNeuronState>)
	}

	protected async adjustUnderstanding(
		model: LanguageModel,
		directive: string,
	): Promise<{ evolution: string; significance: Significance }> {
		const currentUnderstanding = await this.getUnderstanding()
		const result = await adjustUnderstandingContent(
			this.llm,
			model,
			directive,
			currentUnderstanding,
			this.state.instructions,
		)

		if (result.status === 'synthesized') {
			const processed = await this.postProcessUnderstanding(
				result.newUnderstanding,
			)
			await this.setUnderstanding(processed)
			return { evolution: result.evolution, significance: result.significance }
		}

		return { evolution: result.evolution, significance: 'routine' }
	}

	protected async callUnderstand(
		model: LanguageModel,
		understanding: string,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			this.llm,
			model,
			this.state.understand_prompt!,
			{
				neuronId: this.id,
				instructions: this.state.instructions,
				currentUnderstanding: understanding,
				observations,
			},
			callbacks,
		)

		if (result.status === 'error') {
			return { status: 'error', error: result.error }
		}
		if (result.status === 'dismissed') {
			return {
				status: 'dismissed',
				output: result.output,
				usage: result.usage,
			}
		}
		return {
			status: 'synthesized',
			newUnderstanding: result.newUnderstanding,
			significance: result.significance,
			evolution: result.evolution,
			reasoning: result.reasoning,
			usage: result.usage,
		}
	}

	protected async postProcessUnderstanding(raw: string): Promise<string> {
		const result = await applyStrategy({
			understanding: raw,
			llm: this.llm,
			model: this.state.models.default,
			config: this.state.governance,
		})
		return result.understanding
	}

	protected createQueryMethod(): QueryMethod {
		return new ToolBasedMethod(this.llm, this.state.models.query, {
			tools: {
				readUnderstanding: createReadUnderstandingTool(
					() => this.getUnderstanding(),
					() => this.getBufferedObservations(),
				),
			},
			buildPrompt: buildTextQueryPrompt,
		})
	}

	protected createDirectQueryMethod(): QueryMethod {
		return new DirectMethod(this.llm, this.state.models.query, {
			getUnderstanding: () => this.getUnderstanding(),
			buildPrompt: (ctx, understanding) =>
				`You are a specialist. Your domain:\n"${ctx.instructions}"\n\n# Your Understanding\n${understanding || '(empty — no knowledge yet)'}\n\nAnswer from your understanding. Be specific — cite data points, counts, dates. If you don't have enough, say so. Don't fabricate.`,
		})
	}

	// ── Schema generation (hardcoded for text) ──────────────────────────────────

	protected async generateSchemas() {
		return {
			observationSchema: {
				type: 'string',
				description: 'Single observation. Concise and factual.',
				minLength: 10,
				maxLength: 500,
			},
			understandingSchema: {
				type: 'string',
				description:
					'Comprehensive prose synthesis. Well-structured narrative.',
				minLength: 100,
				maxLength: 5000,
			},
		}
	}

	// ── Text-specific accessors ────────────────────────────────────────────────

	getObserveIdentity() {
		return this.state.observe_identity
	}

	getUnderstandIdentity() {
		return this.state.understand_identity
	}

	getGovernance() {
		return { ...this.state.governance }
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): Partial<TextNeuronState> {
		const u = updates as Partial<TextNeuronConfig>
		const result: Partial<TextNeuronState> = {}

		if (u.governance) {
			const newGov = { ...this.state.governance }
			if (
				u.governance.strategy !== undefined &&
				u.governance.strategy !== this.state.governance.strategy
			) {
				newGov.strategy = u.governance.strategy
				changedFields.push('governance.strategy')
			}
			if (
				u.governance.maxTokens !== undefined &&
				u.governance.maxTokens !== this.state.governance.maxTokens
			) {
				newGov.maxTokens = u.governance.maxTokens
				changedFields.push('governance.maxTokens')
			}
			result.governance = newGov
		}

		return result
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<TextNeuronConfig>,
	): Promise<{ changedFields: string[] }> {
		return super.update(updates as Record<string, unknown>)
	}

	/**
	 * Construct a fresh TextNeuron and persist its config to the store.
	 * Throws if the store already contains a neuron — use {@link restore}.
	 */
	static async create(
		config: TextNeuronConfig & { llm?: AdaptLLMPlugin },
		parentModels?: ParentModels,
	): Promise<TextNeuron> {
		const neuron = new TextNeuron(config, parentModels)
		await neuron.init({ expect: 'fresh' })
		return neuron
	}

	/**
	 * Restore a previously-persisted TextNeuron from a store.
	 * `input` may be a path string (sugar for SQLiteNeuronStore) or a NeuronStore.
	 * Throws if the store is empty — use {@link create}.
	 *
	 * `runtime` supplies the LLM context the brain needs after restore.
	 *  - `model`: a live AI SDK model (e.g. `openai('gpt-4o')`); covers the common case.
	 *  - `llm`: a full plugin instance — for BYO custom runtimes.
	 *  Both optional. Pass nothing if the same process already cached the live
	 *  model from a prior `create` call (in-memory restore).
	 */
	static async restore(
		input: string | NeuronStore,
		runtime?: { id?: string; model?: LanguageModel; llm?: AdaptLLMPlugin },
	): Promise<TextNeuron> {
		const store = await resolveNeuronStore(input)
		const neuron = new TextNeuron({
			store,
			model: runtime?.model ?? RESTORE_PLACEHOLDER_MODEL,
			llm: runtime?.llm,
			instructions: '',
			id: runtime?.id,
		})
		await neuron.init({ expect: 'restore' })
		return neuron
	}
}

async function resolveNeuronStore(
	input: string | NeuronStore,
): Promise<NeuronStore> {
	if (typeof input !== 'string') return input
	const { SQLiteNeuronStore } = await import('../../stores/sqlite/node/neuron')
	return new SQLiteNeuronStore(input)
}
