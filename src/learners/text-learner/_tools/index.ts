/**
 * Tools for TextLearner
 *
 * Learning tools:
 * - synthesize: Terminal - commits new understanding
 * - dismiss: Terminal - rejects data as irrelevant
 * - complete: Terminal - completes tool loop
 *
 * Query tools: generateResponse, identifyGaps
 */

// Learning Tools
export { type CompleteParams, complete, completeParams } from './complete'
export { type DismissParams, dismiss, dismissParams } from './dismiss'
export {
	type SynthesizeParams,
	synthesize,
	synthesizeParams,
} from './synthesize'

// Query Tools
export {
	type GenerateResponseParams,
	generateResponse,
	generateResponseParams,
} from './generate-response'
export {
	type IdentifyGapsParams,
	identifyGaps,
	identifyGapsParams,
} from './identify-gaps'
