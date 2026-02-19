import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import { ToolBasedMethod } from '../base/query-method'
import { resolveListLearnerConfig } from './config.resolver'
import { ListDefaultMethod } from './learning-methods'
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
 * Post-synthesis governance (dedup, maxItems, pruning) is internal to ListDefaultMethod.
 *
 * Extends BaseLearner for shared health, metrics, evolution, events, learn(), update().
 */
export class ListLearner extends BaseLearner<ListItem[], ResolvedListLearnerConfig> {
	private items: ListItem[] = []

	constructor(rawConfig: ListLearnerConfig, parentModels?: ParentModels) {
		const config = resolveListLearnerConfig(rawConfig, parentModels)
		super({
			id: config.id,
			name: rawConfig.name || config.id,
			instructions: config.instructions,
			origin: config.origin,
			focus: rawConfig.focus,
			description: rawConfig.description,
			health: rawConfig.health,
			maxObservationsForStagnation:
				3 * (config.synthesize.thresholds.maxObservations ?? 10),
		})
		this.config = config

		this._learningMethod = new ListDefaultMethod(this.config.model, {
			observe: this.config.observe,
			synthesize: this.config.synthesize,
			governance: this.config.governance,
		})

		this._queryMethod = new ToolBasedMethod(this.config.query.model, {
			tools: createListQueryTools(() => this.getUnderstanding()),
			buildPrompt: buildListQueryPrompt,
		})
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	getUnderstanding(): ListItem[] {
		return this.items
	}

	setUnderstanding(items: ListItem[]): void {
		this.items = items

		this.emit('learner:understanding:set', {
			learnerId: this.id,
			understanding: items,
		})
	}

	getSummary(): string {
		if (this.items.length === 0) return '(no items yet)'
		return `${this.items.length} items tracked`
	}

	hasKnowledge(): boolean {
		return this.items.length > 0
	}

	// ── List-specific accessors ────────────────────────────────────────────────

	getItemCount(): number {
		return this.items.length
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	getSynthesizeThresholds() {
		return { ...this.config.synthesize.thresholds }
	}

	getGovernance() {
		return { ...this.config.governance }
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
		methodUpdate: Record<string, unknown>,
	): void {
		const u = updates as Partial<ListLearnerConfig>

		if (u.governance) {
			Object.assign(this.config.governance, u.governance)
			changedFields.push('governance')
			methodUpdate.governance = u.governance
		}
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<ListLearnerConfig>,
	): Promise<ListLearnerUpdateResult> {
		return super.update(updates as Record<string, unknown>)
	}
}
