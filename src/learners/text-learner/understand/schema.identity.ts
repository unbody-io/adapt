/**
 * Schema for text understand phase identity
 */

import { z } from 'zod'
import { compare } from '../cognitive-skills'

export const understandIdentitySchema = z.object({
	identity: z
		.string()
		.describe(
			'Plain text identity: who you are (second person), your focus areas, and significance criteria (routine/notable/critical)',
		),
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
			'Cognitive skills with descriptions - original or customized for this domain',
		),
})

export type UnderstandIdentity = z.infer<typeof understandIdentitySchema>
