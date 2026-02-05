import { z } from 'zod'
import { learnerConfigSchema } from '../../learners/schema.config'

/**
 * Schema for root decomposition of a brain prompt
 *
 * Currently extracts learner configs. Extensible for future extraction tasks.
 */
export const brainDecompositionSchema = z.object({
	learners: z
		.array(learnerConfigSchema)
		.describe('Generated learner configurations based on the brain prompt'),
})

export type BrainDecomposition = z.infer<typeof brainDecompositionSchema>
