import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import type { QueryOptions, QueryResult } from '../base/query-method'
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
	private _queryMethod: ToolBasedMethod

	constructor(rawConfig: ListLearnerConfig, parentModels?: ParentModels) {
		const config = resolveListLearnerConfig(rawConfig, parentModels)
		super({
			id: config.id,
			name: rawConfig.name || config.id,
			instructions: config.instructions,
			origin: config.origin,
			focus: rawConfig.focus,
			description: rawConfig.description,
			governance: rawConfig.governance,
			maxObservationsForStagnation:
				3 * (config.synthesize.thresholds.maxObservations ?? 10),
		})
		this.config = config

		this._learningMethod = new ListDefaultMethod(this.config.model, {
			observe: {
				model: this.config.observe.model,
				blueprintModel: this.config.observe.blueprintModel,
			},
			synthesize: {
				model: this.config.synthesize.model,
				blueprintModel: this.config.synthesize.blueprintModel,
				thresholds: this.config.synthesize.thresholds,
			},
			listGovernance: this.config.listGovernance,
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

	// ── Init ───────────────────────────────────────────────────────────────────

	async init(): Promise<{
		observeSystemPrompt: string
		synthesizeSystemPrompt: string
	}> {
		if (this.isInitialized()) {
			return {
				observeSystemPrompt: this._learningMethod.observePrompt!,
				synthesizeSystemPrompt: this._learningMethod.synthesizePrompt!,
			}
		}

		this.emit('learner:init:started', { learnerId: this.id })

		try {
			await this.update({ instructions: this.instructions })

			this.emit('learner:init:completed', {
				learnerId: this.id,
				systemPrompt: this._learningMethod.observePrompt!,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			})

			return {
				observeSystemPrompt: this._learningMethod.observePrompt!,
				synthesizeSystemPrompt: this._learningMethod.synthesizePrompt!,
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:init:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
	}

	// ── Query ──────────────────────────────────────────────────────────────────

	async query(question: string, options?: QueryOptions): Promise<QueryResult> {
		this.governance.lastAccessed = new Date()
		this.metrics.query.count++

		this.emit('learner:query:started', {
			learnerId: this.id,
			query: question,
		})

		// Short-circuit if learner has no knowledge at all
		if (this.items.length === 0 && this.getBufferState().count === 0) {
			const emptyResult: QueryResult = {
				relevant: false,
				relevance: 0,
				confidence: 0,
				insight: '',
				gaps: '',
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			}
			this.emit('learner:query:completed', {
				learnerId: this.id,
				insight: '',
				relevant: false,
				relevance: 0,
				confidence: 0,
				gaps: [],
				usage: emptyResult.usage,
			})
			return emptyResult
		}

		try {
			const result = await this._queryMethod.query(
				{
					learnerId: this.id,
					instructions: this.instructions,
					question,
				},
				options,
				{
					onThinking: (thoughts, usage) => {
						this.emit('learner:query:thinking', {
							learnerId: this.id,
							thoughts,
							usage,
						})
					},
				},
			)

			this.trackQueryMetrics(result)

			this.emit('learner:query:completed', {
				learnerId: this.id,
				insight: result.insight,
				relevant: result.relevant,
				relevance: result.relevance,
				confidence: result.confidence,
				gaps: result.gaps ? result.gaps.split('\n').filter(Boolean) : [],
				usage: result.usage,
			})

			this.checkAndEmitSignals()

			return result
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			this.emit('learner:query:failed', {
				learnerId: this.id,
				error: error.message,
			})
			throw error
		}
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

	getListGovernance() {
		return { ...this.config.listGovernance }
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

		if (updates.listGovernance) {
			Object.assign(this.config.listGovernance, updates.listGovernance)
			changedFields.push('listGovernance')
			methodUpdate.listGovernance = updates.listGovernance
		}

		// ── Query config ──

		if (updates.query?.model !== undefined) {
			this.config.query.model = updates.query.model
			changedFields.push('query.model')
			this._queryMethod.update({ model: updates.query.model })
		}

		// ── Governance config ──

		if (updates.governance) {
			if (updates.governance.threshold !== undefined) {
				this.governance.threshold = updates.governance.threshold
				changedFields.push('governance.threshold')
			}
			if (updates.governance.signalThresholds) {
				const st = updates.governance.signalThresholds
				if (st.maxDismissalRate !== undefined) {
					this.governance.signalThresholds.maxDismissalRate =
						st.maxDismissalRate
					changedFields.push(
						'governance.signalThresholds.maxDismissalRate',
					)
				}
				if (st.minConfidence !== undefined) {
					this.governance.signalThresholds.minConfidence =
						st.minConfidence
					changedFields.push(
						'governance.signalThresholds.minConfidence',
					)
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.governance.signalThresholds.maxObservationsWithoutSynthesis =
						st.maxObservationsWithoutSynthesis
					changedFields.push(
						'governance.signalThresholds.maxObservationsWithoutSynthesis',
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
