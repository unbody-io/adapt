/**
 * Schema for synthesize phase identity
 *
 * Generated once at init from instructions.
 * Provides domain-specific context for synthesis.
 */

import { z } from 'zod'
import { compare } from '../../../cognitive-skills'

/**
 * Schema for generated synthesize identity
 *
 * Simplified: identity is free-form text, skills are explicit overrides
 */
export const synthesizeIdentitySchema = z.object({
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

export type SynthesizeIdentity = z.infer<typeof synthesizeIdentitySchema>
