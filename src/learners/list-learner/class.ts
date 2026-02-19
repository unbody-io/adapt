import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import { ToolBasedMethod } from '../base/query-method'
import { resolveListLearnerConfig } from './config.resolver'
import { ListDefaultMethod } from './learning-method'
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
 * Uses two-phase learning: Observe → Buffer → Synthesize (operations) → Governance
 * Post-synthesis governance (dedup, maxItems, pruning) is internal to ListDefaultMethod.
 *
 * Extends BaseLearner for shared governance, metrics, evolution, events, learn().
 */
export class ListLearner extends BaseLearner<ListItem[]> {
	private config: ResolvedListLearnerConfig
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

	// ── Update ─────────────────────────────────────────────────────────────────

	async update(
		updates: Partial<ListLearnerConfig>,
	): Promise<ListLearnerUpdateResult> {
		if (updates.id !== undefined && updates.id !== this.id) {
			throw new Error(
				'Cannot update immutable field "id". Learner identity cannot be changed.',
			)
		}

		const changedFields: string[] = []
		const methodUpdate: Record<string, unknown> = {}

		// ── Metadata ──

		if (updates.name !== undefined && updates.name !== this.name) {
			this.name = updates.name
			changedFields.push('name')
		}

		if (
			updates.description !== undefined &&
			updates.description !== this.description
		) {
			this.description = updates.description
			changedFields.push('description')
		}

		if (
			updates.origin !== undefined &&
			updates.origin !== this.config.origin
		) {
			this.config.origin = updates.origin
			this._origin = updates.origin
			changedFields.push('origin')
		}

		// ── Model ──

		if (updates.model !== undefined) {
			this.config.model = updates.model
			changedFields.push('model')
			methodUpdate.model = updates.model
		}

		if (updates.blueprintModel !== undefined) {
			this.config.blueprintModel = updates.blueprintModel
			changedFields.push('blueprintModel')
		}

		// ── Instructions ──

		if (updates.instructions !== undefined) {
			this.instructions = updates.instructions
			this.config.instructions = updates.instructions
			changedFields.push('instructions')
			methodUpdate.instructions = updates.instructions
		}

		// ── Focus ──

		if (updates.focus !== undefined && updates.focus !== this.focus) {
			this.focus = updates.focus
			changedFields.push('focus')
			methodUpdate.focus = updates.focus
		}

		// ── Observe config ──

		if (updates.observe) {
			if (updates.observe.model !== undefined) {
				this.config.observe.model = updates.observe.model
				changedFields.push('observe.model')
				methodUpdate.observe = {
					...(methodUpdate.observe as object),
					model: updates.observe.model,
				}
			}
			if (updates.observe.blueprintModel !== undefined) {
				this.config.observe.blueprintModel =
					updates.observe.blueprintModel
				changedFields.push('observe.blueprintModel')
				methodUpdate.observe = {
					...(methodUpdate.observe as object),
					blueprintModel: updates.observe.blueprintModel,
				}
			}
		}

		// ── Synthesize config ──

		if (updates.synthesize) {
			if (updates.synthesize.model !== undefined) {
				this.config.synthesize.model = updates.synthesize.model
				changedFields.push('synthesize.model')
				methodUpdate.synthesize = {
					...(methodUpdate.synthesize as object),
					model: updates.synthesize.model,
				}
			}
			if (updates.synthesize.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel =
					updates.synthesize.blueprintModel
				changedFields.push('synthesize.blueprintModel')
				methodUpdate.synthesize = {
					...(methodUpdate.synthesize as object),
					blueprintModel: updates.synthesize.blueprintModel,
				}
			}
			if (updates.synthesize.thresholds) {
				Object.assign(
					this.config.synthesize.thresholds,
					updates.synthesize.thresholds,
				)
				changedFields.push('synthesize.thresholds')
				methodUpdate.synthesize = {
					...(methodUpdate.synthesize as object),
					thresholds: updates.synthesize.thresholds,
				}
			}
		}

		// ── List governance ──

		if (updates.governance) {
			Object.assign(this.config.governance, updates.governance)
			changedFields.push('governance')
			methodUpdate.governance = updates.governance
		}

		// ── Query config ──

		if (updates.query?.model !== undefined) {
			this.config.query.model = updates.query.model
			changedFields.push('query.model')
			this._queryMethod.update({ model: updates.query.model })
		}

		// ── Health config ──

		if (updates.health) {
			if (updates.health.threshold !== undefined) {
				this.health.threshold = updates.health.threshold
				changedFields.push('health.threshold')
			}
			if (updates.health.signalThresholds) {
				const st = updates.health.signalThresholds
				if (st.maxDismissalRate !== undefined) {
					this.health.signalThresholds.maxDismissalRate =
						st.maxDismissalRate
					changedFields.push(
						'health.signalThresholds.maxDismissalRate',
					)
				}
				if (st.minConfidence !== undefined) {
					this.health.signalThresholds.minConfidence =
						st.minConfidence
					changedFields.push(
						'health.signalThresholds.minConfidence',
					)
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.health.signalThresholds.maxObservationsWithoutSynthesis =
						st.maxObservationsWithoutSynthesis
					changedFields.push(
						'health.signalThresholds.maxObservationsWithoutSynthesis',
					)
				}
			}
		}

		// ── Delegate to sub-components ──

		let promptsRegenerated = false

		if (Object.keys(methodUpdate).length > 0) {
			const result = await this._learningMethod.update(methodUpdate)
			promptsRegenerated = result.promptsRegenerated

			if (promptsRegenerated) {
				this.emit('learner:prompts:regenerated', {
					learnerId: this.id,
					observePrompt: this._learningMethod.observePrompt!,
					synthesizePrompt: this._learningMethod.synthesizePrompt!,
				})
			}
		}

		if (changedFields.length > 0) {
			this.emit('learner:config:updated', {
				learnerId: this.id,
				changedFields,
				config: { ...this.config },
			})
		}

		return {
			changedFields,
			config: { ...this.config },
		}
	}
}
