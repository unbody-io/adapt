/**
 * Terminal tool schema for committing learning
 *
 * STUB: This file is in _tools (kept for future use).
 * Original import from _learning-methods was removed.
 */
import { z } from 'zod'

export const synthesizeParams = z.object({
	understanding: z.string().describe('Updated understanding'),
	evolution: z.string().describe('What changed'),
	significance: z.enum(['routine', 'notable', 'critical']),
})

export type SynthesizeParams = z.infer<typeof synthesizeParams>
