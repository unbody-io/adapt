/**
 * Schema for observe phase identity
 *
 * Generated once at init from instructions.
 * Provides domain-specific context for observation.
 */

import { z } from 'zod'

/**
 * Schema for generated observe identity
 *
 * Only captures who the observer is and what they focus on.
 * Relevance and importance criteria are fixed in the system prompt framework.
 */
export const observeIdentitySchema = z.object({
	identity: z
		.string()
		.describe(
			'Plain text identity: who you are (second person) and what you focus on when observing data',
		),
	domain: z
		.string()
		.optional()
		.describe(
			'The broad subject area this observer covers, if applicable. Omit if the observer is cross-domain or general-purpose.',
		),
})

export type ObserveIdentity = z.infer<typeof observeIdentitySchema>
