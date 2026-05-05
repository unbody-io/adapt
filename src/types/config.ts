/**
 * Base config types for cascading model configuration
 *
 * Any component that supports model cascading should extend these interfaces.
 */

import type { LanguageModel } from '../llm'

/**
 * Base interface for any config that supports model cascading
 *
 * Components that need model inheritance from parent should extend this.
 */
export interface CascadableConfig {
	/** Runtime model for this component's operations */
	model?: LanguageModel
	/** Model for one-off blueprint/config generation */
	blueprintModel?: LanguageModel
}

/**
 * Resolved version of CascadableConfig - models are guaranteed
 *
 * After resolution, all models are defined (cascaded from parent or explicitly set).
 */
export interface ResolvedCascadableConfig {
	model: LanguageModel
	blueprintModel: LanguageModel
}

/**
 * Parent models passed down during resolution
 */
export interface ParentModels {
	model: LanguageModel
	blueprintModel: LanguageModel
}

/**
 * Generic resolver function signature
 *
 * Each component implements its own resolver following this pattern.
 */
export type ConfigResolver<
	TInput extends CascadableConfig,
	TOutput extends ResolvedCascadableConfig,
> = (config: TInput, parentModels?: ParentModels) => TOutput
