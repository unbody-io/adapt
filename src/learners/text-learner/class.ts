import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import { resolveTextLearnerConfig } from './config.resolver'
import { TextDefaultMethod } from './learning-methods'
import type { TextDefaultUpdateConfig } from './learning-methods'
import {
	createQueryMethod,
	type QueryMethod,
	type QueryOptions,
	type QueryResult,
} from './query-methods'
import type {
	QueryMethodName,
	ResolvedTextLearnerConfig,
	TextLearnerConfig,
	TextLearnerUpdateResult,
} from './types'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * Uses two-phase learning: Observe → Buffer → Synthesize
 * Strategy application is internal to TextDefaultMethod.
 *
 * Extends BaseLearner for shared governance, metrics, evolution, events, learn().
 */
export class TextLearner extends BaseLearner<string> {
	private config: ResolvedTextLearnerConfig
	private understanding = ''
	private _queryMethod: QueryMethod

	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		const config = resolveTextLearnerConfig(rawConfig, parentModels)
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

		this._learningMethod = new TextDefaultMethod(this.config.model, {
			observe: {
				method: this.config.observe.method,
				model: this.config.observe.model,
				blueprintModel: this.config.observe.blueprintModel,
			},
			synthesize: {
				method: this.config.synthesize.method,
				model: this.config.synthesize.model,
				blueprintModel: this.config.synthesize.blueprintModel,
				thresholds: this.config.synthesize.thresholds,
			},
			maintenance: this.config.maintenance,
		})

		this._queryMethod = createQueryMethod(
			this.config.query.method,
			this.config.query.model,
		)
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	getUnderstanding(): string {
		return this.understanding
	}

	setUnderstanding(understanding: string): void {
		this.understanding = understanding

		this.emit('learner:understanding:set', {
			learnerId: this.id,
			understanding,
		})
	}

	getSummary(): string {
		return this.understanding || '(no understanding yet)'
	}

	// ── Init ───────────────────────────────────────────────────────────────────

