import type { LanguageModel } from 'ai'
import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base/class'
import type { UnderstandCallResult } from '../base/class'
import { ToolBasedMethod } from '../base/query'
import type { QueryMethod } from '../base/query'
import { MemoryStore } from '../stores'
import { resolveListLearnerConfig } from './config.resolver'
import { applyListGovernance } from './governance'
import { initUnderstand, understand } from './understand'
import type { UnderstandIdentity } from './understand'
import { buildListQueryPrompt, createListQueryTools } from './query-tools'
import type {
	ListItem,
	ListLearnerConfig,
	ListLearnerUpdateResult,
	ResolvedListLearnerConfig,
} from './types'

/**
 * ListLearner - A learning agent that maintains understanding as a collection of items
 *
 * Post-understand governance (dedup, maxItems, pruning) is handled in postProcessUnderstanding.
 * Store is injected (defaults to MemoryStore).
 */
export class ListLearner extends BaseLearner<ListItem[], ResolvedListLearnerConfig> {
	private items: ListItem[] = []
	private _understandIdentity: UnderstandIdentity | null = null

	constructor(rawConfig: ListLearnerConfig, parentModels?: ParentModels) {
		const config = resolveListLearnerConfig(rawConfig, parentModels)
		super({
			id: config.id,
			name: rawConfig.name || config.id,
			instructions: config.instructions,
			origin: config.origin,
			store: rawConfig.store ?? new MemoryStore(),
			focus: rawConfig.focus,
			description: rawConfig.description,
			health: rawConfig.health,
			maxObservationsForStagnation:
				3 * (config.understand.thresholds.maxObservations ?? 10),
		})
		this.config = config
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	getUnderstanding(): ListItem[] {
		return this.items
	}

	async setUnderstanding(items: ListItem[]): Promise<void> {
		this.items = items

		// Write-through to store — replace all understanding records
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

	protected async restoreUnderstandingFromStore(): Promise<void> {
		const records = await this.store.understanding.list()
		if (records.length > 0) {
			this.items = records.map((r) => r.data as ListItem)
		}
	}

	getSummary(): string {
		if (this.items.length === 0) return '(no items yet)'
		return `${this.items.length} items tracked`
	}

	hasKnowledge(): boolean {
		return this.items.length > 0
	}

	protected async regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = await initUnderstand(model, instructions)
		this._understandIdentity = result.identity
		// For list, the system prompt is generated per call (includes current items)
		this.understandSystemPrompt = '(list-understand: identity initialized)'
	}

	protected async callUnderstand(
		model: LanguageModel,
		understanding: ListItem[],
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			model,
			this._understandIdentity!,
			{
				learnerId: this.id,
				instructions: this.instructions,
				currentItems: understanding,
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
			newUnderstanding: result.newItems,
			significance: result.significance,
			evolution: result.evolution,
			reasoning: result.reasoning,
			usage: result.usage,
		}
	}

	protected postProcessUnderstanding(raw: ListItem[]): ListItem[] {
		return applyListGovernance(raw, this.config.governance)
	}

	protected createQueryMethod(): QueryMethod {
		return new ToolBasedMethod(this.config.query.model, {
			tools: createListQueryTools(() => this.getUnderstanding()),
			buildPrompt: buildListQueryPrompt,
		})
	}

	// ── List-specific accessors ────────────────────────────────────────────────

	getItemCount(): number {
		return this.items.length
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	getUnderstandThresholds() {
		return { ...this.config.understand.thresholds }
	}

	getSynthesizeThresholds() {
		return this.getUnderstandThresholds()
	}

	getGovernance() {
		return { ...this.config.governance }
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): void {
		const u = updates as Partial<ListLearnerConfig>

		if (u.governance) {
			Object.assign(this.config.governance, u.governance)
			changedFields.push('governance')
		}
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<ListLearnerConfig>,
	): Promise<ListLearnerUpdateResult> {
		return super.update(updates as Record<string, unknown>)
	}
}
