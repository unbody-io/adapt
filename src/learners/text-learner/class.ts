import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base'
import { ToolBasedMethod } from '../base/query-method'
import { resolveTextLearnerConfig } from './config.resolver'
import { TextDefaultMethod } from './learning-methods'
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
 * Extends BaseLearner for shared health, metrics, evolution, events, learn(), update().
 */
export class TextLearner extends BaseLearner<string, ResolvedTextLearnerConfig> {
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

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
		methodUpdate: Record<string, unknown>,
	): void {
		const u = updates as Partial<TextLearnerConfig>

		if (
			u.governance?.strategy !== undefined &&
			u.governance.strategy !== this.config.governance.strategy
		) {
			this.config.governance.strategy = u.governance.strategy
			changedFields.push('governance.strategy')
			methodUpdate.governance = {
				...(methodUpdate.governance as object),
				strategy: u.governance.strategy,
			}
		}
		if (
			u.governance?.maxTokens !== undefined &&
			u.governance.maxTokens !== this.config.governance.maxTokens
		) {
			this.config.governance.maxTokens = u.governance.maxTokens
			changedFields.push('governance.maxTokens')
			methodUpdate.governance = {
				...(methodUpdate.governance as object),
				maxTokens: u.governance.maxTokens,
			}
		}
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<TextLearnerConfig>,
	): Promise<TextLearnerUpdateResult> {
		return super.update(updates as Record<string, unknown>)
	}
}
