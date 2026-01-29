/**
 * Tools for TextLearner
 *
 * Data processing tools: compareToUnderstanding, detectShift, detectPattern, synthesize
 * Query tools: generateResponse, identifyGaps, complete
 */

// Data Processing Tools
export { compareToUnderstanding, compareToUnderstandingParams, type CompareToUnderstandingParams } from './compare-to-understanding'
export { detectShift, detectShiftParams, type DetectShiftParams } from './detect-shift'
export { detectPattern, detectPatternParams, type DetectPatternParams } from './detect-pattern'
export { synthesize, synthesizeParams, type SynthesizeParams } from './synthesize'

// Query Tools
export { generateResponse, generateResponseParams, type GenerateResponseParams } from './generate-response'
export { identifyGaps, identifyGapsParams, type IdentifyGapsParams } from './identify-gaps'
export { complete, completeParams, type CompleteParams } from './complete'
