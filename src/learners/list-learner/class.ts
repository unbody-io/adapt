import type { LanguageModel } from 'ai'
import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base/class'
import type { UnderstandCallResult } from '../base/class'
import { DirectMethod, ToolBasedMethod } from '../base/query'
import type { QueryMethod } from '../base/query'
import { resolveListLearnerConfig } from './config.resolver'
import { applyListGovernance } from './governance'
import type { Significance } from '../types'
import { adjustUnderstand, adjustUnderstandingContent, initUnderstand, understand } from './understand'
import { buildListQueryPrompt, createListQueryTools } from './query-tools'
import { generateObservationSchema } from './schema'
import type {
	ListItem,
	ListLearnerConfig,
	ListLearnerState,
} from './types'

/**
 * ListLearner - A learning agent that maintains understanding as a collection of items
 *
 * Post-understand governance (dedup, maxItems, pruning) is handled in postProcessUnderstanding.
 * Store is injected — caller must provide it.
 */
export class ListLearner extends BaseLearner<ListItem[], ListLearnerState> {
	get type(): string {
		return 'list'
	}

	constructor(rawConfig: ListLearnerConfig, parentModels?: ParentModels) {
		const config = resolveListLearnerConfig(rawConfig, parentModels)
		const maxObsForStagnation = 3 * (config.understand.thresholds.maxObservations ?? 10)

		const initialState: ListLearnerState = {
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

		super(config.id, rawConfig.store, initialState)
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

		this.emit('learner:understanding:set', {
			learnerId: this.id,
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
		model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = await initUnderstand(model, instructions)
		await this.setState({
			understand_identity: result.identity,
			// For list, the system prompt is generated per call (includes current items)
			understand_prompt: '(list-understand: identity initialized)',
		} as Partial<ListLearnerState>)
	}

	protected async adjustUnderstandPrompt(
		model: LanguageModel,
		directive: string,
		newInstructions: string,
	): Promise<void> {
		const result = await adjustUnderstand(
			model,
			directive,
			newInstructions,
			this.state.understand_identity!,
		)
		await this.setState({
			understand_identity: result.identity,
			understand_prompt: '(list-understand: identity adjusted)',
		} as Partial<ListLearnerState>)
	}

	protected async adjustUnderstanding(
		model: LanguageModel,
		directive: string,
	): Promise<{ evolution: string; significance: Significance }> {
		const result = await adjustUnderstandingContent(
			model,
			this.state.understand_identity!,
			directive,
			this.store.understanding,
			this.state.understanding_schema ?? undefined,
		)

		if (result.status === 'synthesized') {
			const processed = this.postProcessUnderstanding(result.newItems)
			await this.setUnderstanding(processed)
			return { evolution: result.evolution, significance: result.significance }
		}

		const evolution = result.status === 'dismissed'
			? result.output
			: 'No changes needed'
		return { evolution, significance: 'routine' }
	}

	protected async callUnderstand(
		model: LanguageModel,
		_understanding: ListItem[],
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			model,
			this.state.understand_identity!,
			{
				learnerId: this.id,
				instructions: this.state.instructions,
				observations,
			},
			this.store.understanding,
			this.state.understanding_schema ?? undefined,
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
		return new ToolBasedMethod(this.state.models.query, {
			tools: createListQueryTools(() => this.getUnderstanding()),
			buildPrompt: (ctx) => buildListQueryPrompt(ctx, schema ?? undefined),
		})
	}

	protected createDirectQueryMethod(): QueryMethod {
		return new DirectMethod(this.state.models.query, {
			getUnderstanding: async () => {
				const items = await this.getUnderstanding()
				if (items.length === 0) return '(empty — no items yet)'
				return JSON.stringify(items.map((item) => item.data), null, 2)
			},
			buildPrompt: (ctx, understanding) =>
				`You are a specialist tracking a collection. Your domain:\n"${ctx.instructions}"\n\n# Your Data (${understanding === '(empty — no items yet)' ? '0' : 'JSON array of'} items)\n${understanding}\n\nAnswer from your data. Be specific — reference items, quantify where possible. Don't fabricate.`,
		})
	}

	// ── Schema generation (LLM-generated for list) ──────────────────────────────

	protected async generateSchemas(model: LanguageModel, instructions: string) {
		const observeIdentity = this.state.observe_identity?.identity ?? instructions
		const observationSchema = await generateObservationSchema(model, instructions, observeIdentity)
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
	): Partial<ListLearnerState> {
		const u = updates as Partial<ListLearnerConfig>
		const result: Partial<ListLearnerState> = {}

		if (u.governance) {
			result.governance = { ...this.state.governance, ...u.governance }
			changedFields.push('governance')
		}

		return result
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<ListLearnerConfig>,
	): Promise<{ changedFields: string[] }> {
		return super.update(updates as Record<string, unknown>)
	}
}