	/**
	 * Initialize the learner
	 *
	 * Generates system prompts for both observe and synthesize phases.
	 * Delegates to update() internally — prompts are generated because
	 * they are null on first call.
	 */
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
		if (!this.understanding && this.getBufferState().count === 0) {
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

		// Use buffered observations as fallback when understanding is empty
		let knowledge = this.understanding
		if (!knowledge) {
			const observations = this.getBufferedObservations()
			knowledge =
				'Note: This knowledge has not been synthesized yet. These are raw observations.\n\n---\n' +
				observations.map((obs) => obs.text).join('\n---\n')
		}

		try {
			const result = await this._queryMethod.query(
				{
					learnerId: this.id,
					instructions: this.instructions,
					understanding: knowledge,
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

	// ── Text-specific accessors ────────────────────────────────────────────────

	getObserveIdentity() {
		return (this._learningMethod as TextDefaultMethod).observeIdentity
	}

	getSynthesizeIdentity() {
		return (this._learningMethod as TextDefaultMethod).synthesizeIdentity
	}

	getMaintenance() {
		return { ...this.config.maintenance }
	}

	getQueryMethodName(): QueryMethodName {
		return this.config.query.method
	}

	getSynthesizeThresholds() {
		return { ...this.config.synthesize.thresholds }
	}

	// ── Update ─────────────────────────────────────────────────────────────────

	/**
	 * Update learner configuration
	 *
	 * Accepts the same shape as the constructor config (but partial).
	 * Any config field can be updated. Only `id` is truly immutable.
	 */
	async update(updates: Partial<TextLearnerConfig>): Promise<TextLearnerUpdateResult> {
		if (updates.id !== undefined && updates.id !== this.id) {
			throw new Error(
				'Cannot update immutable field "id". Learner identity cannot be changed.',
			)
		}

		const changedFields: string[] = []
		const methodUpdate: TextDefaultUpdateConfig = {}
		let queryModelChanged = false
		let queryMethodChanged = false

		// ── Metadata fields ──

		if (updates.name !== undefined && updates.name !== this.name) {
			this.name = updates.name
			changedFields.push('name')
		}

		if (updates.description !== undefined && updates.description !== this.description) {
			this.description = updates.description
			changedFields.push('description')
		}

		if (updates.origin !== undefined && updates.origin !== this.config.origin) {
			this.config.origin = updates.origin
			this._origin = updates.origin
			changedFields.push('origin')
		}

		// ── Model changes ──

		if (updates.model !== undefined) {
			this.config.model = updates.model
			changedFields.push('model')
			methodUpdate.model = updates.model
		}

		if (updates.blueprintModel !== undefined) {
			this.config.blueprintModel = updates.blueprintModel
			changedFields.push('blueprintModel')
			if (!updates.observe?.blueprintModel) {
				methodUpdate.observe = methodUpdate.observe || {}
				methodUpdate.observe.blueprintModel = updates.blueprintModel
			}
			if (!updates.synthesize?.blueprintModel) {
				methodUpdate.synthesize = methodUpdate.synthesize || {}
				methodUpdate.synthesize.blueprintModel = updates.blueprintModel
			}
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
				methodUpdate.observe = methodUpdate.observe || {}
				methodUpdate.observe.model = updates.observe.model
			}
			if (updates.observe.blueprintModel !== undefined) {
				this.config.observe.blueprintModel = updates.observe.blueprintModel
				changedFields.push('observe.blueprintModel')
				methodUpdate.observe = methodUpdate.observe || {}
				methodUpdate.observe.blueprintModel = updates.observe.blueprintModel
			}
		}

		// ── Synthesize config ──

		if (updates.synthesize) {
			if (updates.synthesize.model !== undefined) {
				this.config.synthesize.model = updates.synthesize.model
				changedFields.push('synthesize.model')
				methodUpdate.synthesize = methodUpdate.synthesize || {}
				methodUpdate.synthesize.model = updates.synthesize.model
			}
			if (updates.synthesize.blueprintModel !== undefined) {
				this.config.synthesize.blueprintModel = updates.synthesize.blueprintModel
				changedFields.push('synthesize.blueprintModel')
				methodUpdate.synthesize = methodUpdate.synthesize || {}
				methodUpdate.synthesize.blueprintModel = updates.synthesize.blueprintModel
			}
			if (updates.synthesize.thresholds) {
				const t = updates.synthesize.thresholds
				if (t.minImportance !== undefined) {
					this.config.synthesize.thresholds.minImportance = t.minImportance
					changedFields.push('synthesize.thresholds.minImportance')
				}
				if (t.maxObservations !== undefined) {
					this.config.synthesize.thresholds.maxObservations = t.maxObservations
					changedFields.push('synthesize.thresholds.maxObservations')
				}
				if (t.maxTokens !== undefined) {
					this.config.synthesize.thresholds.maxTokens = t.maxTokens
					changedFields.push('synthesize.thresholds.maxTokens')
				}
				methodUpdate.synthesize = methodUpdate.synthesize || {}
				methodUpdate.synthesize.thresholds = updates.synthesize.thresholds
			}
		}

		// ── Maintenance ──

		if (updates.maintenance?.strategy !== undefined && updates.maintenance.strategy !== this.config.maintenance.strategy) {
			this.config.maintenance.strategy = updates.maintenance.strategy
			changedFields.push('maintenance.strategy')
			methodUpdate.maintenance = methodUpdate.maintenance || {}
			methodUpdate.maintenance.strategy = updates.maintenance.strategy
		}
		if (updates.maintenance?.maxTokens !== undefined && updates.maintenance.maxTokens !== this.config.maintenance.maxTokens) {
			this.config.maintenance.maxTokens = updates.maintenance.maxTokens
			changedFields.push('maintenance.maxTokens')
			methodUpdate.maintenance = methodUpdate.maintenance || {}
			methodUpdate.maintenance.maxTokens = updates.maintenance.maxTokens
		}

		// ── Query config ──

		if (updates.query) {
			if (updates.query.model !== undefined) {
				this.config.query.model = updates.query.model
				changedFields.push('query.model')
				queryModelChanged = true
			}
			if (updates.query.method !== undefined && updates.query.method !== this.config.query.method) {
				this.config.query.method = updates.query.method
				changedFields.push('query.method')
				queryMethodChanged = true
			}
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
					this.governance.signalThresholds.maxDismissalRate = st.maxDismissalRate
					changedFields.push('governance.signalThresholds.maxDismissalRate')
				}
				if (st.minConfidence !== undefined) {
					this.governance.signalThresholds.minConfidence = st.minConfidence
					changedFields.push('governance.signalThresholds.minConfidence')
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.governance.signalThresholds.maxObservationsWithoutSynthesis = st.maxObservationsWithoutSynthesis
					changedFields.push('governance.signalThresholds.maxObservationsWithoutSynthesis')
				}
			}
		}

		// ── Delegate to sub-components ──

		let promptsRegenerated = false

		if (Object.keys(methodUpdate).length > 0) {
			const result = await this._learningMethod.update(methodUpdate as Record<string, unknown>)
			promptsRegenerated = result.promptsRegenerated

			if (promptsRegenerated) {
				this.emit('learner:prompts:regenerated', {
					learnerId: this.id,
					observePrompt: this._learningMethod.observePrompt!,
					synthesizePrompt: this._learningMethod.synthesizePrompt!,
				})
			}
		}

		if (queryMethodChanged) {
			this._queryMethod = createQueryMethod(
				this.config.query.method,
				this.config.query.model,
			)
		} else if (queryModelChanged) {
			this._queryMethod.update({
				model: this.config.query.model
			})
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
