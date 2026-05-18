/**
 * Schema for text understand phase identity
 */

import { z } from 'zod'
import { compare, dynamics } from '../cognitive-skills'

export const understandIdentitySchema = z.object({
	skills: z
		.array(
			z.object({
				skill: compare.compareSkillEnum.describe(
					'The skill name from the compare skill-set',
				),
				description: z
					.string()
					.describe(
						'The skill description - original or customized for domain',
					),
			}),
		)
		.describe(
			'Content relationship skills with descriptions - original or customized for this domain',
		),
	dynamicsSkills: z
		.array(
			z.object({
				skill: dynamics.dynamicsSkillEnum.describe(
					'The skill name from the dynamics skill-set',
				),
				description: z
					.string()
					.describe(
						'The skill description - original or customized for domain',
					),
			}),
		)
		.describe(
			'Dynamics skills with descriptions - how temporal patterns manifest in this domain',
		),
})

export type UnderstandIdentity = z.infer<typeof understandIdentitySchema>
