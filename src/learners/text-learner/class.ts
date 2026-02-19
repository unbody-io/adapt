import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import { ToolBasedMethod } from '../base/query-method'
import { resolveTextLearnerConfig } from './config.resolver'
import { TextDefaultMethod } from './learning-methods'
import type { TextDefaultUpdateConfig } from './learning-methods'
import { buildTextQueryPrompt, createReadUnderstandingTool } from './query-tools'
import type {
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

	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		const config = resolveTextLearnerConfig(rawConfig, parentModels)
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

		this._learningMethod = new TextDefaultMethod(this.config.model, {
			observe: this.config.observe,
			synthesize: this.config.synthesize,
			governance: this.config.governance,
		})

		this._queryMethod = new ToolBasedMethod(this.config.query.model, {
			tools: {
				readUnderstanding: createReadUnderstandingTool(
					() => this.getUnderstanding(),
					() => this.getBufferedObservations(),
				),
			},
			buildPrompt: buildTextQueryPrompt,
		})
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

	hasKnowledge(): boolean {
		return !!this.understanding
	}

	// ── Text-specific accessors ────────────────────────────────────────────────

	getObserveIdentity() {
		return (this._learningMethod as TextDefaultMethod).observeIdentity
	}

	getSynthesizeIdentity() {
		return (this._learningMethod as TextDefaultMethod).synthesizeIdentity
	}

	getGovernance() {
		return { ...this.config.governance }
	}

	getQueryMethodName(): string {
		return 'tool-based'
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

		// ── Governance ──

		if (updates.governance?.strategy !== undefined && updates.governance.strategy !== this.config.governance.strategy) {
			this.config.governance.strategy = updates.governance.strategy
			changedFields.push('governance.strategy')
			methodUpdate.governance = methodUpdate.governance || {}
			methodUpdate.governance.strategy = updates.governance.strategy
		}
		if (updates.governance?.maxTokens !== undefined && updates.governance.maxTokens !== this.config.governance.maxTokens) {
			this.config.governance.maxTokens = updates.governance.maxTokens
			changedFields.push('governance.maxTokens')
			methodUpdate.governance = methodUpdate.governance || {}
			methodUpdate.governance.maxTokens = updates.governance.maxTokens
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
					this.health.signalThresholds.maxDismissalRate = st.maxDismissalRate
					changedFields.push('health.signalThresholds.maxDismissalRate')
				}
				if (st.minConfidence !== undefined) {
					this.health.signalThresholds.minConfidence = st.minConfidence
					changedFields.push('health.signalThresholds.minConfidence')
				}
				if (st.maxObservationsWithoutSynthesis !== undefined) {
					this.health.signalThresholds.maxObservationsWithoutSynthesis = st.maxObservationsWithoutSynthesis
					changedFields.push('health.signalThresholds.maxObservationsWithoutSynthesis')
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
