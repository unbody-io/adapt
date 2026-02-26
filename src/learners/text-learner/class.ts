import type { LanguageModel } from 'ai'
import type { ParentModels } from '../../types/config'
import { BaseLearner } from '../base/class'
import type { UnderstandCallResult } from '../base/class'
import { ToolBasedMethod } from '../base/query'
import type { QueryMethod } from '../base/query'
import { resolveTextLearnerConfig } from './config.resolver'
import { applyStrategy } from './strategies'
import { initUnderstand, understand } from './understand'
import { buildTextQueryPrompt, createReadUnderstandingTool } from './query-tools'
import type {
	TextLearnerConfig,
	TextLearnerState,
} from './types'

/**
 * TextLearner - A learning agent that maintains understanding as narrative text
 *
 * Strategy application is handled in postProcessUnderstanding.
 * Store is injected — caller must provide it.
 */
export class TextLearner extends BaseLearner<string, TextLearnerState> {
	constructor(rawConfig: TextLearnerConfig, parentModels?: ParentModels) {
		const config = resolveTextLearnerConfig(rawConfig, parentModels)
		const maxObsForStagnation = 3 * (config.understand.thresholds.maxObservations ?? 10)

		const initialState: TextLearnerState = {
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
			observation_schema: null,
			understanding_schema: null,
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
		}

		super(config.id, rawConfig.store, initialState)
	}

	// ── Abstract implementations ───────────────────────────────────────────────

	async getUnderstanding(): Promise<string> {
		const record = await this.store.understanding.get('current')
		return record ? (record.data as string) : ''
	}

	async setUnderstanding(understanding: string): Promise<void> {
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

	async getSummary(): Promise<string> {
		const understanding = await this.getUnderstanding()
		return understanding || '(no understanding yet)'
	}

	async hasKnowledge(): Promise<boolean> {
		const record = await this.store.understanding.get('current')
		return !!record?.data
	}

	protected async regenUnderstandPrompt(
		model: LanguageModel,
		instructions: string,
	): Promise<void> {
		const result = await initUnderstand(
			model,
			instructions,
			this.state.governance.strategy,
		)
		await this.setState({
			understand_identity: result.identity,
			understand_prompt: result.systemPrompt,
		} as Partial<TextLearnerState>)
	}

	protected async callUnderstand(
		model: LanguageModel,
		understanding: string,
		observations: string[],
		callbacks?: { onThinking?: (thoughts: string[]) => void },
	): Promise<UnderstandCallResult> {
		const result = await understand(
			model,
			this.state.understand_prompt!,
			{
				learnerId: this.id,
				instructions: this.state.instructions,
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
			model: this.state.models.default,
			config: this.state.governance,
		})
		return result.understanding
	}

	protected createQueryMethod(): QueryMethod {
		return new ToolBasedMethod(this.state.models.query, {
			tools: {
				readUnderstanding: createReadUnderstandingTool(
					() => this.getUnderstanding(),
					() => this.getBufferedObservations(),
				),
			},
			buildPrompt: buildTextQueryPrompt,
		})
	}

	// ── Schema generation (hardcoded for text) ──────────────────────────────────

	protected async generateSchemas() {
		return {
			observationSchema: {
				type: 'string',
				description: 'Single observation. Concise and factual.',
				minLength: 10,
				maxLength: 500,
			},
			understandingSchema: {
				type: 'string',
				description: 'Comprehensive prose synthesis. Well-structured narrative.',
				minLength: 100,
				maxLength: 5000,
			},
		}
	}

	// ── Text-specific accessors ────────────────────────────────────────────────

	getObserveIdentity() {
		return this.state.observe_identity
	}

	getUnderstandIdentity() {
		return this.state.understand_identity
	}

	getGovernance() {
		return { ...this.state.governance }
	}

	getQueryMethodName(): string {
		return 'tool-based'
	}

	// ── Type-specific update (only governance) ─────────────────────────────────

	protected applyTypeSpecificUpdates(
		updates: Record<string, unknown>,
		changedFields: string[],
	): Partial<TextLearnerState> {
		const u = updates as Partial<TextLearnerConfig>
		const result: Partial<TextLearnerState> = {}

		if (u.governance) {
			const newGov = { ...this.state.governance }
			if (
				u.governance.strategy !== undefined &&
				u.governance.strategy !== this.state.governance.strategy
			) {
				newGov.strategy = u.governance.strategy
				changedFields.push('governance.strategy')
			}
			if (
				u.governance.maxTokens !== undefined &&
				u.governance.maxTokens !== this.state.governance.maxTokens
			) {
				newGov.maxTokens = u.governance.maxTokens
				changedFields.push('governance.maxTokens')
			}
			result.governance = newGov
		}

		return result
	}

	// ── Typed update wrapper ───────────────────────────────────────────────────

	async update(
		updates: Partial<TextLearnerConfig>,
	): Promise<{ changedFields: string[] }> {
		return super.update(updates as Record<string, unknown>)
	}
}
