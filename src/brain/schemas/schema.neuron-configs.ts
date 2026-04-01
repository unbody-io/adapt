import { z } from 'zod'
import { neuronConfigSchema } from '../../neurons/schema.config'

/**
 * Schema for the LLM output when decomposing a brain prompt into neuron configs
 */
export const neuronConfigsSchema = z.object({
	neurons: z
		.array(neuronConfigSchema)
		.describe('Generated neuron configurations based on the brain prompt'),
})

export type NeuronConfigs = z.infer<typeof neuronConfigsSchema>
