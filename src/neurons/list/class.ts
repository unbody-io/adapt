import type { AdaptLLMPlugin, LanguageModel } from '../../llm'
import { resolveRuntimeLLM } from '../../llm'
import type { NeuronStore } from '../../stores'
import type { ParentModels } from '../../types/config'
import type { UnderstandCallResult } from '../base/class'
import { BaseNeuron } from '../base/class'
import { resolveUnderstandInstructions } from '../base/instructions'
import type { QueryMethod } from '../base/query'
import { DirectMethod, ToolBasedMethod } from '../base/query'
import type { Significance } from '../types'
import { resolveListNeuronConfig } from './config.resolver'
import { applyListGovernance } from './governance'
import { buildListQueryPrompt, createListQueryTools } from './query-tools'
import { generateObservationSchema } from './schema'
import type { ListItem, ListNeuronConfig, ListNeuronState } from './types'
import {
	adjustUnderstandingContent,
	initUnderstand,
	understand,
} from './understand'

const RESTORE_PLACEHOLDER_MODEL =
	'unknown:placeholder' as unknown as LanguageModel

/**
 * ListNeuron - A learning agent that maintains understanding as a collection of items
 *
 * Post-understand governance (dedup, maxItems, pruning) is handled in postProcessUnderstanding.
 * Store is injected — caller must provide it.
 */
export class ListNeuron extends BaseNeuron<ListItem[], ListNeuronState> {
	get type(): string {
		return 'list'
	}

	constructor(
		rawConfig: ListNeuronConfig & { llm?: AdaptLLMPlugin },
		parentModels?: ParentModels,
	) {
		const config = resolveListNeuronConfig(rawConfig, parentModels)
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

		const initialState: ListNeuronState = {
			instructions: config.instructions,
			observeInstructions: config.observeInstructions,
			understandInstructions: config.understandInstructions,
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
			observe_prompt: null,
			understand_prompt: null,
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
			skipUnderstand: rawConfig.skipUnderstand ?? false,
		}

		super(config.id, llm, rawConfig.store, initialState, {
			repairWithFeedback: rawConfig.repairWithFeedback,
			maxRepairAttempts: rawConfig.maxRepairAttempts,
		})
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	async getUnderstanding(): Promise<ListItem[]> {
		const records = await this.store.understanding.list()
		return records.map((r) => r.data as ListItem)
	}

	async setUnderstanding(items: ListItem[]): Promise<void> {
		// Replace all understanding records
		await this.store.understanding.clear()
		if (items.length > 0) {
			await this.store.understanding.addBatch(
				items.map((item) => ({
					id: item.id,
					data: item as unknown,
					metadata_confidence: item.metadata.confidence,
					metadata_created_at: item.metadata.firstSeen,
					metadata_updated_at: item.metadata.lastUpdated,
				})),
			)
		}

		this.emit('neuron:understanding:set', {
			neuronId: this.id,
			understanding: items,
		})
	}

	async getSummary(): Promise<string> {
		const count = await this.store.understanding.count()
		if (count === 0) return '(no items yet)'
		return `${count} items tracked`
	}

	async hasKnowledge(): Promise<boolean> {
		const count = await this.store.understanding.count()
		return count > 0
	}

	protected async regenUnderstandPrompt(
		_model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = initUnderstand(instructions)
		await this.setState({
			understand_prompt: result.systemPrompt,
		} as Partial<ListNeuronState>)
	}

	protected rebuildUnderstandPromptFromState(instructions: string): string {
		return initUnderstand(instructions).systemPrompt
	}

	protected async adjustUnderstandPrompt(
		_model: LanguageModel,
		_directive: string,
		newInstructions: string,
	): Promise<void> {
		const result = initUnderstand(newInstructions)
		await this.setState({
			understand_prompt: result.systemPrompt,
		} as Partial<ListNeuronState>)
	}

	protected async adjustUnderstanding(
		model: LanguageModel,
		directive: string,
	): Promise<{ evolution: string; significance: Significance }> {
		const result = await adjustUnderstandingContent(
			this.llm,
			model,
			resolveUnderstandInstructions(this.state),
			directive,
			this.store.understanding,
			this.state.understanding_schema ?? undefined,
			this.llmRepairOptions,
		)

		if (result.status === 'synthesized') {
			const processed = this.postProcessUnderstanding(result.newItems)
			await this.setUnderstanding(processed)
			return { evolution: result.evolution, significance: result.significance }
		}

		const evolution =
			result.status === 'dismissed' ? result.output : 'No changes needed'
		return { evolution, significance: 'routine' }
	}

	protected async callUnderstand(
		model: LanguageModel,
		_understanding: ListItem[],
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			this.llm,
			model,
			resolveUnderstandInstructions(this.state),
			{
				neuronId: this.id,
				instructions: this.state.instructions,
				observations,
			},
			this.store.understanding,
			this.state.understanding_schema ?? undefined,
			callbacks,
			this.llmRepairOptions,
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
			newUnderstanding: result.newItems,
			significance: result.significance,
			evolution: result.evolution,
			reasoning: result.reasoning,
			usage: result.usage,
		}
	}

