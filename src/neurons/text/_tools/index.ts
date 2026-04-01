/**
 * Tools for TextNeuron learning phases
 *
 * - synthesize: Terminal - commits new understanding
 * - dismiss: Terminal - rejects data as irrelevant
 */

export { type DismissParams, dismiss, dismissParams } from './dismiss'
export {
	type SynthesizeParams,
	synthesize,
	synthesizeParams,
} from './synthesize'
