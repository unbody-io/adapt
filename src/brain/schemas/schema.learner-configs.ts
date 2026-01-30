import { z } from 'zod'
import { learnerConfigSchema } from '../../learners/schema.config'

/**
 * Schema for the LLM output when decomposing a brain prompt into learner configs
 */
export const learnerConfigsSchema = z.object({
	learners: z
		.array(learnerConfigSchema)
		.describe('Generated learner configurations based on the brain prompt'),
})

export type LearnerConfigs = z.infer<typeof learnerConfigsSchema>
