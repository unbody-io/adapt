import { z } from 'zod'
import { neuronConfigSchema } from '../../neurons/schema.config'

/**
 * Schema for root decomposition of a brain prompt
 *
 * Currently extracts neuron configs. Extensible for future extraction tasks.
 */
export const brainDecompositionSchema = z.object({
	neurons: z
		.array(neuronConfigSchema)
		.describe('Generated neuron configurations based on the brain prompt'),
})

export type BrainDecomposition = z.infer<typeof brainDecompositionSchema>
