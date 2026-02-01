/**
 * Tools for TextLearner
 *
 * Learning tools:
 * - classify: Optional traceability for how observations relate to understanding
 * - synthesize: Terminal - commits new understanding
 * - dismiss: Terminal - rejects data as irrelevant
 *
 * Query tools: generateResponse, identifyGaps, complete
 */

// Learning Tools
export { classify, classifyParams, type ClassifyParams } from './classify'
export { synthesize, synthesizeParams, type SynthesizeParams } from './synthesize'
export { dismiss, dismissParams, type DismissParams } from './dismiss'

// Query Tools
export { generateResponse, generateResponseParams, type GenerateResponseParams } from './generate-response'
export { identifyGaps, identifyGapsParams, type IdentifyGapsParams } from './identify-gaps'
export { complete, completeParams, type CompleteParams } from './complete'
