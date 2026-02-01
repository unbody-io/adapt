/**
 * Terminal tool schema for committing learning
 *
 * Uses the shared base output schema from learning-methods.
 * The `dismissed` field is implicit (calling synthesize = not dismissed).
 */
export {
	baseOutputSchema as synthesizeParams,
	type BaseOutput as SynthesizeParams,
} from '../../learning-methods/schema.output'
