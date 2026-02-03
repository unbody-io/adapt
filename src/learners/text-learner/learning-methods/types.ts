/**
 * Types for learning methods
 *
 * Re-exports from two-phase for backwards compatibility.
 */

export type {
	TwoPhaseConfig,
	LearnOutput,
	LearnOptions,
	LearnCallbacks,
	InitOutput,
	ObserveConfig,
	SynthesizeConfig,
	SynthesizeThresholds,
} from './two-phase'

// Learning method name is now just 'two-phase'
export type LearningMethodName = 'two-phase'