	protected postProcessUnderstanding(raw: ListItem[]): ListItem[] {
		return applyListGovernance(raw, this.state.governance)
	}

	protected createQueryMethod(): QueryMethod {
		const schema = this.state.understanding_schema
		return new ToolBasedMethod(this.llm, this.state.models.query, {
			tools: createListQueryTools(() => this.getUnderstanding()),
			buildPrompt: (ctx) => buildListQueryPrompt(ctx, schema ?? undefined),
		})
	}

	protected createDirectQueryMethod(): QueryMethod {
		return new DirectMethod(this.llm, this.state.models.query, {
			getUnderstanding: async () => {
				const items = await this.getUnderstanding()
				if (items.length === 0) return '(empty — no items yet)'
				return JSON.stringify(
					items.map((item) => item.data),
					null,
					2,
				)
			},
			buildPrompt: (ctx, understanding) =>
				`You are a specialist tracking a collection. Your domain:\n"${ctx.instructions}"\n\n# Your Data (${understanding === '(empty — no items yet)' ? '0' : 'JSON array of'} items)\n${understanding}\n\nAnswer from your data. Be specific — reference items, quantify where possible. Don't fabricate.`,
		})
	}

	// ── Schema generation (LLM-generated for list) ──────────────────────────────

	protected async generateSchemas(model: LanguageModel, instructions: string) {
		const observationSchema = await generateObservationSchema(
			this.llm,
			model,
			instructions,
			instructions,
			this.llmRepairOptions,
		)
		return { observationSchema, understandingSchema: observationSchema }
	}

	// ── List-specific accessors ────────────────────────────────────────────────

	async getItemCount(): Promise<number> {
		return this.store.understanding.count()
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	getGovernance() {
		return { ...this.state.governance }
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): Partial<ListNeuronState> {
		const u = updates as Partial<ListNeuronConfig>
		const result: Partial<ListNeuronState> = {}

		if (u.governance) {
			result.governance = { ...this.state.governance, ...u.governance }
			changedFields.push('governance')
		}

		return result
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<ListNeuronConfig>,
	): Promise<{ changedFields: string[] }> {
		return super.update(updates as Record<string, unknown>)
	}

	/**
	 * Construct a fresh ListNeuron and persist its config to the store.
	 * Throws if the store already contains a neuron — use {@link restore}.
	 */
	static async create(
		config: ListNeuronConfig & { llm?: AdaptLLMPlugin },
		parentModels?: ParentModels,
	): Promise<ListNeuron> {
		const neuron = new ListNeuron(config, parentModels)
		await neuron.init({ expect: 'fresh' })
		return neuron
	}

	/**
	 * Restore a previously-persisted ListNeuron from a store.
	 * `input` may be a path string (sugar for SQLiteNeuronStore) or a NeuronStore.
	 * Throws if the store is empty — use {@link create}.
	 *
	 * `runtime` supplies the LLM context the neuron needs after restore.
	 */
	static async restore(
		input: string | NeuronStore,
		runtime?: {
			id?: string
			model?: LanguageModel
			llm?: AdaptLLMPlugin
			repairWithFeedback?: ListNeuronConfig['repairWithFeedback']
			maxRepairAttempts?: number
		},
	): Promise<ListNeuron> {
		const store = await resolveNeuronStore(input)
		const neuron = new ListNeuron({
			store,
			model: runtime?.model ?? RESTORE_PLACEHOLDER_MODEL,
			llm: runtime?.llm,
			repairWithFeedback: runtime?.repairWithFeedback,
			maxRepairAttempts: runtime?.maxRepairAttempts,
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
