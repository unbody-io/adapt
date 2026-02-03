/**
 * Types for learning methods
 *
 * Re-exports from two-phase for backwards compatibility.
 */

export type {
	InitOutput,
	LearnCallbacks,
	LearnOptions,
	LearnOutput,
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
	TwoPhaseConfig,
} from './two-phase'

// Learning method name is now just 'two-phase'
export type LearningMethodName = 'two-phase'
