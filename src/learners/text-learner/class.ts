import type { LanguageModel } from 'ai'
import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base/class'
import type { UnderstandCallResult } from '../base/class'
import { ToolBasedMethod } from '../base/query'
import type { QueryMethod } from '../base/query'
import { MemoryStore } from '../stores'
import { resolveTextLearnerConfig } from './config.resolver'
import { applyStrategy } from './strategies'
import { initUnderstand, understand } from './understand'
import type { UnderstandIdentity } from './understand'
import { buildTextQueryPrompt, createReadUnderstandingTool } from './query-tools'
import type {
	ResolvedTextLearnerConfig,
	TextLearnerConfig,
	TextLearnerUpdateResult,
} from './types'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * Strategy application is handled in postProcessUnderstanding.
 * Store is injected (defaults to MemoryStore).
 */
export class TextLearner extends BaseLearner<string, ResolvedTextLearnerConfig> {
	private understanding = ''
	private _understandIdentity: UnderstandIdentity | null = null

	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		const config = resolveTextLearnerConfig(rawConfig, parentModels)
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

	getUnderstanding(): string {
		return this.understanding
	}

	async setUnderstanding(understanding: string): Promise<void> {
		this.understanding = understanding

		// Write-through to store
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

		this.emit('learner:understanding:set', {
			learnerId: this.id,
			understanding,
		})
	}

	protected async restoreUnderstandingFromStore(): Promise<void> {
		const record = await this.store.understanding.get('current')
		if (record) {
			this.understanding = record.data as string
		}
	}

	getSummary(): string {
		return this.understanding || '(no understanding yet)'
	}

	hasKnowledge(): boolean {
		return !!this.understanding
	}

	protected async regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = await initUnderstand(
			model,
			instructions,
			this.config.governance.strategy,
		)
		this._understandIdentity = result.identity
		this.understandSystemPrompt = result.systemPrompt
	}

	protected async callUnderstand(
		model: LanguageModel,
		understanding: string,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			model,
			this.understandSystemPrompt!,
			{
				learnerId: this.id,
				instructions: this.instructions,
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
			model: this.config.model,
			config: this.config.governance,
		})
		return result.understanding
	}

	protected createQueryMethod(): QueryMethod {
		return new ToolBasedMethod(this.config.query.model, {
			tools: {
				readUnderstanding: createReadUnderstandingTool(
					() => this.getUnderstanding(),
					() => this.getBufferedObservations(),
				),
			},
			buildPrompt: buildTextQueryPrompt,
		})
	}

	// ── State persistence (adds understand identity) ──────────────────────────

	protected async saveStateToStore(): Promise<void> {
		await super.saveStateToStore()
		const now = new Date().toISOString()
		const existing = await this.store.state.get('understand_identity')
		if (existing) {
			await this.store.state.update('understand_identity', { value: this._understandIdentity, updatedAt: now })
		} else {
			await this.store.state.add({ id: 'understand_identity', value: this._understandIdentity, updatedAt: now })
		}
	}

	protected async restoreStateFromStore(): Promise<boolean> {
		const baseRestored = await super.restoreStateFromStore()
		if (!baseRestored) return false

		const understandIdentity = await this.store.state.get('understand_identity')
		if (!understandIdentity) return false

		this._understandIdentity = understandIdentity.value as UnderstandIdentity
		return true
	}

	// ── Text-specific accessors ────────────────────────────────────────────────

	getObserveIdentity() {
		return this._observeIdentity
	}

	getUnderstandIdentity() {
		return this._understandIdentity
	}

	getGovernance() {
		return { ...this.config.governance }
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): void {
		const u = updates as Partial<TextLearnerConfig>

		if (
			u.governance?.strategy !== undefined &&
			u.governance.strategy !== this.config.governance.strategy
		) {
			this.config.governance.strategy = u.governance.strategy
			changedFields.push('governance.strategy')
		}
		if (
			u.governance?.maxTokens !== undefined &&
			u.governance.maxTokens !== this.config.governance.maxTokens
		) {
			this.config.governance.maxTokens = u.governance.maxTokens
			changedFields.push('governance.maxTokens')
		}
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<TextLearnerConfig>,
	): Promise<TextLearnerUpdateResult> {
		return super.update(updates as Record<string, unknown>)
	}
}
